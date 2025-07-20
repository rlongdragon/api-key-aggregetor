import * as vscode from 'vscode';
import { RotatingProxyHealthMonitor } from '../../server/core/RotatingProxyHealthMonitor';
import { uiStateManager } from './UIStateManager';
import { uiEventManager } from './UIEventManager';

/**
 * Service to integrate rotating proxy health monitoring with UI
 */
export class RotatingProxyUIService {
  private healthMonitor?: RotatingProxyHealthMonitor;
  private updateInterval?: NodeJS.Timeout;
  private isActive: boolean = false;

  constructor() {
    this.setupEventListeners();
  }

  /**
   * Initialize the service with health monitor
   */
  public initialize(healthMonitor: RotatingProxyHealthMonitor): void {
    this.healthMonitor = healthMonitor;
    this.startPeriodicUpdates();
  }

  /**
   * Start periodic health status updates
   */
  private startPeriodicUpdates(): void {
    if (this.isActive || !this.healthMonitor) {
      return;
    }

    this.isActive = true;
    console.log('RotatingProxyUIService: Starting periodic health updates');

    // Update immediately
    this.updateHealthStatus();

    // Schedule periodic updates every 30 seconds
    this.updateInterval = setInterval(() => {
      this.updateHealthStatus();
    }, 30000);
  }

  /**
   * Stop periodic updates
   */
  public stop(): void {
    if (!this.isActive) {
      return;
    }

    this.isActive = false;
    console.log('RotatingProxyUIService: Stopping periodic health updates');

    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = undefined;
    }
  }

  /**
   * Update health status in UI state
   */
  private async updateHealthStatus(): Promise<void> {
    if (!this.healthMonitor) {
      return;
    }

    try {
      const healthStatus = await this.healthMonitor.getHealthStatus();
      const stats = await this.healthMonitor.getStats();

      // Combine health status and stats for UI
      const uiHealthStatus = {
        isHealthy: healthStatus.isHealthy,
        lastCheck: healthStatus.lastCheck,
        responseTime: healthStatus.responseTime,
        errorCount: healthStatus.errorCount,
        uptime: healthStatus.uptime,
        lastError: healthStatus.lastError,
        totalRequests: stats.totalRequests,
        successfulRequests: stats.successfulRequests,
        failedRequests: stats.failedRequests,
        averageResponseTime: stats.averageResponseTime,
        requestsPerMinute: stats.requestsPerMinute,
        errorRate: stats.errorRate
      };

      // Update UI state
      uiStateManager.updateRotatingProxyHealth(uiHealthStatus);

      console.log('RotatingProxyUIService: Updated health status -', {
        healthy: healthStatus.isHealthy,
        uptime: healthStatus.uptime,
        errorCount: healthStatus.errorCount,
        responseTime: healthStatus.responseTime
      });

    } catch (error) {
      console.error('RotatingProxyUIService: Error updating health status:', error);
      
      // Set error state in UI
      uiStateManager.updateRotatingProxyHealth({
        isHealthy: false,
        lastCheck: new Date(),
        errorCount: 999,
        uptime: 0,
        lastError: 'Failed to get health status'
      });
    }
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    // Listen for rotating proxy mode changes
    uiEventManager.on('rotatingProxyModeChanged', (data) => {
      if (data.enabled && this.healthMonitor) {
        this.startPeriodicUpdates();
      } else {
        this.stop();
      }
    });

    // Listen for manual refresh requests
    uiEventManager.on('refreshRequested', () => {
      if (this.isActive) {
        this.updateHealthStatus();
      }
    });
  }

  /**
   * Force an immediate health status update
   */
  public async forceUpdate(): Promise<void> {
    await this.updateHealthStatus();
  }

  /**
   * Check if service is active
   */
  public isServiceActive(): boolean {
    return this.isActive;
  }

  /**
   * Get current health monitor
   */
  public getHealthMonitor(): RotatingProxyHealthMonitor | undefined {
    return this.healthMonitor;
  }
}

// Export singleton instance
export const rotatingProxyUIService = new RotatingProxyUIService();