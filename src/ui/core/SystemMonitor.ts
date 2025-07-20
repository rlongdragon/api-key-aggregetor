import * as vscode from 'vscode';
import { uiStateManager } from './UIStateManager';
import { notificationService } from './NotificationService';
import { ApiKeyTreeItem, ProxyTreeItem } from '../types/TreeViewTypes';

/**
 * System monitor for automatic detection of issues and performance problems
 */
export class SystemMonitor {
  private monitoringInterval?: NodeJS.Timeout;
  private isMonitoring = false;
  private readonly MONITORING_INTERVAL_MS = 30000; // 30 seconds
  
  // Thresholds for notifications
  private readonly RATE_LIMIT_WARNING_THRESHOLD = 0.8; // 80% of quota
  private readonly ERROR_RATE_THRESHOLD = 0.3; // 30% error rate
  private readonly RESPONSE_TIME_THRESHOLD = 5000; // 5 seconds
  private readonly CONSECUTIVE_ERRORS_THRESHOLD = 3;
  
  // State tracking
  private apiKeyErrorCounts = new Map<string, number>();
  private proxyErrorCounts = new Map<string, number>();
  private lastHealthyStates = new Map<string, boolean>();

  /**
   * Start monitoring system health
   */
  public startMonitoring(): void {
    if (this.isMonitoring) {
      return;
    }
    
    this.isMonitoring = true;
    this.monitoringInterval = setInterval(() => {
      this.performHealthCheck();
    }, this.MONITORING_INTERVAL_MS);
    
    console.log('SystemMonitor: Started monitoring system health');
  }

  /**
   * Stop monitoring
   */
  public stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }
    
    this.isMonitoring = false;
    console.log('SystemMonitor: Stopped monitoring system health');
  }

  /**
   * Perform comprehensive health check
   */
  private performHealthCheck(): void {
    const state = uiStateManager.getState();
    
    // Check server health
    this.checkServerHealth(state.serverStatus);
    
    // Check API key health
    state.apiKeys.forEach(apiKey => this.checkApiKeyHealth(apiKey));
    
    // Check proxy health
    state.proxies.forEach(proxy => this.checkProxyHealth(proxy));
    
    // Check overall system performance
    this.checkSystemPerformance(state);
    
    // Clean up old notification throttling
    notificationService.cleanup();
  }

  /**
   * Check server health and performance
   */
  private checkServerHealth(serverStatus: any): void {
    if (!serverStatus.isRunning) {
      notificationService.showServerError('Server is not running');
      return;
    }
    
    if (serverStatus.lastError) {
      notificationService.showServerError(serverStatus.lastError);
    }
    
    // Check for high connection count
    if (serverStatus.activeConnections > 50) {
      notificationService.showPerformanceWarning(
        `High connection count: ${serverStatus.activeConnections} active connections`,
        ['View Details', 'Scale Up']
      );
    }
  }

  /**
   * Check API key health and usage
   */
  private checkApiKeyHealth(apiKey: ApiKeyTreeItem): void {
    if (!apiKey.keyId) return;
    
    const keyId = apiKey.keyId;
    
    // Check for rate limiting
    if (apiKey.status === 'rate_limited') {
      const remainingRequests = this.estimateRemainingRequests(apiKey);
      notificationService.showRateLimitWarning(keyId, remainingRequests);
    }
    
    // Check for errors
    if (apiKey.status === 'error') {
      const errorCount = this.apiKeyErrorCounts.get(keyId) || 0;
      this.apiKeyErrorCounts.set(keyId, errorCount + 1);
      
      if (errorCount >= this.CONSECUTIVE_ERRORS_THRESHOLD) {
        notificationService.showApiKeyError(
          keyId,
          `Key has failed ${errorCount} consecutive times`
        );
      }
    } else {
      // Reset error count on success
      this.apiKeyErrorCounts.set(keyId, 0);
    }
    
    // Check quota usage
    if (apiKey.usageStats) {
      const usagePercentage = this.calculateUsagePercentage(apiKey.usageStats);
      if (usagePercentage >= this.RATE_LIMIT_WARNING_THRESHOLD * 100) {
        notificationService.showQuotaWarning(keyId, Math.round(usagePercentage));
      }
    }
    
    // Check for recovery
    const wasHealthy = this.lastHealthyStates.get(`apikey-${keyId}`);
    const isHealthy = apiKey.status === 'active';
    
    if (!wasHealthy && isHealthy) {
      notificationService.showRecoveryNotification('apikey', keyId);
    }
    
    this.lastHealthyStates.set(`apikey-${keyId}`, isHealthy);
  }

  /**
   * Check proxy health and performance
   */
  private checkProxyHealth(proxy: ProxyTreeItem): void {
    if (!proxy.proxyId) return;
    
    const proxyId = proxy.proxyId;
    const proxyName = proxy.url || proxyId;
    
    // Check for errors
    if (proxy.status === 'error') {
      const errorCount = this.proxyErrorCounts.get(proxyId) || 0;
      this.proxyErrorCounts.set(proxyId, errorCount + 1);
      
      const assignedKeyCount = proxy.assignedKeys?.length || 0;
      
      if (errorCount >= this.CONSECUTIVE_ERRORS_THRESHOLD) {
        notificationService.showProxyError(
          proxyName,
          `Proxy has failed ${errorCount} consecutive times`,
          assignedKeyCount
        );
      }
    } else {
      // Reset error count on success
      this.proxyErrorCounts.set(proxyId, 0);
    }
    
    // Check response time
    if (proxy.healthStatus?.responseTime && 
        proxy.healthStatus.responseTime > this.RESPONSE_TIME_THRESHOLD) {
      notificationService.showPerformanceWarning(
        `Proxy ${proxyName} has high response time: ${proxy.healthStatus.responseTime}ms`,
        ['Test Proxy', 'View Details']
      );
    }
    
    // Check for recovery
    const wasHealthy = this.lastHealthyStates.get(`proxy-${proxyId}`);
    const isHealthy = proxy.status === 'active' && proxy.healthStatus?.isHealthy !== false;
    
    if (!wasHealthy && isHealthy) {
      notificationService.showRecoveryNotification('proxy', proxyName);
    }
    
    this.lastHealthyStates.set(`proxy-${proxyId}`, isHealthy);
  }

  /**
   * Check overall system performance
   */
  private checkSystemPerformance(state: any): void {
    const totalApiKeys = state.apiKeys.length;
    const activeApiKeys = state.apiKeys.filter((k: ApiKeyTreeItem) => k.status === 'active').length;
    const totalProxies = state.proxies.length;
    const activeProxies = state.proxies.filter((p: ProxyTreeItem) => p.status === 'active').length;
    
    // Check if too many keys are inactive
    if (totalApiKeys > 0 && activeApiKeys / totalApiKeys < 0.5) {
      notificationService.showPerformanceWarning(
        `Only ${activeApiKeys}/${totalApiKeys} API keys are active`,
        ['View Details', 'Test Keys']
      );
    }
    
    // Check if too many proxies are down
    if (totalProxies > 0 && activeProxies / totalProxies < 0.5) {
      notificationService.showPerformanceWarning(
        `Only ${activeProxies}/${totalProxies} proxies are healthy`,
        ['View Details', 'Test Proxies']
      );
    }
    
    // Check if no proxies are configured but we have many keys
    if (totalApiKeys > 3 && totalProxies === 0) {
      notificationService.showPerformanceWarning(
        'Consider adding proxies for better performance with multiple API keys',
        ['Add Proxies', 'Learn More']
      );
    }
  }

  /**
   * Estimate remaining requests for an API key
   */
  private estimateRemainingRequests(apiKey: ApiKeyTreeItem): number {
    // This is a simplified estimation
    const totalRequests = apiKey.usageStats?.totalRequests || 0;
    const estimatedLimit = 1000; // Typical Gemini API limit
    return Math.max(0, estimatedLimit - totalRequests);
  }

  /**
   * Calculate usage percentage for an API key
   */
  private calculateUsagePercentage(usageStats: any): number {
    const totalRequests = usageStats.totalRequests || 0;
    const estimatedLimit = 1000; // Typical Gemini API limit
    return Math.min(100, (totalRequests / estimatedLimit) * 100);
  }

  /**
   * Get monitoring status
   */
  public isMonitoringActive(): boolean {
    return this.isMonitoring;
  }

  /**
   * Force a health check
   */
  public forceHealthCheck(): void {
    this.performHealthCheck();
  }

  /**
   * Reset all error counts (useful for testing)
   */
  public resetErrorCounts(): void {
    this.apiKeyErrorCounts.clear();
    this.proxyErrorCounts.clear();
    this.lastHealthyStates.clear();
  }

  /**
   * Dispose resources
   */
  public dispose(): void {
    this.stopMonitoring();
    this.resetErrorCounts();
  }
}

/**
 * Global system monitor instance
 */
export const systemMonitor = new SystemMonitor();