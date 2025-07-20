import * as vscode from 'vscode';
import { statusBarManager } from './StatusBarManager';

/**
 * Service for managing system-wide notifications
 * Provides centralized notification handling for the extension
 */
export class NotificationService {
  private static instance: NotificationService;
  private rateLimitNotifications = new Map<string, number>();
  private errorNotifications = new Map<string, number>();
  
  // Notification throttling settings
  private readonly RATE_LIMIT_THROTTLE_MS = 60000; // 1 minute
  private readonly ERROR_THROTTLE_MS = 30000; // 30 seconds

  private constructor() {}

  /**
   * Get singleton instance
   */
  public static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  /**
   * Show rate limit warning with throttling
   */
  public showRateLimitWarning(keyId: string, remainingRequests: number): void {
    const now = Date.now();
    const lastNotification = this.rateLimitNotifications.get(keyId);
    
    // Throttle notifications to avoid spam
    if (lastNotification && now - lastNotification < this.RATE_LIMIT_THROTTLE_MS) {
      return;
    }
    
    this.rateLimitNotifications.set(keyId, now);
    statusBarManager.showRateLimitWarning(keyId, remainingRequests);
  }

  /**
   * Show API key error notification with throttling
   */
  public showApiKeyError(keyId: string, error: string): void {
    const now = Date.now();
    const notificationKey = `apikey-${keyId}`;
    const lastNotification = this.errorNotifications.get(notificationKey);
    
    // Throttle error notifications
    if (lastNotification && now - lastNotification < this.ERROR_THROTTLE_MS) {
      return;
    }
    
    this.errorNotifications.set(notificationKey, now);
    statusBarManager.showErrorNotification(
      'API Key Error',
      `Key ${keyId}: ${error}`,
      ['View Details', 'Test Key', 'Dismiss']
    );
  }

  /**
   * Show proxy error notification with throttling
   */
  public showProxyError(proxyId: string, error: string, assignedKeyCount: number = 0): void {
    const now = Date.now();
    const notificationKey = `proxy-${proxyId}`;
    const lastNotification = this.errorNotifications.get(notificationKey);
    
    // Throttle error notifications
    if (lastNotification && now - lastNotification < this.ERROR_THROTTLE_MS) {
      return;
    }
    
    this.errorNotifications.set(notificationKey, now);
    
    const message = assignedKeyCount > 0 
      ? `Proxy ${proxyId} failed with ${assignedKeyCount} assigned keys: ${error}`
      : `Proxy ${proxyId} error: ${error}`;
    
    const actions = assignedKeyCount > 0 
      ? ['Reassign Keys', 'Test Proxy', 'View Details']
      : ['Test Proxy', 'View Details'];
    
    statusBarManager.showErrorNotification('Proxy Error', message, actions);
  }

  /**
   * Show server error notification
   */
  public showServerError(error: string): void {
    const now = Date.now();
    const notificationKey = 'server-error';
    const lastNotification = this.errorNotifications.get(notificationKey);
    
    // Throttle server error notifications
    if (lastNotification && now - lastNotification < this.ERROR_THROTTLE_MS) {
      return;
    }
    
    this.errorNotifications.set(notificationKey, now);
    statusBarManager.showErrorNotification(
      'Server Error',
      error,
      ['Restart Server', 'View Logs', 'Dismiss']
    );
  }

  /**
   * Show connection recovery notification
   */
  public showRecoveryNotification(type: 'apikey' | 'proxy' | 'server', identifier: string): void {
    let message: string;
    switch (type) {
      case 'apikey':
        message = `API Key ${identifier} has recovered`;
        break;
      case 'proxy':
        message = `Proxy ${identifier} has recovered`;
        break;
      case 'server':
        message = 'Server connection has been restored';
        break;
    }
    
    statusBarManager.showInfoNotification(message);
  }

  /**
   * Show performance warning
   */
  public showPerformanceWarning(message: string, actions?: string[]): void {
    if (actions && actions.length > 0) {
      vscode.window.showWarningMessage(message, ...actions).then(selection => {
        if (selection) {
          this.handlePerformanceAction(selection);
        }
      });
    } else {
      vscode.window.showWarningMessage(message);
    }
  }

  /**
   * Show quota warning
   */
  public showQuotaWarning(keyId: string, usagePercentage: number): void {
    const message = `API Key ${keyId} has used ${usagePercentage}% of its quota`;
    vscode.window.showWarningMessage(
      message,
      'View Usage',
      'Add More Keys'
    ).then(selection => {
      switch (selection) {
        case 'View Usage':
          vscode.commands.executeCommand('geminiAggregator.viewApiKeyDetails', keyId);
          break;
        case 'Add More Keys':
          vscode.commands.executeCommand('geminiAggregator.addApiKey');
          break;
      }
    });
  }

  /**
   * Show maintenance notification
   */
  public showMaintenanceNotification(message: string): void {
    vscode.window.showInformationMessage(
      `🔧 Maintenance: ${message}`,
      'View Status'
    ).then(selection => {
      if (selection === 'View Status') {
        vscode.commands.executeCommand('geminiAggregator.viewServerStatus');
      }
    });
  }

  /**
   * Handle performance action selection
   */
  private handlePerformanceAction(action: string): void {
    switch (action) {
      case 'View Details':
        vscode.commands.executeCommand('geminiAggregator.viewServerStatus');
        break;
      case 'Optimize':
        vscode.commands.executeCommand('geminiAggregator.optimizePerformance');
        break;
      case 'Add Proxies':
        vscode.commands.executeCommand('geminiAggregator.addProxy');
        break;
      case 'Scale Up':
        this.showMaintenanceNotification('Consider adding more API keys or proxies for better performance');
        break;
    }
  }

  /**
   * Clear old notification timestamps to prevent memory leaks
   */
  public cleanup(): void {
    const now = Date.now();
    const maxAge = 300000; // 5 minutes
    
    // Clean up rate limit notifications
    const rateLimitKeys = Array.from(this.rateLimitNotifications.keys());
    for (const key of rateLimitKeys) {
      const timestamp = this.rateLimitNotifications.get(key);
      if (timestamp && now - timestamp > maxAge) {
        this.rateLimitNotifications.delete(key);
      }
    }
    
    // Clean up error notifications
    const errorKeys = Array.from(this.errorNotifications.keys());
    for (const key of errorKeys) {
      const timestamp = this.errorNotifications.get(key);
      if (timestamp && now - timestamp > maxAge) {
        this.errorNotifications.delete(key);
      }
    }
  }

  /**
   * Reset all notification throttling (useful for testing)
   */
  public resetThrottling(): void {
    this.rateLimitNotifications.clear();
    this.errorNotifications.clear();
  }
}

/**
 * Global notification service instance
 */
export const notificationService = NotificationService.getInstance();