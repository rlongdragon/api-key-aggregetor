import { 
  RotatingProxyConfig, 
  RotatingProxyHealthStatus, 
  RotatingProxyStats,
  ROTATING_PROXY_CONSTANTS 
} from '../types/RotatingProxy';
import { ProxyConfigurationManager } from './ProxyConfigurationManager';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { SocksProxyAgent } from 'socks-proxy-agent';
import * as https from 'https';
import * as http from 'http';

/**
 * Monitors the health and performance of rotating proxy endpoints
 */
export class RotatingProxyHealthMonitor {
  private proxyConfigManager: ProxyConfigurationManager;
  private healthCheckInterval?: NodeJS.Timeout;
  private isMonitoring: boolean = false;
  private recentRequests: Array<{ timestamp: number; success: boolean; responseTime?: number }> = [];

  constructor(proxyConfigManager: ProxyConfigurationManager) {
    this.proxyConfigManager = proxyConfigManager;
  }

  /**
   * Start health monitoring
   */
  public startMonitoring(): void {
    if (this.isMonitoring) {
      console.log('RotatingProxyHealthMonitor: Already monitoring');
      return;
    }

    this.isMonitoring = true;
    console.log('RotatingProxyHealthMonitor: Starting health monitoring');

    // Perform initial health check
    this.performHealthCheck();

    // Schedule periodic health checks
    this.healthCheckInterval = setInterval(() => {
      this.performHealthCheck();
    }, ROTATING_PROXY_CONSTANTS.HEALTH_CHECK_INTERVAL);
  }

  /**
   * Stop health monitoring
   */
  public stopMonitoring(): void {
    if (!this.isMonitoring) {
      return;
    }

    this.isMonitoring = false;
    console.log('RotatingProxyHealthMonitor: Stopping health monitoring');

    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = undefined;
    }
  }

  /**
   * Perform a health check on the rotating proxy
   */
  private async performHealthCheck(): Promise<void> {
    if (!this.proxyConfigManager.isRotatingProxyEnabled()) {
      return;
    }

    const proxyUrl = this.proxyConfigManager.getRotatingProxy();
    if (!proxyUrl) {
      return;
    }

    console.log('RotatingProxyHealthMonitor: Performing health check');

    const startTime = Date.now();
    let success = false;
    let error: string | undefined;
    let responseTime: number | undefined;

    try {
      // Test the proxy by making a simple HTTP request
      await this.testProxyConnection(proxyUrl);
      success = true;
      responseTime = Date.now() - startTime;
      console.log(`RotatingProxyHealthMonitor: Health check successful (${responseTime}ms)`);
    } catch (err) {
      error = err instanceof Error ? err.message : 'Unknown error';
      responseTime = Date.now() - startTime;
      console.warn(`RotatingProxyHealthMonitor: Health check failed (${responseTime}ms):`, error);
    }

    // Update configuration with health check results
    await this.updateHealthStatus(success, responseTime, error);

    // Track request for statistics
    this.trackRequest(success, responseTime);
  }

  /**
   * Test proxy connection by making a simple HTTP request
   */
  private async testProxyConnection(proxyUrl: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const agent = this.createProxyAgent(proxyUrl);
      if (!agent) {
        reject(new Error('Failed to create proxy agent'));
        return;
      }

      // Test with a simple HTTP request to a reliable endpoint
      const testUrl = 'https://httpbin.org/ip';
      const options = {
        agent,
        timeout: ROTATING_PROXY_CONSTANTS.HEALTH_CHECK_TIMEOUT
      };

      const request = https.get(testUrl, options, (response) => {
        let data = '';
        
        response.on('data', (chunk) => {
          data += chunk;
        });

        response.on('end', () => {
          if (response.statusCode === 200) {
            try {
              const result = JSON.parse(data);
              if (result.origin) {
                resolve();
              } else {
                reject(new Error('Invalid response format'));
              }
            } catch (parseError) {
              reject(new Error('Failed to parse response'));
            }
          } else {
            reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
          }
        });
      });

      request.on('error', (error) => {
        reject(error);
      });

      request.on('timeout', () => {
        request.destroy();
        reject(new Error('Health check timeout'));
      });
    });
  }

  /**
   * Create appropriate proxy agent
   */
  private createProxyAgent(proxyUrl: string): HttpsProxyAgent<string> | SocksProxyAgent | undefined {
    try {
      const url = new URL(proxyUrl);
      
      if (url.protocol === 'http:' || url.protocol === 'https:') {
        return new HttpsProxyAgent(proxyUrl);
      } else if (url.protocol === 'socks:' || url.protocol === 'socks5:') {
        return new SocksProxyAgent(proxyUrl);
      } else {
        console.warn(`RotatingProxyHealthMonitor: Unsupported proxy protocol: ${url.protocol}`);
        return undefined;
      }
    } catch (error) {
      console.error('RotatingProxyHealthMonitor: Error creating proxy agent:', error);
      return undefined;
    }
  }

  /**
   * Update health status in configuration
   */
  private async updateHealthStatus(success: boolean, responseTime?: number, error?: string): Promise<void> {
    try {
      const config = await this.proxyConfigManager.loadRotatingProxyConfig();
      
      config.lastHealthCheck = new Date();
      config.responseTime = responseTime;
      
      if (success) {
        config.errorCount = 0; // Reset error count on success
      } else {
        config.errorCount++;
        if (error) {
          config.lastError = error;
        }
      }
      
      await this.proxyConfigManager.saveRotatingProxyConfig(config);
    } catch (err) {
      console.error('RotatingProxyHealthMonitor: Error updating health status:', err);
    }
  }

  /**
   * Track request for statistics
   */
  private trackRequest(success: boolean, responseTime?: number): void {
    const now = Date.now();
    
    // Add new request
    this.recentRequests.push({
      timestamp: now,
      success,
      responseTime
    });

    // Clean up old requests (keep only last 5 minutes)
    const fiveMinutesAgo = now - (5 * 60 * 1000);
    this.recentRequests = this.recentRequests.filter(req => req.timestamp >= fiveMinutesAgo);
  }

  /**
   * Get current health status
   */
  public async getHealthStatus(): Promise<RotatingProxyHealthStatus> {
    const config = await this.proxyConfigManager.loadRotatingProxyConfig();
    const now = Date.now();
    
    // Calculate uptime based on recent requests
    const recentSuccessful = this.recentRequests.filter(req => req.success).length;
    const totalRecent = this.recentRequests.length;
    const uptime = totalRecent > 0 ? (recentSuccessful / totalRecent) * 100 : 0;

    return {
      isHealthy: config.errorCount < ROTATING_PROXY_CONSTANTS.MAX_CONSECUTIVE_ERRORS && 
                uptime >= ROTATING_PROXY_CONSTANTS.MIN_UPTIME_THRESHOLD,
      lastCheck: config.lastHealthCheck || new Date(0),
      responseTime: config.responseTime,
      errorCount: config.errorCount,
      consecutiveErrors: config.errorCount,
      uptime,
      lastError: config.lastError
    };
  }

  /**
   * Get current statistics
   */
  public async getStats(): Promise<RotatingProxyStats> {
    const config = await this.proxyConfigManager.loadRotatingProxyConfig();
    const now = Date.now();
    
    // Calculate stats from recent requests
    const oneMinuteAgo = now - (60 * 1000);
    const recentMinuteRequests = this.recentRequests.filter(req => req.timestamp >= oneMinuteAgo);
    
    const successfulRequests = this.recentRequests.filter(req => req.success).length;
    const failedRequests = this.recentRequests.length - successfulRequests;
    
    const responseTimes = this.recentRequests
      .filter(req => req.responseTime !== undefined)
      .map(req => req.responseTime!);
    
    const averageResponseTime = responseTimes.length > 0 
      ? responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length 
      : 0;

    const errorRate = this.recentRequests.length > 0 
      ? (failedRequests / this.recentRequests.length) * 100 
      : 0;

    return {
      totalRequests: config.totalRequests,
      successfulRequests: config.successfulRequests,
      failedRequests: config.totalRequests - config.successfulRequests,
      averageResponseTime,
      requestsPerMinute: recentMinuteRequests.length,
      lastRequestTime: this.recentRequests.length > 0 
        ? new Date(Math.max(...this.recentRequests.map(req => req.timestamp)))
        : undefined,
      errorRate
    };
  }

  /**
   * Record a request made through the rotating proxy
   */
  public async recordRequest(success: boolean, responseTime?: number, error?: string): Promise<void> {
    // Update configuration stats
    await this.proxyConfigManager.updateRotatingProxyStats(success, responseTime, error);
    
    // Track for real-time statistics
    this.trackRequest(success, responseTime);
  }

  /**
   * Check if monitoring is active
   */
  public isActive(): boolean {
    return this.isMonitoring;
  }
}