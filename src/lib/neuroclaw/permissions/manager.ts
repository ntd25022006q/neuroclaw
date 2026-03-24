/**
 * NeuroClaw - Permission Manager
 * Security-first permission system with user confirmation
 * Prevents unauthorized actions and provides detailed audit logs
 */

import type {
  PermissionLevel,
  PermissionRequest,
  PermissionResponse,
  PermissionPolicy,
  SessionPermissions,
  ToolDefinition,
  ToolExecutionResult
} from '../types';

export interface PermissionAuditLog {
  id: string;
  sessionId: string;
  timestamp: Date;
  action: 'request' | 'approve' | 'deny' | 'auto_approve' | 'policy_deny';
  requestId: string;
  toolId: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  reason?: string;
  grantedBy?: 'user' | 'auto' | 'policy';
}

export interface PermissionManagerConfig {
  autoApproveLowRisk: boolean;
  requireConfirmationFor: PermissionLevel[];
  maxCallsPerToolPerHour: number;
  maxCallsPerToolPerDay: number;
  auditLogRetention: number; // days
}

type PermissionCallback = (request: PermissionRequest) => Promise<PermissionResponse>;

export class PermissionManager {
  private sessions: Map<string, SessionPermissions> = new Map();
  private auditLogs: Map<string, PermissionAuditLog[]> = new Map();
  private pendingRequests: Map<string, {
    request: PermissionRequest;
    resolve: (response: PermissionResponse) => void;
    reject: (error: Error) => void;
  }> = new Map();
  private permissionCallbacks: Map<string, PermissionCallback> = new Map();
  private config: PermissionManagerConfig;

  constructor(config?: Partial<PermissionManagerConfig>) {
    this.config = {
      autoApproveLowRisk: config?.autoApproveLowRisk ?? true,
      requireConfirmationFor: config?.requireConfirmationFor ?? ['execute', 'admin', 'dangerous'],
      maxCallsPerToolPerHour: config?.maxCallsPerToolPerHour ?? 100,
      maxCallsPerToolPerDay: config?.maxCallsPerToolPerDay ?? 1000,
      auditLogRetention: config?.auditLogRetention ?? 30
    };
  }

  /**
   * Create a new session with default permissions
   */
  createSession(sessionId: string): SessionPermissions {
    const session: SessionPermissions = {
      sessionId,
      policies: new Map(),
      approvedActions: new Set(),
      deniedActions: new Set(),
      callCounts: new Map()
    };

    this.sessions.set(sessionId, session);
    this.auditLogs.set(sessionId, []);

    return session;
  }

  /**
   * Get session permissions
   */
  getSession(sessionId: string): SessionPermissions | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Remove a session
   */
  removeSession(sessionId: string): void {
    this.sessions.delete(sessionId);
    this.auditLogs.delete(sessionId);
    
    // Remove any pending requests for this session
    for (const [requestId, pending] of this.pendingRequests.entries()) {
      if (pending.request.toolId.startsWith(sessionId)) {
        pending.reject(new Error('Session ended'));
        this.pendingRequests.delete(requestId);
      }
    }
  }

  /**
   * Register a callback for permission requests
   * This is used to notify the UI when user confirmation is needed
   */
  registerPermissionCallback(sessionId: string, callback: PermissionCallback): void {
    this.permissionCallbacks.set(sessionId, callback);
  }

  /**
   * Unregister permission callback
   */
  unregisterPermissionCallback(sessionId: string): void {
    this.permissionCallbacks.delete(sessionId);
  }

  /**
   * Set policy for a specific tool
   */
  setToolPolicy(
    sessionId: string,
    toolId: string,
    policy: Partial<PermissionPolicy>
  ): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const existingPolicy = session.policies.get(toolId) || {
      toolId,
      allowedActions: [],
      autoApprove: [],
      requireConfirmation: [],
      denied: []
    };

    session.policies.set(toolId, {
      ...existingPolicy,
      ...policy
    });
  }

  /**
   * Request permission to execute a tool
   * Returns true if permission is granted (either auto-approved or by user)
   */
  async requestPermission(
    sessionId: string,
    tool: ToolDefinition,
    action: string,
    parameters: Record<string, unknown>
  ): Promise<PermissionResponse> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    // Create permission request
    const request: PermissionRequest = {
      id: `${sessionId}-${tool.id}-${Date.now()}`,
      toolId: tool.id,
      action,
      parameters,
      riskLevel: tool.permissions.riskLevel,
      reason: this.generateReasonString(tool, action, parameters),
      timestamp: new Date()
    };

    // Check rate limits
    const rateLimitResult = this.checkRateLimits(session, tool.id);
    if (!rateLimitResult.allowed) {
      return this.createDenyResponse(
        request.id,
        `Rate limit exceeded: ${rateLimitResult.reason}`
      );
    }

    // Check policy
    const policyResult = this.checkPolicy(session, tool, action);
    if (policyResult.decision === 'deny') {
      this.logAudit(sessionId, 'policy_deny', request);
      return this.createDenyResponse(request.id, policyResult.reason);
    }

    // Check if action is auto-approved by policy
    if (policyResult.decision === 'auto_approve') {
      this.logAudit(sessionId, 'auto_approve', request);
      this.incrementCallCount(session, tool.id);
      return {
        requestId: request.id,
        granted: true,
        reason: 'Auto-approved by policy',
        grantedBy: 'policy',
        grantedAt: new Date()
      };
    }

    // Check if low risk and auto-approve is enabled
    if (
      this.config.autoApproveLowRisk &&
      tool.permissions.riskLevel === 'low' &&
      !this.config.requireConfirmationFor.includes(tool.permissions.level)
    ) {
      this.logAudit(sessionId, 'auto_approve', request);
      this.incrementCallCount(session, tool.id);
      return {
        requestId: request.id,
        granted: true,
        reason: 'Auto-approved (low risk)',
        grantedBy: 'auto',
        grantedAt: new Date()
      };
    }

    // Need user confirmation
    this.logAudit(sessionId, 'request', request);

    // Check if there's a callback registered for this session
    const callback = this.permissionCallbacks.get(sessionId);
    if (!callback) {
      // No callback - cannot ask user, deny by default for safety
      return this.createDenyResponse(
        request.id,
        'User confirmation required but no callback registered'
      );
    }

    // Store pending request and wait for user response
    return new Promise((resolve, reject) => {
      this.pendingRequests.set(request.id, {
        request,
        resolve: (response) => {
          this.pendingRequests.delete(request.id);
          if (response.granted) {
            this.logAudit(sessionId, 'approve', request, response.grantedBy);
            this.incrementCallCount(session, tool.id);
          } else {
            this.logAudit(sessionId, 'deny', request);
          }
          resolve(response);
        },
        reject: (error) => {
          this.pendingRequests.delete(request.id);
          reject(error);
        }
      });

      // Call the callback to notify UI
      callback(request)
        .then((response) => {
          const pending = this.pendingRequests.get(request.id);
          if (pending) {
            pending.resolve(response);
          }
        })
        .catch((error) => {
          const pending = this.pendingRequests.get(request.id);
          if (pending) {
            pending.reject(error);
          }
        });
    });
  }

  /**
   * Respond to a permission request (called by UI)
   */
  respondToRequest(requestId: string, granted: boolean, reason?: string): void {
    const pending = this.pendingRequests.get(requestId);
    if (!pending) {
      throw new Error(`No pending request found with id ${requestId}`);
    }

    const response: PermissionResponse = {
      requestId,
      granted,
      reason: granted ? 'Approved by user' : (reason || 'Denied by user'),
      grantedBy: 'user',
      grantedAt: new Date()
    };

    pending.resolve(response);
  }

  /**
   * Check if an action is pre-approved for a session
   */
  isActionApproved(sessionId: string, toolId: string, action: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    const key = `${toolId}:${action}`;
    return session.approvedActions.has(key);
  }

  /**
   * Mark an action as approved for a session (for "remember this decision")
   */
  markActionApproved(sessionId: string, toolId: string, action: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    const key = `${toolId}:${action}`;
    session.approvedActions.add(key);
    session.deniedActions.delete(key);
  }

  /**
   * Mark an action as denied for a session
   */
  markActionDenied(sessionId: string, toolId: string, action: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    const key = `${toolId}:${action}`;
    session.deniedActions.add(key);
    session.approvedActions.delete(key);
  }

  /**
   * Get audit logs for a session
   */
  getAuditLogs(sessionId: string): PermissionAuditLog[] {
    return this.auditLogs.get(sessionId) || [];
  }

  /**
   * Check rate limits
   */
  private checkRateLimits(
    session: SessionPermissions,
    toolId: string
  ): { allowed: boolean; reason?: string } {
    const counts = session.callCounts.get(toolId) || {
      hour: 0,
      day: 0,
      lastReset: new Date()
    };

    const now = new Date();
    const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Reset counters if needed
    if (counts.lastReset < hourAgo) {
      counts.hour = 0;
    }
    if (counts.lastReset < dayAgo) {
      counts.day = 0;
    }

    // Check limits
    if (counts.hour >= this.config.maxCallsPerToolPerHour) {
      return {
        allowed: false,
        reason: `Hourly limit (${this.config.maxCallsPerToolPerHour}) exceeded for tool ${toolId}`
      };
    }

    if (counts.day >= this.config.maxCallsPerToolPerDay) {
      return {
        allowed: false,
        reason: `Daily limit (${this.config.maxCallsPerToolPerDay}) exceeded for tool ${toolId}`
      };
    }

    return { allowed: true };
  }

  /**
   * Check policy for a tool action
   */
  private checkPolicy(
    session: SessionPermissions,
    tool: ToolDefinition,
    action: string
  ): { decision: 'allow' | 'deny' | 'auto_approve' | 'ask'; reason?: string } {
    const policy = session.policies.get(tool.id);

    if (!policy) {
      // No specific policy - use default behavior
      return { decision: 'ask' };
    }

    // Check if denied
    if (policy.denied.includes(action) || policy.denied.includes('*')) {
      return {
        decision: 'deny',
        reason: `Action '${action}' is denied by policy for tool '${tool.id}'`
      };
    }

    // Check if auto-approved
    if (policy.autoApprove.includes(action) || policy.autoApprove.includes('*')) {
      return { decision: 'auto_approve' };
    }

    // Check if requires confirmation
    if (policy.requireConfirmation.includes(action) || policy.requireConfirmation.includes('*')) {
      return { decision: 'ask' };
    }

    // Check if allowed
    if (policy.allowedActions.length === 0 || 
        policy.allowedActions.includes(action) || 
        policy.allowedActions.includes('*')) {
      return { decision: 'ask' }; // Still ask for confirmation by default
    }

    // Not in allowed list
    return {
      decision: 'deny',
      reason: `Action '${action}' is not in allowed actions for tool '${tool.id}'`
    };
  }

  /**
   * Increment call count for a tool
   */
  private incrementCallCount(session: SessionPermissions, toolId: string): void {
    const counts = session.callCounts.get(toolId) || {
      hour: 0,
      day: 0,
      lastReset: new Date()
    };

    counts.hour++;
    counts.day++;
    counts.lastReset = new Date();
    session.callCounts.set(toolId, counts);
  }

  /**
   * Generate a human-readable reason string
   */
  private generateReasonString(
    tool: ToolDefinition,
    action: string,
    parameters: Record<string, unknown>
  ): string {
    const paramStr = Object.keys(parameters).length > 0
      ? ` with parameters: ${JSON.stringify(parameters).substring(0, 100)}`
      : '';

    return `Tool '${tool.name}' wants to ${action}${paramStr}. Risk level: ${tool.permissions.riskLevel}`;
  }

  /**
   * Create a deny response
   */
  private createDenyResponse(requestId: string, reason: string): PermissionResponse {
    return {
      requestId,
      granted: false,
      reason,
      grantedBy: 'policy',
      grantedAt: new Date()
    };
  }

  /**
   * Log an audit event
   */
  private logAudit(
    sessionId: string,
    action: PermissionAuditLog['action'],
    request: PermissionRequest,
    grantedBy?: 'user' | 'auto' | 'policy'
  ): void {
    const logs = this.auditLogs.get(sessionId) || [];
    
    logs.push({
      id: `audit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      sessionId,
      timestamp: new Date(),
      action,
      requestId: request.id,
      toolId: request.toolId,
      riskLevel: request.riskLevel,
      reason: request.reason,
      grantedBy
    });

    // Keep only recent logs (based on retention config)
    const cutoff = new Date(Date.now() - this.config.auditLogRetention * 24 * 60 * 60 * 1000);
    const filteredLogs = logs.filter(log => log.timestamp > cutoff);
    
    this.auditLogs.set(sessionId, filteredLogs);
  }
}
