import * as vscode from 'vscode';
import { UIState, ServerStatus, ApiKeyTreeItem, ProxyTreeItem } from '../types/TreeViewTypes';
import { uiEventManager } from './UIEventManager';

/**
 * Manages the overall UI state and provides centralized state updates
 */
export class UIStateManager {
  private state: UIState;
  private disposables: vscode.Disposable[] = [];

  constructor() {
    this.state = {
      serverStatus: {
        isRunning: false,
        totalRequests: 0,
        activeConnections: 0
      },
      apiKeys: [],
      proxies: [],
      isRotatingProxyMode: false,
      lastRefresh: new Date()
    };
  }

  /**
   * Get current UI state
   */
  public getState(): Readonly<UIState> {
    return { ...this.state };
  }

  /**
   * Update server status
   */
  public updateServerStatus(status: Partial<ServerStatus>): void {
    this.state.serverStatus = { ...this.state.serverStatus, ...status };
    uiEventManager.emit('serverStatusChanged', { status: this.state.serverStatus });
  }

  /**
   * Add or update an API key
   */
  public updateApiKey(keyId: string, item: ApiKeyTreeItem): void {
    const existingIndex = this.state.apiKeys.findIndex(k => k.keyId === keyId);
    
    if (existingIndex >= 0) {
      this.state.apiKeys[existingIndex] = item;
      uiEventManager.emit('apiKeyUpdated', { keyId, item });
    } else {
      this.state.apiKeys.push(item);
      uiEventManager.emit('apiKeyAdded', { keyId, item });
    }
    
    this.state.lastRefresh = new Date();
  }

  /**
   * Remove an API key
   */
  public removeApiKey(keyId: string): void {
    this.state.apiKeys = this.state.apiKeys.filter(k => k.keyId !== keyId);
    uiEventManager.emit('apiKeyRemoved', { keyId });
    this.state.lastRefresh = new Date();
  }

  /**
   * Add or update a proxy
   */
  public updateProxy(proxyId: string, item: ProxyTreeItem): void {
    const existingIndex = this.state.proxies.findIndex(p => p.proxyId === proxyId);
    
    if (existingIndex >= 0) {
      this.state.proxies[existingIndex] = item;
      uiEventManager.emit('proxyUpdated', { proxyId, item });
    } else {
      this.state.proxies.push(item);
      uiEventManager.emit('proxyAdded', { proxyId, item });
    }
    
    this.state.lastRefresh = new Date();
  }

  /**
   * Remove a proxy
   */
  public removeProxy(proxyId: string): void {
    this.state.proxies = this.state.proxies.filter(p => p.proxyId !== proxyId);
    uiEventManager.emit('proxyRemoved', { proxyId });
    this.state.lastRefresh = new Date();
  }

  /**
   * Set rotating proxy mode
   */
  public setRotatingProxyMode(enabled: boolean, url?: string): void {
    this.state.isRotatingProxyMode = enabled;
    this.state.rotatingProxyUrl = url;
    this.state.lastRefresh = new Date();
    uiEventManager.emit('refreshRequested', {});
  }

  /**
   * Get API keys
   */
  public getApiKeys(): ApiKeyTreeItem[] {
    return [...this.state.apiKeys];
  }

  /**
   * Get proxies
   */
  public getProxies(): ProxyTreeItem[] {
    return [...this.state.proxies];
  }

  /**
   * Get server status
   */
  public getServerStatus(): ServerStatus {
    return { ...this.state.serverStatus };
  }

  /**
   * Check if rotating proxy mode is enabled
   */
  public isRotatingProxyEnabled(): boolean {
    return this.state.isRotatingProxyMode;
  }

  /**
   * Get rotating proxy URL
   */
  public getRotatingProxyUrl(): string | undefined {
    return this.state.rotatingProxyUrl;
  }

  /**
   * Update rotating proxy health status
   */
  public updateRotatingProxyHealth(healthStatus: any): void {
    this.state.rotatingProxyHealth = healthStatus;
    uiEventManager.emit('rotatingProxyHealthChanged', { healthStatus });
  }

  /**
   * Get rotating proxy health status
   */
  public getRotatingProxyHealth(): any {
    return this.state.rotatingProxyHealth;
  }

  /**
   * Refresh all data
   */
  public refresh(): void {
    this.state.lastRefresh = new Date();
    uiEventManager.emit('refreshRequested', {});
  }

  /**
   * Dispose resources
   */
  public dispose(): void {
    this.disposables.forEach(d => d.dispose());
    this.disposables = [];
  }
}

/**
 * Global UI state manager instance
 */
export const uiStateManager = new UIStateManager();