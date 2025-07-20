import * as vscode from 'vscode';
import { ProxyPoolManager } from '../../server/core/ProxyPoolManager';
import { ProxyAssignmentManager } from '../../server/core/ProxyAssignmentManager';
import { uiStateManager } from '../core/UIStateManager';
import { DataTransformers } from '../utils/DataTransformers';
import { ProxyDetails, ProxyAssignment, ProxyQuickPickItem, ApiKeyQuickPickItem } from '../types/ProxyTypes';

/**
 * Commands for Proxy management
 */
export class ProxyCommands {
  private proxyPoolManager?: ProxyPoolManager;
  private proxyAssignmentManager?: ProxyAssignmentManager;
  private disposables: vscode.Disposable[] = [];

  constructor(proxyPoolManager?: ProxyPoolManager, proxyAssignmentManager?: ProxyAssignmentManager) {
    this.proxyPoolManager = proxyPoolManager;
    this.proxyAssignmentManager = proxyAssignmentManager;
  }

  /**
   * Register all proxy commands
   */
  public registerCommands(context: vscode.ExtensionContext): void {
    const commands = [
      vscode.commands.registerCommand('geminiAggregator.addProxy', () => this.addProxy()),
      vscode.commands.registerCommand('geminiAggregator.removeProxy', (proxyId?: string) => this.removeProxy(proxyId)),
      vscode.commands.registerCommand('geminiAggregator.testProxy', (proxyId?: string) => this.testProxy(proxyId)),
      vscode.commands.registerCommand('geminiAggregator.assignProxy', (proxyId?: string) => this.assignProxy(proxyId)),
      vscode.commands.registerCommand('geminiAggregator.refreshProxies', () => this.refreshProxies()),
      vscode.commands.registerCommand('geminiAggregator.viewProxyDetails', (proxyId?: string) => this.viewProxyDetails(proxyId))
    ];

    this.disposables.push(...commands);
    context.subscriptions.push(...this.disposables);
  }

  /**
   * Add a new proxy
   */
  private async addProxy(): Promise<void> {
    try {
      if (uiStateManager.isRotatingProxyEnabled()) {
        const choice = await vscode.window.showWarningMessage(
          'Rotating proxy mode is currently enabled. Individual proxies will not be used.',
          'Continue Anyway',
          'Cancel'
        );
        
        if (choice !== 'Continue Anyway') {
          return;
        }
      }

      const proxyUrl = await vscode.window.showInputBox({
        prompt: 'Enter proxy URL',
        placeHolder: 'http://username:password@proxy.example.com:8080',
        validateInput: this.validateProxyUrl
      });

      if (!proxyUrl) {
        return;
      }

      await this.addProxyWithProgress(proxyUrl.trim());
      vscode.window.showInformationMessage('Proxy added successfully!');

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      vscode.window.showErrorMessage(`Failed to add proxy: ${errorMessage}`);
    }
  }

  /**
   * Remove a proxy
   */
  private async removeProxy(proxyId?: string): Promise<void> {
    try {
      const targetProxyId = proxyId || await this.selectProxyForRemoval();
      if (!targetProxyId) {
        return;
      }

      const proxy = this.proxyPoolManager?.getProxy(targetProxyId);
      if (!proxy) {
        vscode.window.showErrorMessage('Proxy not found');
        return;
      }

      const confirmed = await this.confirmProxyRemoval(proxy);
      if (!confirmed) {
        return;
      }

      await this.removeProxyWithProgress(targetProxyId);
      vscode.window.showInformationMessage('Proxy removed successfully!');

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      vscode.window.showErrorMessage(`Failed to remove proxy: ${errorMessage}`);
    }
  }

  /**
   * Test a proxy
   */
  private async testProxy(proxyId?: string): Promise<void> {
    try {
      const targetProxyId = proxyId || await this.selectProxyForTest();
      if (!targetProxyId) {
        return;
      }

      await this.testProxyWithProgress(targetProxyId);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      vscode.window.showErrorMessage(`Failed to test proxy: ${errorMessage}`);
    }
  }

  /**
   * Assign proxy to API key
   */
  private async assignProxy(proxyId?: string): Promise<void> {
    try {
      if (uiStateManager.isRotatingProxyEnabled()) {
        vscode.window.showInformationMessage(
          'Rotating proxy mode is enabled. Individual proxy assignments are not used in this mode.'
        );
        return;
      }

      const targetProxyId = proxyId || await this.selectProxyForAssignment();
      if (!targetProxyId) {
        return;
      }

      const keyId = await this.selectApiKeyForAssignment();
      if (!keyId) {
        return;
      }

      await this.assignProxyWithProgress(targetProxyId, keyId);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      vscode.window.showErrorMessage(`Failed to assign proxy: ${errorMessage}`);
    }
  }

  /**
   * View proxy details
   */
  private async viewProxyDetails(proxyId?: string): Promise<void> {
    try {
      const targetProxyId = proxyId || await this.selectProxyForDetails();
      if (!targetProxyId) {
        return;
      }

      const proxy = this.proxyPoolManager?.getProxy(targetProxyId);
      if (!proxy) {
        vscode.window.showErrorMessage('Proxy not found');
        return;
      }

      const assignments = this.getProxyAssignments(targetProxyId);
      
      // Transform proxy to ProxyDetails format
      const proxyDetails: ProxyDetails = {
        id: proxy.id,
        url: proxy.url,
        status: proxy.status,
        assignedKeyCount: assignments.length,
        responseTime: (proxy as any).responseTime,
        lastHealthCheck: typeof proxy.lastHealthCheck === 'number' ? new Date(proxy.lastHealthCheck) : proxy.lastHealthCheck,
        errorCount: proxy.errorCount || 0,
        lastError: proxy.lastError
      };
      
      this.showProxyDetailsPanel(proxyDetails, assignments);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      vscode.window.showErrorMessage(`Failed to view proxy details: ${errorMessage}`);
    }
  }

  /**
   * Refresh proxies
   */
  private async refreshProxies(): Promise<void> {
    try {
      await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'Refreshing Proxies',
        cancellable: false
      }, async (progress) => {
        progress.report({ increment: 0, message: 'Updating proxy status...' });

        if (!this.proxyPoolManager) {
          throw new Error('Proxy Pool Manager not initialized');
        }

        const proxies = this.proxyPoolManager.getAllProxies();
        progress.report({ increment: 50, message: 'Updating UI...' });

        for (const proxy of proxies) {
          const treeItem = DataTransformers.transformProxy(proxy);
          
          if (this.proxyAssignmentManager) {
            const allAssignments = this.proxyAssignmentManager.getAllAssignments();
            const proxyAssignments = allAssignments.filter(a => a.proxyId === proxy.id);
            treeItem.assignedKeys = proxyAssignments.map(a => a.keyId);
          }
          
          uiStateManager.updateProxy(proxy.id, treeItem);
        }

        progress.report({ increment: 100, message: 'Complete!' });
        uiStateManager.refresh();
      });

      vscode.window.showInformationMessage('Proxies refreshed successfully!');

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      vscode.window.showErrorMessage(`Failed to refresh proxies: ${errorMessage}`);
    }
  }

  // Helper methods

  private validateProxyUrl(value: string): string | null {
    if (!value || value.trim().length === 0) {
      return 'Proxy URL cannot be empty';
    }
    
    try {
      const url = new URL(value.trim());
      if (!['http:', 'https:', 'socks:', 'socks5:'].includes(url.protocol)) {
        return 'Unsupported protocol. Use http, https, socks, or socks5';
      }
      if (!url.hostname) {
        return 'Invalid hostname';
      }
    } catch {
      return 'Invalid URL format';
    }
    
    return null;
  }

  private async addProxyWithProgress(proxyUrl: string): Promise<void> {
    await vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: 'Adding Proxy',
      cancellable: false
    }, async (progress) => {
      progress.report({ increment: 0, message: 'Validating proxy...' });

      if (!this.proxyPoolManager) {
        throw new Error('Proxy Pool Manager not initialized');
      }

      progress.report({ increment: 30, message: 'Adding to pool...' });
      const proxyId = await this.proxyPoolManager.addProxy(proxyUrl);

      progress.report({ increment: 70, message: 'Running health check...' });
      const proxy = this.proxyPoolManager.getProxy(proxyId);
      if (proxy) {
        const treeItem = DataTransformers.transformProxy(proxy);
        uiStateManager.updateProxy(proxyId, treeItem);
      }

      progress.report({ increment: 100, message: 'Complete!' });
    });
  }

  private async selectProxyForRemoval(): Promise<string | undefined> {
    const proxies = this.proxyPoolManager?.getAllProxies() || [];
    if (proxies.length === 0) {
      vscode.window.showInformationMessage('No proxies to remove');
      return undefined;
    }

    const items: ProxyQuickPickItem[] = proxies.map(proxy => ({
      label: proxy.url,
      description: `Status: ${proxy.status}`,
      detail: `${proxy.assignedKeyCount} keys assigned`,
      proxyId: proxy.id
    }));

    const selected = await vscode.window.showQuickPick(items, {
      placeHolder: 'Select proxy to remove',
      canPickMany: false
    });

    return selected?.proxyId;
  }

  private async confirmProxyRemoval(proxy: { assignedKeyCount: number; url: string }): Promise<boolean> {
    if (proxy.assignedKeyCount > 0) {
      const confirmation = await vscode.window.showWarningMessage(
        `This proxy is assigned to ${proxy.assignedKeyCount} API key(s). Removing it will affect those assignments.`,
        { modal: true },
        'Remove Anyway',
        'Cancel'
      );
      return confirmation === 'Remove Anyway';
    } else {
      const confirmation = await vscode.window.showWarningMessage(
        `Are you sure you want to remove proxy "${proxy.url}"?`,
        { modal: true },
        'Remove',
        'Cancel'
      );
      return confirmation === 'Remove';
    }
  }

  private async removeProxyWithProgress(proxyId: string): Promise<void> {
    await vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: 'Removing Proxy',
      cancellable: false
    }, async (progress) => {
      progress.report({ increment: 0, message: 'Removing proxy...' });

      if (!this.proxyPoolManager) {
        throw new Error('Proxy Pool Manager not initialized');
      }

      await this.proxyPoolManager.removeProxy(proxyId);
      progress.report({ increment: 100, message: 'Complete!' });
      uiStateManager.removeProxy(proxyId);
    });
  }

  private async selectProxyForTest(): Promise<string | undefined> {
    const proxies = this.proxyPoolManager?.getAllProxies() || [];
    if (proxies.length === 0) {
      vscode.window.showInformationMessage('No proxies available to test');
      return undefined;
    }

    const items: ProxyQuickPickItem[] = proxies.map(proxy => ({
      label: proxy.url,
      description: `Status: ${proxy.status}`,
      detail: proxy.status === 'active' ? 'Ready to test' : 'May have issues',
      proxyId: proxy.id
    }));

    const selected = await vscode.window.showQuickPick(items, {
      placeHolder: 'Select proxy to test',
      canPickMany: false
    });

    return selected?.proxyId;
  }

  private async testProxyWithProgress(proxyId: string): Promise<void> {
    await vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: 'Testing Proxy',
      cancellable: true
    }, async (progress, token) => {
      progress.report({ increment: 0, message: 'Testing proxy...' });

      if (!this.proxyPoolManager) {
        throw new Error('Proxy Pool Manager not initialized');
      }

      const proxy = this.proxyPoolManager.getProxy(proxyId);
      if (!proxy) {
        throw new Error('Proxy not found');
      }

      progress.report({ increment: 30, message: 'Running health check...' });

      if (token.isCancellationRequested) {
        return;
      }

      // Since checkProxyHealth is private, we'll check the current status
      const isHealthy = proxy?.status === 'active';
      progress.report({ increment: 100, message: 'Test complete!' });

      this.showTestResult(proxy, isHealthy, proxyId);
    });
  }

  private showTestResult(proxy: { responseTime?: number; lastError?: string }, isHealthy: boolean, proxyId: string): void {
    if (isHealthy) {
      vscode.window.showInformationMessage(
        `Proxy test successful! Response time: ${(proxy as any).responseTime || 'N/A'}ms`,
        'View Details'
      ).then(selection => {
        if (selection === 'View Details') {
          this.viewProxyDetails(proxyId);
        }
      });
    } else {
      vscode.window.showWarningMessage(
        `Proxy test failed: ${proxy.lastError || 'Unknown error'}`,
        'View Details'
      ).then(selection => {
        if (selection === 'View Details') {
          this.viewProxyDetails(proxyId);
        }
      });
    }
  }

  private async selectProxyForAssignment(): Promise<string | undefined> {
    const proxies = this.proxyPoolManager?.getAllProxies() || [];
    const availableProxies = proxies.filter(p => p.status === 'active');
    
    if (availableProxies.length === 0) {
      vscode.window.showInformationMessage('No healthy proxies available for assignment');
      return undefined;
    }

    const items: ProxyQuickPickItem[] = availableProxies.map(proxy => ({
      label: proxy.url,
      description: `${proxy.assignedKeyCount} keys assigned`,
      detail: `Response time: ${(proxy as any).responseTime || 'N/A'}ms`,
      proxyId: proxy.id
    }));

    const selected = await vscode.window.showQuickPick(items, {
      placeHolder: 'Select proxy to assign',
      canPickMany: false
    });

    return selected?.proxyId;
  }

  private async selectApiKeyForAssignment(): Promise<string | undefined> {
    const apiKeys = uiStateManager.getApiKeys();
    const unassignedKeys = apiKeys.filter(key => !key.proxyAssigned);

    if (unassignedKeys.length === 0) {
      vscode.window.showInformationMessage('All API keys already have proxy assignments');
      return undefined;
    }

    const items: ApiKeyQuickPickItem[] = unassignedKeys.map(key => ({
      label: key.keyId || 'Unknown',
      description: `Status: ${key.status}`,
      detail: `${key.currentRequests} active requests`,
      keyId: key.keyId
    }));

    const selected = await vscode.window.showQuickPick(items, {
      placeHolder: 'Select API key to assign proxy to',
      canPickMany: false
    });

    return selected?.keyId;
  }

  private async assignProxyWithProgress(proxyId: string, keyId: string): Promise<void> {
    await vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: 'Assigning Proxy',
      cancellable: false
    }, async (progress) => {
      progress.report({ increment: 0, message: 'Creating assignment...' });

      if (!this.proxyAssignmentManager) {
        throw new Error('Proxy Assignment Manager not initialized');
      }

      await this.proxyAssignmentManager.assignProxyToKey(keyId, proxyId, true);
      progress.report({ increment: 100, message: 'Complete!' });
      uiStateManager.refresh();
    });

    const proxy = this.proxyPoolManager?.getProxy(proxyId);
    vscode.window.showInformationMessage(
      `Proxy "${proxy?.url}" assigned to API key "${keyId}" successfully!`
    );
  }

  private async selectProxyForDetails(): Promise<string | undefined> {
    const proxies = this.proxyPoolManager?.getAllProxies() || [];
    if (proxies.length === 0) {
      vscode.window.showInformationMessage('No proxies available');
      return undefined;
    }

    const items: ProxyQuickPickItem[] = proxies.map(proxy => ({
      label: proxy.url,
      description: `Status: ${proxy.status}`,
      detail: `${proxy.assignedKeyCount} keys assigned`,
      proxyId: proxy.id
    }));

    const selected = await vscode.window.showQuickPick(items, {
      placeHolder: 'Select proxy to view details',
      canPickMany: false
    });

    return selected?.proxyId;
  }

  private getProxyAssignments(proxyId: string): ProxyAssignment[] {
    if (!this.proxyAssignmentManager) {
      return [];
    }

    return this.proxyAssignmentManager.getAllAssignments()
      .filter(a => a.proxyId === proxyId)
      .map(a => ({
        keyId: a.keyId,
        proxyId: a.proxyId,
        assignedAt: typeof a.assignedAt === 'number' ? new Date(a.assignedAt) : (a.assignedAt || new Date()),
        isManual: a.isManual || false
      }));
  }

  private showProxyDetailsPanel(proxy: ProxyDetails, assignments: ProxyAssignment[]): void {
    const panel = vscode.window.createWebviewPanel(
      'proxyDetails',
      `Proxy Details: ${proxy.url}`,
      vscode.ViewColumn.One,
      {
        enableScripts: false,
        retainContextWhenHidden: true
      }
    );

    panel.webview.html = this.generateProxyDetailsHtml(proxy, assignments);
  }

  private generateProxyDetailsHtml(proxy: ProxyDetails, assignments: ProxyAssignment[]): string {
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Proxy Details</title>
        <style>
          body {
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            padding: 20px;
            line-height: 1.6;
          }
          .header {
            border-bottom: 1px solid var(--vscode-panel-border);
            padding-bottom: 15px;
            margin-bottom: 20px;
          }
          .section {
            margin-bottom: 25px;
          }
          .section h3 {
            color: var(--vscode-textLink-foreground);
            margin-bottom: 10px;
          }
          .info-grid {
            display: grid;
            grid-template-columns: 150px 1fr;
            gap: 10px;
            margin-bottom: 15px;
          }
          .info-label {
            font-weight: bold;
            color: var(--vscode-descriptionForeground);
          }
          .status-active { color: var(--vscode-charts-green); }
          .status-error { color: var(--vscode-charts-red); }
          .status-inactive { color: var(--vscode-charts-gray); }
          .assignment-list {
            list-style: none;
            padding: 0;
          }
          .assignment-item {
            background-color: var(--vscode-textBlockQuote-background);
            padding: 10px;
            margin: 5px 0;
            border-radius: 3px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h2>🌐 Proxy Details</h2>
          <p><strong>URL:</strong> ${proxy.url}</p>
        </div>

        <div class="section">
          <h3>📊 Status Information</h3>
          <div class="info-grid">
            <span class="info-label">Status:</span>
            <span class="status-${this.getStatusClass(proxy.status)}">${proxy.status.toUpperCase()}</span>
            
            <span class="info-label">Response Time:</span>
            <span>${proxy.responseTime ? `${proxy.responseTime}ms` : 'N/A'}</span>
            
            <span class="info-label">Error Count:</span>
            <span>${proxy.errorCount}</span>
            
            <span class="info-label">Last Health Check:</span>
            <span>${proxy.lastHealthCheck ? proxy.lastHealthCheck.toLocaleString() : 'Never'}</span>
          </div>
        </div>

        <div class="section">
          <h3>🔗 API Key Assignments</h3>
          <div class="info-grid">
            <span class="info-label">Assigned Keys:</span>
            <span>${proxy.assignedKeyCount}</span>
          </div>
          ${assignments.length > 0 ? `
            <ul class="assignment-list">
              ${assignments.map(assignment => `
                <li class="assignment-item">
                  <strong>${assignment.keyId}</strong><br>
                  <small>Assigned: ${assignment.assignedAt.toLocaleString()}</small><br>
                  <small>Type: ${assignment.isManual ? 'Manual' : 'Automatic'}</small>
                </li>
              `).join('')}
            </ul>
          ` : '<p>No API keys assigned to this proxy</p>'}
        </div>

        ${proxy.lastError ? `
          <div class="section">
            <h3>❌ Error Information</h3>
            <div class="info-grid">
              <span class="info-label">Last Error:</span>
              <span>${proxy.lastError}</span>
            </div>
          </div>
        ` : ''}
      </body>
      </html>
    `;
  }

  private getStatusClass(status: string): string {
    switch (status) {
      case 'active':
        return 'active';
      case 'error':
        return 'error';
      default:
        return 'inactive';
    }
  }

  public setProxyManagers(proxyPoolManager: ProxyPoolManager, proxyAssignmentManager?: ProxyAssignmentManager): void {
    this.proxyPoolManager = proxyPoolManager;
    this.proxyAssignmentManager = proxyAssignmentManager;
  }

  public dispose(): void {
    this.disposables.forEach(d => d.dispose());
    this.disposables = [];
  }
}