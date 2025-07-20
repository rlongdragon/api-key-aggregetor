import { ProxyServer, PROXY_STORAGE_KEYS, StoredProxyPool } from '../types/Proxy';
import { EventManager } from './EventManager';
import * as vscode from 'vscode';
import { HttpsProxyAgent } from 'https-proxy-agent';
import fetch from 'node-fetch';

/**
 * Manages a pool of proxy servers for the API key aggregator
 */
export class ProxyPoolManager {
  private proxies: Map<string, ProxyServer> = new Map();
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private eventManager: EventManager;
  private context: vscode.ExtensionContext;
  private healthCheckIntervalMs: number = 60000; // Default: 1 minute
  private maxErrorsBeforeDisable: number = 3;

  constructor(eventManager: EventManager, context: vscode.ExtensionContext) {
    this.eventManager = eventManager;
    this.context = context;
  }

  /**
   * Initialize the proxy pool manager
   */
  public async initialize(): Promise<void> {
    await this.loadProxies();
    this.startHealthChecks();
  }

  /**
   * Load proxies from storage
   */
  private async loadProxies(): Promise<void> {
    try {
      const storedProxiesJson = await this.context.secrets.get(PROXY_STORAGE_KEYS.PROXY_POOL);
      if (storedProxiesJson) {
        const storedPool: StoredProxyPool = JSON.parse(storedProxiesJson);
        
        this.proxies.clear();
        for (const proxy of storedPool.proxies) {
          this.proxies.set(proxy.id, {
            id: proxy.id,
            url: proxy.url,
            status: proxy.status as 'active' | 'inactive' | 'error',
            assignedKeyCount: 0, // Will be updated when assignments are loaded
            errorCount: proxy.errorCount,
            createdAt: proxy.createdAt,
            updatedAt: proxy.updatedAt
          });
        }
        
        console.log(`ProxyPoolManager: Loaded ${this.proxies.size} proxies from storage`);
      } else {
        console.log('ProxyPoolManager: No stored proxies found');
      }
    } catch (error) {
      console.error('ProxyPoolManager: Error loading proxies from storage', error);
    }
  }

  /**
   * Save proxies to storage
   */
  private async saveProxies(): Promise<void> {
    try {
      const storedPool: StoredProxyPool = {
        proxies: Array.from(this.proxies.values()).map(proxy => ({
          id: proxy.id,
          url: proxy.url,
          status: proxy.status,
          errorCount: proxy.errorCount,
          createdAt: proxy.createdAt,
          updatedAt: proxy.updatedAt
        })),
        lastUpdated: Date.now()
      };
      
      await this.context.secrets.store(
        PROXY_STORAGE_KEYS.PROXY_POOL,
        JSON.stringify(storedPool)
      );
      
      console.log('ProxyPoolManager: Saved proxies to storage');
    } catch (error) {
      console.error('ProxyPoolManager: Error saving proxies to storage', error);
    }
  }

  /**
   * Start periodic health checks for all proxies
   */
  private startHealthChecks(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    
    this.healthCheckInterval = setInterval(
      () => this.performHealthCheck(),
      this.healthCheckIntervalMs
    );
    
    console.log(`ProxyPoolManager: Started health checks (interval: ${this.healthCheckIntervalMs}ms)`);
  }

  /**
   * Stop periodic health checks
   */
  public stopHealthChecks(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
      console.log('ProxyPoolManager: Stopped health checks');
    }
  }

  /**
   * Configure health check settings
   */
  public setHealthCheckConfig(intervalMs: number, maxErrors: number): void {
    this.healthCheckIntervalMs = intervalMs;
    this.maxErrorsBeforeDisable = maxErrors;
    
    // Restart health checks with new interval
    this.stopHealthChecks();
    this.startHealthChecks();
  }

  /**
   * Perform health check on all proxies
   */
  private async performHealthCheck(): Promise<void> {
    console.log('ProxyPoolManager: Performing health check on all proxies');
    
    const checkPromises = Array.from(this.proxies.values()).map(async proxy => {
      try {
        const isHealthy = await this.checkProxyHealth(proxy.id);
        
        // Update proxy status based on health check result
        if (isHealthy) {
          if (proxy.status === 'error') {
            proxy.status = 'active';
            proxy.errorCount = 0;
            proxy.lastError = undefined;
            proxy.updatedAt = Date.now();
            console.log(`ProxyPoolManager: Proxy ${proxy.id} recovered and is now active`);
            
            // Emit event for UI updates
            this.emitProxyStatusChange(proxy);
          }
        } else {
          proxy.errorCount++;
          proxy.lastHealthCheck = Date.now();
          
          if (proxy.errorCount >= this.maxErrorsBeforeDisable && proxy.status !== 'error') {
            proxy.status = 'error';
            proxy.lastError = 'Failed health check';
            proxy.updatedAt = Date.now();
            console.warn(`ProxyPoolManager: Proxy ${proxy.id} marked as error after ${proxy.errorCount} consecutive failures`);
            
            // Emit event for UI updates
            this.emitProxyStatusChange(proxy);
          }
        }
      } catch (error) {
        console.error(`ProxyPoolManager: Error checking health of proxy ${proxy.id}`, error);
      }
    });
    
    await Promise.all(checkPromises);
    await this.saveProxies();
  }

  /**
   * Check health of a specific proxy
   */
  private async checkProxyHealth(proxyId: string): Promise<boolean> {
    const proxy = this.proxies.get(proxyId);
    if (!proxy) {
      console.warn(`ProxyPoolManager: Cannot check health of non-existent proxy ${proxyId}`);
      return false;
    }
    
    try {
      // Use a test URL that should be reliable
      const testUrl = 'https://www.google.com';
      const agent = new HttpsProxyAgent(proxy.url);
      
      const response = await fetch(testUrl, {
        method: 'HEAD',
        agent,
        timeout: 5000 // 5 second timeout
      });
      
      const isHealthy = response.ok;
      proxy.lastHealthCheck = Date.now();
      
      if (isHealthy) {
        console.log(`ProxyPoolManager: Proxy ${proxyId} is healthy`);
      } else {
        console.warn(`ProxyPoolManager: Proxy ${proxyId} health check failed with status ${response.status}`);
      }
      
      return isHealthy;
    } catch (error) {
      console.error(`ProxyPoolManager: Health check failed for proxy ${proxyId}`, error);
      proxy.lastError = error instanceof Error ? error.message : 'Unknown error';
      proxy.lastHealthCheck = Date.now();
      return false;
    }
  }

  /**
   * Add a new proxy to the pool
   */
  public async addProxy(url: string): Promise<string> {
    // Validate proxy URL
    if (!this.validateProxyUrl(url)) {
      throw new Error(`Invalid proxy URL format: ${url}`);
    }
    
    // Generate a unique ID for the proxy
    const id = `proxy_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    
    const newProxy: ProxyServer = {
      id,
      url,
      status: 'active',
      assignedKeyCount: 0,
      errorCount: 0,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    
    this.proxies.set(id, newProxy);
    
    // Perform initial health check
    try {
      const isHealthy = await this.checkProxyHealth(id);
      if (!isHealthy) {
        newProxy.status = 'error';
        newProxy.lastError = 'Failed initial health check';
      }
    } catch (error) {
      console.error(`ProxyPoolManager: Error during initial health check for proxy ${id}`, error);
      newProxy.status = 'error';
      newProxy.lastError = error instanceof Error ? error.message : 'Unknown error';
    }
    
    await this.saveProxies();
    
    // Emit event for UI updates
    this.emitProxyAdded(newProxy);
    
    return id;
  }

  /**
   * Remove a proxy from the pool
   */
  public async removeProxy(id: string): Promise<void> {
    const proxy = this.proxies.get(id);
    if (!proxy) {
      throw new Error(`Proxy with ID ${id} not found`);
    }
    
    // Check if proxy has assigned keys
    if (proxy.assignedKeyCount > 0) {
      throw new Error(`Cannot remove proxy ${id} because it has ${proxy.assignedKeyCount} assigned API keys`);
    }
    
    this.proxies.delete(id);
    await this.saveProxies();
    
    // Emit event for UI updates
    this.emitProxyRemoved(id);
  }

  /**
   * Update a proxy's URL
   */
  public async updateProxy(id: string, url: string): Promise<void> {
    // Validate proxy URL
    if (!this.validateProxyUrl(url)) {
      throw new Error(`Invalid proxy URL format: ${url}`);
    }
    
    const proxy = this.proxies.get(id);
    if (!proxy) {
      throw new Error(`Proxy with ID ${id} not found`);
    }
    
    // Update proxy URL
    proxy.url = url;
    proxy.updatedAt = Date.now();
    proxy.status = 'active'; // Reset status
    proxy.errorCount = 0;    // Reset error count
    
    // Perform health check on updated proxy
    try {
      const isHealthy = await this.checkProxyHealth(id);
      if (!isHealthy) {
        proxy.status = 'error';
        proxy.lastError = 'Failed health check after update';
      }
    } catch (error) {
      console.error(`ProxyPoolManager: Error checking health of updated proxy ${id}`, error);
    }
    
    await this.saveProxies();
    
    // Emit event for UI updates
    this.emitProxyUpdated(proxy);
  }

  /**
   * Get all proxies in the pool
   */
  public getAllProxies(): ProxyServer[] {
    return Array.from(this.proxies.values());
  }

  /**
   * Get available (active) proxies
   */
  public getAvailableProxies(): ProxyServer[] {
    return Array.from(this.proxies.values()).filter(proxy => proxy.status === 'active');
  }

  /**
   * Get a specific proxy by ID
   */
  public getProxy(id: string): ProxyServer | undefined {
    return this.proxies.get(id);
  }

  /**
   * Update the assigned key count for a proxy
   */
  public async updateAssignedKeyCount(proxyId: string, count: number): Promise<void> {
    const proxy = this.proxies.get(proxyId);
    if (!proxy) {
      throw new Error(`Proxy with ID ${proxyId} not found`);
    }
    
    proxy.assignedKeyCount = count;
    proxy.updatedAt = Date.now();
    
    await this.saveProxies();
  }

  /**
   * Validate proxy URL format
   */
  public validateProxyUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      return ['http:', 'https:', 'socks:', 'socks5:'].includes(parsed.protocol);
    } catch {
      return false;
    }
  }

  /**
   * Emit proxy added event
   */
  private emitProxyAdded(proxy: ProxyServer): void {
    this.eventManager.emit('proxyAdded', proxy);
  }

  /**
   * Emit proxy removed event
   */
  private emitProxyRemoved(proxyId: string): void {
    this.eventManager.emit('proxyRemoved', proxyId);
  }

  /**
   * Emit proxy updated event
   */
  private emitProxyUpdated(proxy: ProxyServer): void {
    this.eventManager.emit('proxyUpdated', proxy);
  }

  /**
   * Emit proxy status change event
   */
  private emitProxyStatusChange(proxy: ProxyServer): void {
    this.eventManager.emit('proxyStatusChanged', proxy);
  }

  /**
   * Dispose resources
   */
  public dispose(): void {
    this.stopHealthChecks();
  }
}