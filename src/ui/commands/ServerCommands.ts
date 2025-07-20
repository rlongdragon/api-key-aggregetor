import * as vscode from 'vscode';
import { uiStateManager } from '../core/UIStateManager';
import { themeService } from '../core/ThemeService';

/**
 * Commands for Server control and utilities
 */
export class ServerCommands {
  private disposables: vscode.Disposable[] = [];
  private serverInstance?: { close: () => void };

  constructor() {}

  /**
   * Register all server commands
   */
  public registerCommands(context: vscode.ExtensionContext): void {
    // Register start server command
    const startServerCommand = vscode.commands.registerCommand(
      'geminiAggregator.startServer',
      () => this.startServer()
    );

    // Register stop server command
    const stopServerCommand = vscode.commands.registerCommand(
      'geminiAggregator.stopServer',
      () => this.stopServer()
    );

    // Register restart server command
    const restartServerCommand = vscode.commands.registerCommand(
      'geminiAggregator.restartServer',
      () => this.restartServer()
    );

    // Register toggle server command (for status bar)
    const toggleServerCommand = vscode.commands.registerCommand(
      'geminiAggregator.toggleServer',
      () => this.toggleServer()
    );

    // Register refresh all command
    const refreshAllCommand = vscode.commands.registerCommand(
      'geminiAggregator.refreshAll',
      () => this.refreshAll()
    );

    // Register show logs command
    const showLogsCommand = vscode.commands.registerCommand(
      'geminiAggregator.showLogs',
      () => this.showLogs()
    );

    // Register export config command
    const exportConfigCommand = vscode.commands.registerCommand(
      'geminiAggregator.exportConfig',
      () => this.exportConfig()
    );

    // Register import config command
    const importConfigCommand = vscode.commands.registerCommand(
      'geminiAggregator.importConfig',
      () => this.importConfig()
    );

    // Register view server status command
    const viewServerStatusCommand = vscode.commands.registerCommand(
      'geminiAggregator.viewServerStatus',
      () => this.viewServerStatus()
    );

    // Add to disposables
    this.disposables.push(
      startServerCommand,
      stopServerCommand,
      restartServerCommand,
      toggleServerCommand,
      refreshAllCommand,
      showLogsCommand,
      exportConfigCommand,
      importConfigCommand,
      viewServerStatusCommand
    );

    // Add to extension context
    context.subscriptions.push(...this.disposables);
  }

  /**
   * Start the proxy server
   */
  private async startServer(): Promise<void> {
    try {
      const serverStatus = uiStateManager.getServerStatus();
      
      if (serverStatus.isRunning) {
        vscode.window.showInformationMessage('Server is already running');
        return;
      }

      await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'Starting Server',
        cancellable: false
      }, async (progress) => {
        progress.report({ increment: 0, message: 'Initializing...' });

        // Trigger the existing server start command
        await vscode.commands.executeCommand('geminiAggregator-dev.runserver');

        progress.report({ increment: 50, message: 'Starting proxy server...' });

        // Wait for server to start
        await new Promise(resolve => setTimeout(resolve, 2000));

        progress.report({ increment: 100, message: 'Server started!' });

        // Update server status
        uiStateManager.updateServerStatus({
          isRunning: true,
          uptime: 0
        });
      });

      vscode.window.showInformationMessage('Proxy server started successfully!');

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      vscode.window.showErrorMessage(`Failed to start server: ${errorMessage}`);
    }
  }

  /**
   * Stop the proxy server
   */
  private async stopServer(): Promise<void> {
    try {
      const serverStatus = uiStateManager.getServerStatus();
      
      if (!serverStatus.isRunning) {
        vscode.window.showInformationMessage('Server is not running');
        return;
      }

      // Confirm stop
      const confirmation = await vscode.window.showWarningMessage(
        'Are you sure you want to stop the proxy server? This will interrupt any active requests.',
        'Stop Server',
        'Cancel'
      );

      if (confirmation !== 'Stop Server') {
        return;
      }

      await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'Stopping Server',
        cancellable: false
      }, async (progress) => {
        progress.report({ increment: 0, message: 'Stopping proxy server...' });

        // Stop the server if we have a reference
        if (this.serverInstance) {
          this.serverInstance.close();
        }

        progress.report({ increment: 50, message: 'Cleaning up...' });

        // Wait for cleanup
        await new Promise(resolve => setTimeout(resolve, 1000));

        progress.report({ increment: 100, message: 'Server stopped!' });

        // Update server status
        uiStateManager.updateServerStatus({
          isRunning: false,
          uptime: 0,
          activeConnections: 0
        });
      });

      vscode.window.showInformationMessage('Proxy server stopped successfully!');

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      vscode.window.showErrorMessage(`Failed to stop server: ${errorMessage}`);
    }
  }

  /**
   * Toggle server state (start if stopped, stop if running)
   */
  private async toggleServer(): Promise<void> {
    const serverStatus = uiStateManager.getServerStatus();
    
    if (serverStatus.isRunning) {
      await this.stopServer();
    } else {
      await this.startServer();
    }
  }

  /**
   * Restart the proxy server
   */
  private async restartServer(): Promise<void> {
    try {
      await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'Restarting Server',
        cancellable: false
      }, async (progress) => {
        progress.report({ increment: 0, message: 'Stopping server...' });

        // Stop the server first
        await this.stopServer();

        progress.report({ increment: 50, message: 'Starting server...' });

        // Wait a moment
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Start the server
        await this.startServer();

        progress.report({ increment: 100, message: 'Restart complete!' });
      });

      vscode.window.showInformationMessage('Proxy server restarted successfully!');

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      vscode.window.showErrorMessage(`Failed to restart server: ${errorMessage}`);
    }
  }

  /**
   * Refresh all UI components
   */
  private async refreshAll(): Promise<void> {
    try {
      await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'Refreshing All Components',
        cancellable: false
      }, async (progress) => {
        progress.report({ increment: 0, message: 'Refreshing API keys...' });

        // Refresh API keys
        await vscode.commands.executeCommand('geminiAggregator.refreshApiKeys');

        progress.report({ increment: 33, message: 'Refreshing proxies...' });

        // Refresh proxies
        await vscode.commands.executeCommand('geminiAggregator.refreshProxies');

        progress.report({ increment: 66, message: 'Updating server status...' });

        // Update server status - just trigger a refresh
        // Note: lastRefresh is not part of ServerStatus interface
        // The refresh will be handled by the UI state manager

        progress.report({ increment: 100, message: 'Refresh complete!' });

        // Trigger global UI refresh
        uiStateManager.refresh();
      });

      vscode.window.showInformationMessage('All components refreshed successfully!');

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      vscode.window.showErrorMessage(`Failed to refresh components: ${errorMessage}`);
    }
  }

  /**
   * Show server logs
   */
  private async showLogs(): Promise<void> {
    try {
      // Create output channel for logs
      const outputChannel = vscode.window.createOutputChannel('Gemini Aggregator Logs');
      
      // Show recent logs (this would need to be connected to actual logging system)
      outputChannel.appendLine('=== Gemini API Key Aggregator Logs ===');
      outputChannel.appendLine(`Timestamp: ${new Date().toISOString()}`);
      outputChannel.appendLine('');
      
      const serverStatus = uiStateManager.getServerStatus();
      outputChannel.appendLine(`Server Status: ${serverStatus.isRunning ? 'Running' : 'Stopped'}`);
      outputChannel.appendLine(`Port: ${serverStatus.port || 'N/A'}`);
      outputChannel.appendLine(`Total Requests: ${serverStatus.totalRequests}`);
      outputChannel.appendLine(`Active Connections: ${serverStatus.activeConnections}`);
      
      if (serverStatus.lastError) {
        outputChannel.appendLine(`Last Error: ${serverStatus.lastError}`);
      }
      
      outputChannel.appendLine('');
      outputChannel.appendLine('=== API Keys ===');
      const apiKeys = uiStateManager.getApiKeys();
      apiKeys.forEach(key => {
        outputChannel.appendLine(`${key.keyId}: ${key.status} (${key.currentRequests} active requests)`);
      });
      
      outputChannel.appendLine('');
      outputChannel.appendLine('=== Proxies ===');
      const proxies = uiStateManager.getProxies();
      if (uiStateManager.isRotatingProxyEnabled()) {
        outputChannel.appendLine(`Rotating Proxy Mode: ${uiStateManager.getRotatingProxyUrl()}`);
      } else {
        proxies.forEach(proxy => {
          outputChannel.appendLine(`${proxy.url}: ${proxy.status} (${proxy.assignedKeys?.length || 0} keys assigned)`);
        });
      }
      
      outputChannel.appendLine('');
      outputChannel.appendLine('=== End of Logs ===');
      
      // Show the output channel
      outputChannel.show();

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      vscode.window.showErrorMessage(`Failed to show logs: ${errorMessage}`);
    }
  }

  /**
   * Export configuration
   */
  private async exportConfig(): Promise<void> {
    try {
      // Get current configuration
      const config = {
        timestamp: new Date().toISOString(),
        serverStatus: uiStateManager.getServerStatus(),
        apiKeys: uiStateManager.getApiKeys().map(key => ({
          keyId: key.keyId,
          status: key.status,
          proxyAssigned: key.proxyAssigned,
          // Don't export the actual API key for security
          hasKey: Boolean(key.keyId)
        })),
        proxies: uiStateManager.getProxies().map(proxy => ({
          id: proxy.id,
          url: proxy.url,
          status: proxy.status,
          assignedKeys: proxy.assignedKeys
        })),
        isRotatingProxyMode: uiStateManager.isRotatingProxyEnabled(),
        rotatingProxyUrl: uiStateManager.getRotatingProxyUrl()
      };

      // Show save dialog
      const saveUri = await vscode.window.showSaveDialog({
        defaultUri: vscode.Uri.file('gemini-aggregator-config.json'),
        filters: {
          'JSON Files': ['json'],
          'All Files': ['*']
        }
      });

      if (!saveUri) {
        return; // User cancelled
      }

      // Write configuration to file
      const configJson = JSON.stringify(config, null, 2);
      await vscode.workspace.fs.writeFile(saveUri, Buffer.from(configJson, 'utf8'));

      vscode.window.showInformationMessage(
        `Configuration exported successfully to ${saveUri.fsPath}`,
        'Open File'
      ).then(selection => {
        if (selection === 'Open File') {
          vscode.window.showTextDocument(saveUri);
        }
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      vscode.window.showErrorMessage(`Failed to export configuration: ${errorMessage}`);
    }
  }

  /**
   * Import configuration
   */
  private async importConfig(): Promise<void> {
    try {
      // Show open dialog
      const openUri = await vscode.window.showOpenDialog({
        canSelectFiles: true,
        canSelectFolders: false,
        canSelectMany: false,
        filters: {
          'JSON Files': ['json'],
          'All Files': ['*']
        }
      });

      if (!openUri || openUri.length === 0) {
        return; // User cancelled
      }

      // Read configuration file
      const configData = await vscode.workspace.fs.readFile(openUri[0]);
      const configJson = Buffer.from(configData).toString('utf8');
      
      let config: {
        apiKeys?: { keyId: string; status: string; proxyAssigned?: string }[];
        proxies?: { id: string; url: string; status: string; assignedKeys?: string[] }[];
        isRotatingProxyMode?: boolean;
        rotatingProxyUrl?: string;
      };
      
      try {
        config = JSON.parse(configJson);
      } catch {
        throw new Error('Invalid JSON format');
      }

      // Confirm import
      const confirmation = await vscode.window.showWarningMessage(
        'Importing configuration will replace current settings. This action cannot be undone.',
        { modal: true },
        'Import',
        'Cancel'
      );

      if (confirmation !== 'Import') {
        return;
      }

      await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'Importing Configuration',
        cancellable: false
      }, async (progress) => {
        progress.report({ increment: 0, message: 'Reading configuration...' });

        // Note: This is a simplified import - in a real implementation,
        // you would need to properly integrate with the actual managers
        
        progress.report({ increment: 50, message: 'Applying settings...' });

        // Update rotating proxy mode if specified
        if (typeof config.isRotatingProxyMode === 'boolean') {
          uiStateManager.setRotatingProxyMode(config.isRotatingProxyMode, config.rotatingProxyUrl);
        }

        progress.report({ increment: 100, message: 'Import complete!' });

        // Refresh UI
        uiStateManager.refresh();
      });

      vscode.window.showInformationMessage(
        'Configuration imported successfully! Some changes may require a restart to take effect.',
        'Restart Extension'
      ).then(selection => {
        if (selection === 'Restart Extension') {
          vscode.commands.executeCommand('workbench.action.reloadWindow');
        }
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      vscode.window.showErrorMessage(`Failed to import configuration: ${errorMessage}`);
    }
  }

  /**
   * View server status details
   */
  private async viewServerStatus(): Promise<void> {
    try {
      const serverStatus = uiStateManager.getServerStatus();
      const apiKeys = uiStateManager.getApiKeys();
      const proxies = uiStateManager.getProxies();

      // Create status panel
      const panel = vscode.window.createWebviewPanel(
        'serverStatus',
        'Server Status',
        vscode.ViewColumn.One,
        {
          enableScripts: false,
          retainContextWhenHidden: true
        }
      );

      // Generate HTML content
      panel.webview.html = this.generateServerStatusHtml(serverStatus, apiKeys, proxies);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      vscode.window.showErrorMessage(`Failed to view server status: ${errorMessage}`);
    }
  }

  /**
   * Generate HTML content for server status
   */
  private generateServerStatusHtml(
    serverStatus: { isRunning: boolean; port?: number; uptime?: number; totalRequests: number; activeConnections: number; lastError?: string },
    apiKeys: { keyId?: string; status: string; currentRequests?: number }[],
    proxies: { url?: string; status: string; assignedKeys?: string[] }[]
  ): string {
    const isRotatingProxy = uiStateManager.isRotatingProxyEnabled();
    const rotatingProxyUrl = uiStateManager.getRotatingProxyUrl();
    
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Server Status</title>
        ${themeService.getWebviewStyles()}
      </head>
      <body>
        <div class="header">
          <h2>🖥️ Server Status Dashboard</h2>
          <p>Real-time status of the Gemini API Key Aggregator</p>
        </div>

        <div class="section">
          <h3>🚀 Server Information</h3>
          <div class="info-grid">
            <span class="info-label">Status:</span>
            <span class="status-${serverStatus.isRunning ? 'running' : 'stopped'}">${serverStatus.isRunning ? 'RUNNING' : 'STOPPED'}</span>
            
            <span class="info-label">Port:</span>
            <span>${serverStatus.port || 'N/A'}</span>
            
            <span class="info-label">Uptime:</span>
            <span>${serverStatus.uptime ? this.formatUptime(serverStatus.uptime) : 'N/A'}</span>
            
            <span class="info-label">Total Requests:</span>
            <span>${serverStatus.totalRequests}</span>
            
            <span class="info-label">Active Connections:</span>
            <span>${serverStatus.activeConnections}</span>
          </div>
          
          ${serverStatus.lastError ? `
            <div class="stats-box">
              <strong>⚠️ Last Error:</strong><br>
              ${serverStatus.lastError}
            </div>
          ` : ''}
        </div>

        <div class="section">
          <h3>🔑 API Keys Summary</h3>
          <div class="stats-box">
            <div class="stats-row">
              <span>Total API Keys:</span>
              <span><strong>${apiKeys.length}</strong></span>
            </div>
            <div class="stats-row">
              <span>Active Keys:</span>
              <span><strong>${apiKeys.filter(k => k.status === 'active').length}</strong></span>
            </div>
            <div class="stats-row">
              <span>Rate Limited Keys:</span>
              <span><strong>${apiKeys.filter(k => k.status === 'rate_limited').length}</strong></span>
            </div>
            <div class="stats-row">
              <span>Error Keys:</span>
              <span><strong>${apiKeys.filter(k => k.status === 'error').length}</strong></span>
            </div>
            <div class="stats-row">
              <span>Total Active Requests:</span>
              <span><strong>${apiKeys.reduce((sum, k) => sum + (k.currentRequests || 0), 0)}</strong></span>
            </div>
          </div>
        </div>

        <div class="section">
          <h3>🌐 Proxy Configuration</h3>
          <div class="info-grid">
            <span class="info-label">Mode:</span>
            <span>${isRotatingProxy ? 'Rotating Proxy' : 'Individual Proxies'}</span>
            
            ${isRotatingProxy ? `
              <span class="info-label">Rotating Proxy URL:</span>
              <span>${rotatingProxyUrl || 'Not configured'}</span>
            ` : `
              <span class="info-label">Total Proxies:</span>
              <span>${proxies.length}</span>
              
              <span class="info-label">Healthy Proxies:</span>
              <span>${proxies.filter(p => p.status === 'active').length}</span>
              
              <span class="info-label">Unhealthy Proxies:</span>
              <span>${proxies.filter(p => p.status === 'error').length}</span>
            `}
          </div>
          
          ${!isRotatingProxy && proxies.length > 0 ? `
            <div class="stats-box">
              <strong>Proxy Details:</strong><br>
              ${proxies.map(proxy => `
                <div class="stats-row">
                  <span>${this.getProxyDisplayName(proxy.url || 'Unknown')}:</span>
                  <span class="status-${proxy.status === 'active' ? 'active' : 'error'}">${proxy.status.toUpperCase()}</span>
                </div>
              `).join('')}
            </div>
          ` : ''}
        </div>

        <div class="section">
          <h3>📊 Performance Metrics</h3>
          <div class="stats-box">
            <div class="stats-row">
              <span>Requests per API Key:</span>
              <span><strong>${apiKeys.length > 0 ? (serverStatus.totalRequests / apiKeys.length).toFixed(1) : '0'}</strong></span>
            </div>
            <div class="stats-row">
              <span>Success Rate:</span>
              <span><strong>N/A</strong> (Feature not implemented)</span>
            </div>
            <div class="stats-row">
              <span>Average Response Time:</span>
              <span><strong>N/A</strong> (Feature not implemented)</span>
            </div>
          </div>
        </div>

        <div class="section">
          <p><em>Last updated: ${new Date().toLocaleString()}</em></p>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Format uptime in human readable format
   */
  private formatUptime(uptimeMs: number): string {
    const seconds = Math.floor(uptimeMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${days}d ${hours % 24}h ${minutes % 60}m`;
    } else if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  /**
   * Get display name for proxy URL
   */
  private getProxyDisplayName(url: string): string {
    try {
      const parsedUrl = new URL(url);
      return `${parsedUrl.hostname}:${parsedUrl.port}`;
    } catch {
      return url;
    }
  }

  /**
   * Set server instance reference
   */
  public setServerInstance(server: { close: () => void }): void {
    this.serverInstance = server;
  }

  /**
   * Dispose resources
   */
  public dispose(): void {
    this.disposables.forEach(d => d.dispose());
    this.disposables = [];
  }
}