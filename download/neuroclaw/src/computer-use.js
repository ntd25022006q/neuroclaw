/**
 * Computer Use - File, Shell, Browser Operations
 */

import { promises as fs } from 'fs';
import { exec } from 'child_process';
import { createRequire } from 'module';
import path from 'path';

const require = createRequire(import.meta.url);

export class ComputerUse {
    constructor(config = {}) {
        this.sandboxEnabled = config.sandboxEnabled !== false;
        this.allowedPaths = config.allowedPaths || ['/home/z/my-project'];
        this.blockedCommands = [
            'rm -rf /', 'rm -rf /*', 'sudo rm', 'mkfs', 'dd if=',
            ':(){:|:&};:', 'chmod 777 /', 'curl | bash', 'wget | sh',
            'shutdown', 'reboot', 'init 0', 'halt', 'poweroff'
        ];
        
        this.browser = null;
        this.page = null;
        this.browserReady = false;
        
        this.auditLog = [];
        this.stats = { fileOps: 0, shellOps: 0, browserOps: 0, blockedOps: 0, errors: 0 };

        console.log('💻 Computer Use initialized');
    }

    async _initBrowser() {
        if (this.browserReady) return;
        
        try {
            const puppeteer = require('puppeteer');
            this.browser = await puppeteer.launch({
                headless: 'new',
                args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
            });
            this.page = await this.browser.newPage();
            await this.page.setViewport({ width: 1920, height: 1080 });
            this.browserReady = true;
            console.log('🌐 Browser ready');
        } catch (error) {
            console.warn('Browser unavailable:', error.message);
        }
    }

    // File Operations
    async readFile(filePath) {
        this._log('file_read', { path: filePath });
        try {
            this._validatePath(filePath);
            const content = await fs.readFile(filePath, 'utf-8');
            this.stats.fileOps++;
            return { success: true, content, path: filePath, size: content.length };
        } catch (error) {
            this.stats.errors++;
            return { success: false, error: error.message };
        }
    }

    async writeFile(filePath, content) {
        this._log('file_write', { path: filePath });
        try {
            this._validatePath(filePath);
            await fs.mkdir(path.dirname(filePath), { recursive: true });
            await fs.writeFile(filePath, content, 'utf-8');
            this.stats.fileOps++;
            return { success: true, path: filePath, bytesWritten: Buffer.byteLength(content, 'utf-8') };
        } catch (error) {
            this.stats.errors++;
            return { success: false, error: error.message };
        }
    }

    async listFiles(dirPath) {
        this._log('file_list', { path: dirPath });
        try {
            this._validatePath(dirPath);
            const entries = await fs.readdir(dirPath, { withFileTypes: true });
            const files = entries.map(e => ({ name: e.name, isDirectory: e.isDirectory(), isFile: e.isFile() }));
            this.stats.fileOps++;
            return { success: true, path: dirPath, files, count: files.length };
        } catch (error) {
            this.stats.errors++;
            return { success: false, error: error.message };
        }
    }

    async deleteFile(filePath) {
        this._log('file_delete', { path: filePath });
        try {
            this._validatePath(filePath);
            await fs.unlink(filePath);
            this.stats.fileOps++;
            return { success: true, path: filePath, deleted: true };
        } catch (error) {
            this.stats.errors++;
            return { success: false, error: error.message };
        }
    }

    // Shell Operations
    async executeShell(command, timeout = 30000) {
        this._log('shell_exec', { command });
        
        const security = this._validateCommand(command);
        if (!security.allowed) {
            this.stats.blockedOps++;
            return { success: false, error: security.reason, blocked: true };
        }
        
        return new Promise(resolve => {
            exec(command, { timeout }, (error, stdout, stderr) => {
                this.stats.shellOps++;
                if (error) {
                    resolve({ success: false, error: error.message, stdout, stderr });
                } else {
                    resolve({ success: true, stdout, stderr, exitCode: 0 });
                }
            });
        });
    }

    // Browser Operations
    async browserNavigate(url) {
        this._log('browser_navigate', { url });
        try {
            await this._initBrowser();
            if (!this.browserReady) return { success: false, error: 'Browser not available' };
            
            await this.page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
            const title = await this.page.title();
            this.stats.browserOps++;
            return { success: true, url: this.page.url(), title };
        } catch (error) {
            this.stats.errors++;
            return { success: false, error: error.message };
        }
    }

    async browserClick(selector) {
        this._log('browser_click', { selector });
        try {
            if (!this.page) return { success: false, error: 'No page loaded' };
            await this.page.waitForSelector(selector, { timeout: 10000 });
            await this.page.click(selector);
            this.stats.browserOps++;
            return { success: true, selector };
        } catch (error) {
            this.stats.errors++;
            return { success: false, error: error.message };
        }
    }

    async browserType(selector, text) {
        this._log('browser_type', { selector });
        try {
            if (!this.page) return { success: false, error: 'No page loaded' };
            await this.page.waitForSelector(selector, { timeout: 10000 });
            await this.page.type(selector, text);
            this.stats.browserOps++;
            return { success: true, selector, typed: text.length };
        } catch (error) {
            this.stats.errors++;
            return { success: false, error: error.message };
        }
    }

    async browserScreenshot(savePath) {
        this._log('browser_screenshot', { savePath });
        try {
            if (!this.page) return { success: false, error: 'No page loaded' };
            this._validatePath(savePath);
            await this.page.screenshot({ path: savePath, fullPage: true });
            this.stats.browserOps++;
            return { success: true, path: savePath };
        } catch (error) {
            this.stats.errors++;
            return { success: false, error: error.message };
        }
    }

    async browserClose() {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
            this.page = null;
            this.browserReady = false;
        }
        return { success: true };
    }

    // Security
    _validatePath(filePath) {
        const resolved = path.resolve(filePath);
        if (this.sandboxEnabled) {
            const isAllowed = this.allowedPaths.some(allowed => resolved.startsWith(path.resolve(allowed)));
            if (!isAllowed) throw new Error(`Path not allowed: ${filePath}`);
        }
        return resolved;
    }

    _validateCommand(command) {
        const lower = command.toLowerCase();
        for (const blocked of this.blockedCommands) {
            if (lower.includes(blocked.toLowerCase())) {
                return { allowed: false, reason: `Blocked: "${blocked}"` };
            }
        }
        
        const injections = [/\$\(/, /`/, /\|\s*sh/, />\s*\//, /;\s*rm/, /&&\s*rm/];
        for (const pattern of injections) {
            if (pattern.test(command)) {
                return { allowed: false, reason: 'Potential injection detected' };
            }
        }
        return { allowed: true };
    }

    _log(action, params) {
        this.auditLog.push({ timestamp: new Date().toISOString(), action, params });
        if (this.auditLog.length > 1000) this.auditLog = this.auditLog.slice(-1000);
    }

    getAuditLog(limit = 100) { return this.auditLog.slice(-limit); }
    getStats() { return { ...this.stats, auditLogSize: this.auditLog.length }; }

    async close() {
        await this.browserClose();
    }
}

export default ComputerUse;
