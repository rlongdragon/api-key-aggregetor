import * as vscode from 'vscode';
import { ServerStatus, ICONS, ApiKeyTreeItem, ProxyTreeItem } from '../types/TreeViewTypes';
import { uiEventManager } from './UIEventManager';
import { uiStateManager } from './UIStateManager';
import { themeService } from './ThemeService';

/**
 * Manages VS Code status bar items for the Gemini Proxy extension
 * Displays server status, request counts, and proxy health information
 */
export class StatusBarManager {
  private serverStatusItem: vscode.StatusBarItem;
  private requestCountItem: vscode.StatusBarItem;
  private healthStatusItem: vscode.StatusBarItem;
  private disposables: vscode.Disposable[] = [];

  constructor() {
    // Create status bar items with appropriate priorities
    this.serverStatusItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left, 
      100
    );
    this.requestCountItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left, 
      99
    );
    this.healthStatusItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left, 
      98
    );

    this.setupStatusBarItems();
    this.setupEventListeners();
    this.setupThemeListener();
    this.updateFromCurrentState();
  }

  /**
   * Initialize status bar items with default values and commands
   */
  private setupStatusBarItems(): void {
    // Server status item - will toggle between start/stop based on current state
    this.serverStatusItem.command = 'geminiAggregator.toggleServer';
    this.serverStatusItem.tooltip = 'Click to start/stop server';
    
    // Request count item
    this.requestCountItem.command = 'geminiAggregator.showLogs';
    this.requestCountItem.tooltip = 'Click to view request logs';
    
    // Health status item
    this.healthStatusItem.command = 'geminiAggregator.refreshAll';
    this.healthStatusItem.tooltip = 'Click to refresh proxy health status';
  }

  /**
   * Set up event listeners for state changes
   */
  private setupEventListeners(): void {
    // Listen for server status changes
    const serverStatusDisposable = uiEventManager.on('serverStatusChanged', (data) => {
      this.updateServerStatus(data.status);
      this.handleServerStatusNotifications(data.status);
    });

    // Listen for API key events
    const apiKeyAddedDisposable = uiEventManager.on('apiKeyAdded', (data) => {
      this.updateFromCurrentState();
      this.showInfoNotification(`API Key added: ${data.keyId}`);
    });

    const apiKeyRemovedDisposable = uiEventManager.on('apiKeyRemoved', (data) => {
      this.updateFromCurrentState();
      this.showInfoNotification(`API Key removed: ${data.keyId}`);
    });

    const apiKeyUpdatedDisposable = uiEventManager.on('apiKeyUpdated', (data) => {
      this.updateFromCurrentState();
      this.handleApiKeyStatusNotifications(data.item);
    });

    // Listen for proxy events
    const proxyAddedDisposable = uiEventManager.on('proxyAdded', (data) => {
      this.updateFromCurrentState();
      this.showInfoNotification(`Proxy added: ${data.item.url || data.proxyId}`);
    });

    const proxyRemovedDisposable = uiEventManager.on('proxyRemoved', (data) => {
      this.updateFromCurrentState();
      this.showInfoNotification(`Proxy removed: ${data.proxyId}`);
    });

    const proxyUpdatedDisposable = uiEventManager.on('proxyUpdated', (data) => {
      this.updateFromCurrentState();
      this.handleProxyStatusNotifications(data.item);
    });

    // Listen for general refresh events to update all status items
    const refreshDisposable = uiEventManager.on('refreshRequested', () => {
      this.updateFromCurrentState();
    });

    this.disposables.push(
      serverStatusDisposable,
      apiKeyAddedDisposable,
      apiKeyRemovedDisposable,
      apiKeyUpdatedDisposable,
      proxyAddedDisposable,
      proxyRemovedDisposable,
      proxyUpdatedDisposable,
      refreshDisposable
    );
  }

  /**
   * Set up theme change listener
   */
  private setupThemeListener(): void {
    const themeDisposable = themeService.onThemeChange(() => {
      // Update status bar items when theme changes
      this.updateFromCurrentState();
    });

    this.disposables.push(themeDisposable);
  }

  /**
   * Update server status display
   */
  public updateServerStatus(status: ServerStatus): void {
    if (status.isRunning) {
      this.serverStatusItem.text = `$(server-process) Gemini Proxy: Running`;
      themeService.applyStatusBarTheme(this.serverStatusItem, 'success');
      
      if (status.port) {
        this.serverStatusItem.tooltip = `Server running on port ${status.port}. Click to stop.`;
      }
    } else {
      this.serverStatusItem.text = `$(server-process) Gemini Proxy: Stopped`;
      themeService.applyStatusBarTheme(this.serverStatusItem, 'warning');
      this.serverStatusItem.tooltip = 'Server is stopped. Click to start.';
    }

    if (status.lastError) {
      this.serverStatusItem.text = `$(server-process) Gemini Proxy: Error`;
      themeService.applyStatusBarTheme(this.serverStatusItem, 'error');
      this.serverStatusItem.tooltip = `Server error: ${status.lastError}. Click to restart.`;
    }

    this.updateRequestCount(status.totalRequests, status.activeConnections);
  }

  /**
   * Update request count display
   */
  public updateRequestCount(totalRequests: number, activeConnections?: number): void {
    if (activeConnections !== undefined && activeConnections > 0) {
      this.requestCountItem.text = `$(pulse) ${totalRequests} requests (${activeConnections} active)`;
      this.requestCountItem.tooltip = `Total requests: ${totalRequests}, Active connections: ${activeConnections}`;
    } else {
      this.requestCountItem.text = `$(history) ${totalRequests} requests`;
      this.requestCountItem.tooltip = `Total requests processed: ${totalRequests}`;
    }
  }

  /**
   * Update proxy health status display
   */
  public updateHealthStatus(healthyCount: number, totalCount: number): void {
    if (totalCount === 0) {
      this.healthStatusItem.text = `$(globe) No proxies`;
      themeService.applyStatusBarTheme(this.healthStatusItem, 'info');
      this.healthStatusItem.tooltip = 'No proxies configured';
      return;
    }

    const isAllHealthy = healthyCount === totalCount;

    if (isAllHealthy) {
      this.healthStatusItem.text = `$(check) ${healthyCount}/${totalCount} proxies healthy`;
      themeService.applyStatusBarTheme(this.healthStatusItem, 'success');
      this.healthStatusItem.tooltip = 'All proxies are healthy';
    } else if (healthyCount > 0) {
      this.healthStatusItem.text = `$(warning) ${healthyCount}/${totalCount} proxies healthy`;
      themeService.applyStatusBarTheme(this.healthStatusItem, 'warning');
      this.healthStatusItem.tooltip = `${totalCount - healthyCount} proxies are unhealthy`;
    } else {
      this.healthStatusItem.text = `$(error) 0/${totalCount} proxies healthy`;
      themeService.applyStatusBarTheme(this.healthStatusItem, 'error');
      this.healthStatusItem.tooltip = 'All proxies are unhealthy';
    }
  }

  /**
   * Update all status items from current state
   */
  private updateFromCurrentState(): void {
    const state = uiStateManager.getState();
    
    // Update server status
    this.updateServerStatus(state.serverStatus);
    
    // Track API key state changes
    state.apiKeys.forEach(apiKey => {
      if (apiKey.keyId) {
        this.previousApiKeyStates.set(apiKey.keyId, apiKey.status);
      }
    });
    
    // Track proxy state changes
    state.proxies.forEach(proxy => {
      if (proxy.proxyId) {
        this.previousProxyStates.set(proxy.proxyId, proxy.status);
      }
    });
    
    // Calculate proxy health statistics
    const proxies = state.proxies;
    const totalProxies = proxies.length;
    const healthyProxies = proxies.filter(p => 
      p.status === 'active' && 
      p.healthStatus?.isHealthy !== false
    ).length;
    
    this.updateHealthStatus(healthyProxies, totalProxies);
    
    // Clear health check timeouts for completed checks
    proxies.forEach(proxy => {
      if (proxy.proxyId && proxy.status !== 'checking') {
        const timeout = this.healthCheckTimeouts.get(proxy.proxyId);
        if (timeout) {
          clearTimeout(timeout);
          this.healthCheckTimeouts.delete(proxy.proxyId);
        }
      }
    });
  }

  /**
   * Show all status bar items
   */
  public show(): void {
    this.serverStatusItem.show();
    this.requestCountItem.show();
    this.healthStatusItem.show();
  }

  /**
   * Hide all status bar items
   */
  public hide(): void {
    this.serverStatusItem.hide();
    this.requestCountItem.hide();
    this.healthStatusItem.hide();
  }

  /**
   * Show rate limit warning notification
   */
  public showRateLimitWarning(keyId: string, remainingRequests: number): void {
    const message = `API Key ${keyId} is approaching rate limit. ${remainingRequests} requests remaining.`;
    vscode.window.showWarningMessage(message, 'View Details', 'Dismiss').then(selection => {
      if (selection === 'View Details') {
        vscode.commands.executeCommand('geminiAggregator.viewApiKeyDetails', keyId);
      }
    });
  }

  /**
   * Show error notification
   */
  public showErrorNotification(title: string, error: string, actions?: string[]): void {
    const message = `${title}: ${error}`;
    if (actions && actions.length > 0) {
      vscode.window.showErrorMessage(message, ...actions).then(selection => {
        if (selection) {
          // Handle action selection based on the action text
          switch (selection) {
            case 'Restart Server':
              vscode.commands.executeCommand('geminiAggregator.restartServer');
              break;
            case 'View Logs':
              vscode.commands.executeCommand('geminiAggregator.showLogs');
              break;
            case 'Refresh':
              vscode.commands.executeCommand('geminiAggregator.refreshAll');
              break;
          }
        }
      });
    } else {
      vscode.window.showErrorMessage(message);
    }
  }

  /**
   * Show information notification
   */
  public showInfoNotification(message: string): void {
    vscode.window.showInformationMessage(message);
  }

  /**
   * Handle server status change notifications
   */
  private handleServerStatusNotifications(status: ServerStatus): void {
    if (status.lastError) {
      this.showErrorNotification(
        'Server Error',
        status.lastError,
        ['Restart Server', 'View Logs']
      );
    } else if (status.isRunning && status.port) {
      // Only show startup notification once, not on every status update
      const currentTime = Date.now();
      if (!this.lastServerStartNotification || currentTime - this.lastServerStartNotification > 30000) {
        this.showInfoNotification(`Gemini Proxy server started on port ${status.port}`);
        this.lastServerStartNotification = currentTime;
      }
    }
  }

  /**
   * Handle API key status change notifications
   */
  private handleApiKeyStatusNotifications(apiKey: ApiKeyTreeItem): void {
    switch (apiKey.status) {
      case 'rate_limited':
        this.showRateLimitWarning(
          apiKey.keyId || 'Unknown',
          this.estimateRemainingRequests(apiKey)
        );
        break;
      
      case 'error':
        this.showErrorNotification(
          'API Key Error',
          `API Key ${apiKey.keyId} encountered an error`,
          ['View Details', 'Test Key']
        );
        break;
      
      case 'inactive':
        // Only show notification if key was previously active
        if (this.wasKeyPreviouslyActive(apiKey.keyId || '')) {
          vscode.window.showWarningMessage(
            `API Key ${apiKey.keyId} is now inactive`,
            'View Details'
          ).then(selection => {
            if (selection === 'View Details') {
              vscode.commands.executeCommand('geminiAggregator.viewApiKeyDetails', apiKey.keyId);
            }
          });
        }
        break;
    }
  }

  /**
   * Handle proxy status change notifications
   */
  private handleProxyStatusNotifications(proxy: ProxyTreeItem): void {
    switch (proxy.status) {
      case 'error':
        const assignedKeyCount = proxy.assignedKeys?.length || 0;
        if (assignedKeyCount > 0) {
          this.showErrorNotification(
            'Proxy Error',
            `Proxy ${proxy.url || proxy.proxyId} failed with ${assignedKeyCount} assigned keys`,
            ['Reassign Keys', 'Test Proxy', 'View Details']
          );
        } else {
          vscode.window.showWarningMessage(
            `Proxy ${proxy.url || proxy.proxyId} is experiencing issues`,
            'Test Proxy'
          ).then(selection => {
            if (selection === 'Test Proxy') {
              vscode.commands.executeCommand('geminiAggregator.testProxy', proxy.proxyId);
            }
          });
        }
        break;
      
      case 'active':
        // Only show recovery notification if proxy was previously in error state
        if (this.wasProxyPreviouslyInError(proxy.proxyId || '')) {
          this.showInfoNotification(`Proxy ${proxy.url || proxy.proxyId} has recovered`);
        }
        break;
      
      case 'checking':
        // Don't show notifications for health checks unless they take too long
        this.scheduleHealthCheckTimeout(proxy.proxyId || '');
        break;
    }
  }

  // Private fields for tracking state
  private lastServerStartNotification?: number;
  private previousApiKeyStates = new Map<string, string>();
  private previousProxyStates = new Map<string, string>();
  private healthCheckTimeouts = new Map<string, NodeJS.Timeout>();

  /**
   * Check if API key was previously active
   */
  private wasKeyPreviouslyActive(keyId: string): boolean {
    const previousState = this.previousApiKeyStates.get(keyId);
    this.previousApiKeyStates.set(keyId, 'inactive');
    return previousState === 'active';
  }

  /**
   * Check if proxy was previously in error state
   */
  private wasProxyPreviouslyInError(proxyId: string): boolean {
    const previousState = this.previousProxyStates.get(proxyId);
    this.previousProxyStates.set(proxyId, 'active');
    return previousState === 'error';
  }

  /**
   * Estimate remaining requests for rate limited key
   */
  private estimateRemainingRequests(apiKey: ApiKeyTreeItem): number {
    // This is a simplified estimation - in a real implementation,
    // you would get this from the actual rate limit headers
    const totalRequests = apiKey.usageStats?.totalRequests || 0;
    const estimatedLimit = 1000; // Gemini API typical limit
    return Math.max(0, estimatedLimit - totalRequests);
  }

  /**
   * Schedule timeout for health check notifications
   */
  private scheduleHealthCheckTimeout(proxyId: string): void {
    // Clear existing timeout
    const existingTimeout = this.healthCheckTimeouts.get(proxyId);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    // Set new timeout for 30 seconds
    const timeout = setTimeout(() => {
      vscode.window.showWarningMessage(
        `Health check for proxy ${proxyId} is taking longer than expected`,
        'Cancel Check'
      ).then(selection => {
        if (selection === 'Cancel Check') {
          // In a real implementation, you would cancel the health check
          this.showInfoNotification('Health check cancelled');
        }
      });
      this.healthCheckTimeouts.delete(proxyId);
    }, 30000);

    this.healthCheckTimeouts.set(proxyId, timeout);
  }

  /**
   * Dispose all resources
   */
  public dispose(): void {
    this.serverStatusItem.dispose();
    this.requestCountItem.dispose();
    this.healthStatusItem.dispose();
    this.disposables.forEach(d => d.dispose());
    this.disposables = [];
    
    // Clear all timeouts
    this.healthCheckTimeouts.forEach(timeout => clearTimeout(timeout));
    this.healthCheckTimeouts.clear();
    
    // Clear state tracking
    this.previousApiKeyStates.clear();
    this.previousProxyStates.clear();
  }
}
/**

 * Global status bar manager instance
 */
export const statusBarManager = new StatusBarManager();