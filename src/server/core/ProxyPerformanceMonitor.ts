import { EventManager } from './EventManager';
import { ProxyServer, ProxyAssignment } from '../types/Proxy';

/**
 * Performance metrics for proxy operations
 */
export interface ProxyMetrics {
  proxyId: string;
  proxyUrl: string;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  lastRequestTime?: number;
  errorRate: number;
  uptime: number;
  assignedKeyCount: number;
}

/**
 * System-wide performance metrics
 */
export interface SystemMetrics {
  totalProxies: number;
  activeProxies: number;
  totalAssignments: number;
  averageLoadBalance: number;
  memoryUsage: {
    proxyPool: number;
    assignments: number;
    metrics: number;
  };
  performanceScore: number;
}

/**
 * Monitors and optimizes proxy performance
 */
export class ProxyPerformanceMonitor {
  private eventManager: EventManager;
  private metrics: Map<string, ProxyMetrics> = new Map();
  private requestTimes: Map<string, number[]> = new Map();
  private startTime: number = Date.now();
  private metricsCollectionInterval: NodeJS.Timeout | null = null;

  constructor(eventManager: EventManager) {
    this.eventManager = eventManager;
    this.setupEventListeners();
    this.startMetricsCollection();
  }

  /**
   * Setup event listeners for performance monitoring
   */
  private setupEventListeners(): void {
    // Listen for proxy additions
    this.eventManager.on('proxyAdded', (proxy: ProxyServer) => {
      this.initializeProxyMetrics(proxy);
    });

    // Listen for proxy removals
    this.eventManager.on('proxyRemoved', (proxyId: string) => {
      this.metrics.delete(proxyId);
      this.requestTimes.delete(proxyId);
    });

    // Listen for proxy status changes
    this.eventManager.on('proxyStatusChanged', (proxy: ProxyServer) => {
      this.updateProxyStatus(proxy);
    });

    // Listen for request updates to track performance
    this.eventManager.on('requestUpdate', (requestStatus: { proxyId?: string; status: string; responseTime?: number }) => {
      if (requestStatus.proxyId) {
        this.recordRequest(requestStatus);
      }
    });
  }

  /**
   * Initialize metrics for a new proxy
   */
  private initializeProxyMetrics(proxy: ProxyServer): void {
    const metrics: ProxyMetrics = {
      proxyId: proxy.id,
      proxyUrl: proxy.url,
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      errorRate: 0,
      uptime: 0,
      assignedKeyCount: proxy.assignedKeyCount
    };

    this.metrics.set(proxy.id, metrics);
    this.requestTimes.set(proxy.id, []);
  }

  /**
   * Update proxy status metrics
   */
  private updateProxyStatus(proxy: ProxyServer): void {
    const metrics = this.metrics.get(proxy.id);
    if (metrics) {
      metrics.assignedKeyCount = proxy.assignedKeyCount;
      
      // Calculate uptime based on status
      if (proxy.status === 'active') {
        const now = Date.now();
        const totalTime = now - this.startTime;
        metrics.uptime = (metrics.uptime * 0.9) + (totalTime * 0.1); // Exponential moving average
      }
    }
  }

  /**
   * Record a request for performance tracking
   */
  private recordRequest(requestStatus: { proxyId?: string; status: string; responseTime?: number; startTime?: number; endTime?: number }): void {
    const proxyId = requestStatus.proxyId;
    if (!proxyId) return; // Skip if no proxy ID
    
    const metrics = this.metrics.get(proxyId);
    if (!metrics) return;

    metrics.totalRequests++;
    
    if (requestStatus.status === 'success') {
      metrics.successfulRequests++;
      
      // Record response time if available
      if (requestStatus.startTime && requestStatus.endTime) {
        const responseTime = requestStatus.endTime - requestStatus.startTime;
        const times = this.requestTimes.get(proxyId) || [];
        times.push(responseTime);
        
        // Keep only last 100 response times for memory efficiency
        if (times.length > 100) {
          times.shift();
        }
        
        this.requestTimes.set(proxyId, times);
        
        // Update average response time
        metrics.averageResponseTime = times.reduce((a, b) => a + b, 0) / times.length;
      }
    } else if (requestStatus.status === 'failed') {
      metrics.failedRequests++;
    }

    // Update error rate
    metrics.errorRate = metrics.totalRequests > 0 
      ? (metrics.failedRequests / metrics.totalRequests) * 100 
      : 0;

    metrics.lastRequestTime = Date.now();
  }

  /**
   * Get metrics for a specific proxy
   */
  public getProxyMetrics(proxyId: string): ProxyMetrics | undefined {
    return this.metrics.get(proxyId);
  }

  /**
   * Get metrics for all proxies
   */
  public getAllProxyMetrics(): ProxyMetrics[] {
    return Array.from(this.metrics.values());
  }

  /**
   * Get system-wide performance metrics
   */
  public getSystemMetrics(proxies: ProxyServer[], assignments: ProxyAssignment[]): SystemMetrics {
    const activeProxies = proxies.filter(p => p.status === 'active');
    
    // Calculate load balance effectiveness
    const assignmentCounts = new Map<string, number>();
    for (const assignment of assignments) {
      const count = assignmentCounts.get(assignment.proxyId) || 0;
      assignmentCounts.set(assignment.proxyId, count + 1);
    }
    
    const counts = Array.from(assignmentCounts.values());
    const maxCount = Math.max(...counts, 0);
    const minCount = Math.min(...counts, 0);
    const averageLoadBalance = counts.length > 0 
      ? 100 - ((maxCount - minCount) / Math.max(maxCount, 1)) * 100 
      : 100;

    // Estimate memory usage (rough approximation)
    const memoryUsage = {
      proxyPool: proxies.length * 500, // ~500 bytes per proxy
      assignments: assignments.length * 200, // ~200 bytes per assignment
      metrics: this.metrics.size * 300 // ~300 bytes per metric
    };

    // Calculate overall performance score (0-100)
    const avgErrorRate = this.calculateAverageErrorRate();
    const avgResponseTime = this.calculateAverageResponseTime();
    const performanceScore = Math.max(0, 100 - avgErrorRate - Math.min(avgResponseTime / 100, 50));

    return {
      totalProxies: proxies.length,
      activeProxies: activeProxies.length,
      totalAssignments: assignments.length,
      averageLoadBalance,
      memoryUsage,
      performanceScore
    };
  }

  /**
   * Calculate average error rate across all proxies
   */
  private calculateAverageErrorRate(): number {
    const metrics = Array.from(this.metrics.values());
    if (metrics.length === 0) return 0;
    
    const totalErrorRate = metrics.reduce((sum, metric) => sum + metric.errorRate, 0);
    return totalErrorRate / metrics.length;
  }

  /**
   * Calculate average response time across all proxies
   */
  private calculateAverageResponseTime(): number {
    const metrics = Array.from(this.metrics.values());
    if (metrics.length === 0) return 0;
    
    const validMetrics = metrics.filter(m => m.averageResponseTime > 0);
    if (validMetrics.length === 0) return 0;
    
    const totalResponseTime = validMetrics.reduce((sum, metric) => sum + metric.averageResponseTime, 0);
    return totalResponseTime / validMetrics.length;
  }

  /**
   * Get performance recommendations
   */
  public getPerformanceRecommendations(proxies: ProxyServer[], assignments: ProxyAssignment[]): string[] {
    const recommendations: string[] = [];
    const metrics = this.getAllProxyMetrics();
    
    // Check for high error rate proxies
    const highErrorProxies = metrics.filter(m => m.errorRate > 20);
    if (highErrorProxies.length > 0) {
      recommendations.push(`Consider removing or replacing ${highErrorProxies.length} proxies with high error rates (>20%)`);
    }
    
    // Check for slow proxies
    const slowProxies = metrics.filter(m => m.averageResponseTime > 5000);
    if (slowProxies.length > 0) {
      recommendations.push(`${slowProxies.length} proxies have slow response times (>5s), consider optimization`);
    }
    
    // Check load balance
    const systemMetrics = this.getSystemMetrics(proxies, assignments);
    if (systemMetrics.averageLoadBalance < 80) {
      recommendations.push('Load balancing could be improved - consider rebalancing proxy assignments');
    }
    
    // Check for unused proxies
    const unusedProxies = proxies.filter(p => p.assignedKeyCount === 0 && p.status === 'active');
    if (unusedProxies.length > 0) {
      recommendations.push(`${unusedProxies.length} active proxies are not assigned to any API keys`);
    }
    
    // Memory usage recommendations
    if (systemMetrics.memoryUsage.metrics > 10000) {
      recommendations.push('Consider clearing old performance metrics to reduce memory usage');
    }
    
    return recommendations;
  }

  /**
   * Start periodic metrics collection
   */
  private startMetricsCollection(): void {
    this.metricsCollectionInterval = setInterval(() => {
      this.collectMetrics();
    }, 60000); // Collect metrics every minute
  }

  /**
   * Collect and emit performance metrics
   */
  private collectMetrics(): void {
    const allMetrics = this.getAllProxyMetrics();
    
    // Emit performance update event
    this.eventManager.emit('performanceUpdate', {
      timestamp: Date.now(),
      metrics: allMetrics
    });
    
    // Log performance summary
    const activeMetrics = allMetrics.filter(m => m.totalRequests > 0);
    if (activeMetrics.length > 0) {
      const avgErrorRate = this.calculateAverageErrorRate();
      const avgResponseTime = this.calculateAverageResponseTime();
      
      console.log(`ProxyPerformanceMonitor: ${activeMetrics.length} active proxies, ` +
                 `avg error rate: ${avgErrorRate.toFixed(1)}%, ` +
                 `avg response time: ${avgResponseTime.toFixed(0)}ms`);
    }
  }

  /**
   * Clear old metrics to free memory
   */
  public clearOldMetrics(olderThanMs: number = 24 * 60 * 60 * 1000): void {
    const cutoffTime = Date.now() - olderThanMs;
    
    for (const [proxyId, metrics] of this.metrics.entries()) {
      if (metrics.lastRequestTime && metrics.lastRequestTime < cutoffTime) {
        // Reset counters but keep the proxy metrics structure
        metrics.totalRequests = 0;
        metrics.successfulRequests = 0;
        metrics.failedRequests = 0;
        metrics.errorRate = 0;
        metrics.averageResponseTime = 0;
        
        // Clear response times
        this.requestTimes.set(proxyId, []);
      }
    }
    
    console.log('ProxyPerformanceMonitor: Cleared old metrics');
  }

  /**
   * Dispose resources
   */
  public dispose(): void {
    if (this.metricsCollectionInterval) {
      clearInterval(this.metricsCollectionInterval);
      this.metricsCollectionInterval = null;
    }
    
    this.metrics.clear();
    this.requestTimes.clear();
  }
}