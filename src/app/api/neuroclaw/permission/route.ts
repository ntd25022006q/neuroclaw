/**
 * NeuroClaw Permission API
 * Handle permission requests and responses
 */

import { NextRequest, NextResponse } from 'next/server';
import { getNeuroClaw } from '@/lib/neuroclaw/manager';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const { 
      action,
      sessionId,
      requestId,
      granted,
      reason,
      toolId,
      policy
    } = body;

    const neuroClaw = getNeuroClaw();

    switch (action) {
      case 'respond':
        // Respond to a pending permission request
        if (!requestId) {
          return NextResponse.json(
            { success: false, error: 'Request ID is required' },
            { status: 400 }
          );
        }

        neuroClaw.respondToPermissionRequest(requestId, granted, reason);

        return NextResponse.json({
          success: true,
          message: granted ? 'Permission granted' : 'Permission denied'
        });

      case 'setPolicy':
        // Set a tool policy for a session
        if (!sessionId || !toolId) {
          return NextResponse.json(
            { success: false, error: 'Session ID and Tool ID are required' },
            { status: 400 }
          );
        }

        neuroClaw.setToolPolicy(sessionId, toolId, policy || {});

        return NextResponse.json({
          success: true,
          message: 'Policy updated'
        });

      case 'getAuditLogs':
        // Get audit logs for a session
        if (!sessionId) {
          return NextResponse.json(
            { success: false, error: 'Session ID is required' },
            { status: 400 }
          );
        }

        const logs = neuroClaw.getAuditLogs(sessionId);

        return NextResponse.json({
          success: true,
          logs
        });

      default:
        return NextResponse.json(
          { success: false, error: 'Unknown action' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Permission error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to process permission request' 
      },
      { status: 500 }
    );
  }
}
