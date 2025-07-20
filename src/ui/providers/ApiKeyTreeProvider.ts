import * as vscode from 'vscode';
import { ApiKeyTreeItem, CONTEXT_VALUES, ICONS } from '../types/TreeViewTypes';
import { uiEventManager } from '../core/UIEventManager';
import { uiStateManager } from '../core/UIStateManager';
import { DataTransformers } from '../utils/DataTransformers';
import { accessibilityService } from '../core/AccessibilityService';
import ApiKeyManager from '../../server/core/ApiKeyManager';

/**
 * Tree data provider for API Keys view
 */
export class ApiKeyTreeProvider implements vscode.TreeDataProvider<ApiKeyTreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<ApiKeyTreeItem | undefined | null | void> = new vscode.EventEmitter<ApiKeyTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<ApiKeyTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

  private disposables: vscode.Disposable[] = [];
  private apiKeyManager?: ApiKeyManager;

  constructor(apiKeyManager?: ApiKeyManager) {
    this.apiKeyManager = apiKeyManager;
    this.setupEventListeners();
  }

  /**
   * Setup event listeners for UI updates
   */
  private setupEventListeners(): void {
    // Listen for API key events
    this.disposables.push(
      uiEventManager.on('apiKeyAdded', (data) => {
        this.handleApiKeyAdded(data);
        this.refresh();
      }),
      uiEventManager.on('apiKeyRemoved', (data) => {
        this.handleApiKeyRemoved(data);
        this.refresh();
      }),
      uiEventManager.on('apiKeyUpdated', (data) => {
        this.handleApiKeyUpdated(data);
        this.refresh();
      }),
      uiEventManager.on('refreshRequested', () => this.refresh()),
      uiEventManager.on('serverStatusChanged', () => this.refresh())
    );

    // Set up periodic refresh for real-time updates
    const refreshInterval = setInterval(() => {
      this.updateFromApiKeyManager();
    }, 5000); // Refresh every 5 seconds

    this.disposables.push(new vscode.Disposable(() => {
      clearInterval(refreshInterval);
    }));
  }

  /**
   * Handle API key added event
   */
  private handleApiKeyAdded(data: { keyId: string; item: ApiKeyTreeItem }): void {
    console.log(`API Key added: ${data.keyId}`);
    // Show notification for new API key
    vscode.window.showInformationMessage(`API Key ${data.keyId} added successfully`);
  }

  /**
   * Handle API key removed event
   */
  private handleApiKeyRemoved(data: { keyId: string }): void {
    console.log(`API Key removed: ${data.keyId}`);
    // Show notification for removed API key
    vscode.window.showInformationMessage(`API Key ${data.keyId} removed`);
  }

  /**
   * Handle API key updated event
   */
  private handleApiKeyUpdated(data: { keyId: string; item: ApiKeyTreeItem }): void {
    console.log(`API Key updated: ${data.keyId}, status: ${data.item.status}`);
    
    // Show warning for rate limited keys
    if (data.item.status === 'rate_limited') {
      vscode.window.showWarningMessage(`API Key ${data.keyId} is rate limited`);
    }
    
    // Show error for failed keys
    if (data.item.status === 'error') {
      vscode.window.showErrorMessage(`API Key ${data.keyId} has encountered an error`);
    }
  }

  /**
   * Update tree data from API key manager
   */
  private updateFromApiKeyManager(): void {
    if (!this.apiKeyManager) {
      return;
    }

    try {
      // Get current API keys from manager
      const currentKeys = this.apiKeyManager.getAllKeys();
      
      // Transform to UI items and update state
      for (const apiKey of currentKeys) {
        const treeItem = DataTransformers.transformApiKey(apiKey);
        uiStateManager.updateApiKey(apiKey.keyId, treeItem);
      }
    } catch (error) {
      console.error('Error updating API keys from manager:', error);
    }
  }

  /**
   * Get tree item representation
   */
  getTreeItem(element: ApiKeyTreeItem): vscode.TreeItem {
    const item = new vscode.TreeItem(element.label, element.collapsibleState);
    
    item.id = element.id;
    item.description = this.getEnhancedDescription(element);
    item.tooltip = this.getEnhancedTooltip(element);
    item.iconPath = element.iconPath;
    item.contextValue = element.contextValue;
    
    // Add accessibility features
    item.accessibilityInformation = {
      label: accessibilityService.generateAccessibleLabel(element),
      role: element.type === 'apiKey' ? 'treeitem' : 'group'
    };
    
    // Add command for viewing details
    if (element.type === 'apiKey') {
      item.command = {
        command: 'geminiAggregator.viewApiKeyDetails',
        title: 'View Details',
        arguments: [element.keyId]
      };
    }
    
    // Add resource URI for custom styling (if needed)
    if (element.status === 'error') {
      item.resourceUri = vscode.Uri.parse(`error:${element.id}`);
    } else if (element.status === 'rate_limited') {
      item.resourceUri = vscode.Uri.parse(`warning:${element.id}`);
    }
    
    return item;
  }

  /**
   * Get enhanced description with real-time status
   */
  private getEnhancedDescription(element: ApiKeyTreeItem): string {
    if (element.type !== 'apiKey') {
      return element.description || '';
    }

    const parts: string[] = [];
    
    // Add current status
    switch (element.status) {
      case 'active':
        if (element.currentRequests && element.currentRequests > 0) {
          parts.push(`${element.currentRequests} active requests`);
        } else {
          parts.push('ready');
        }
        break;
      case 'rate_limited':
        parts.push('cooling down');
        break;
      case 'error':
        parts.push('error');
        break;
      case 'inactive':
        parts.push('inactive');
        break;
    }
    
    // Add proxy info
    if (uiStateManager.isRotatingProxyEnabled()) {
      parts.push('rotating proxy');
    } else if (element.proxyAssigned) {
      parts.push('proxied');
    }
    
    // Add usage stats
    if (element.usageStats && element.usageStats.totalRequests > 0) {
      parts.push(`${element.usageStats.totalRequests} total`);
    }
    
    // Add last used info
    if (element.lastUsed) {
      const timeSince = Date.now() - element.lastUsed.getTime();
      if (timeSince < 60000) {
        parts.push('just used');
      } else if (timeSince < 3600000) {
        parts.push(`${Math.floor(timeSince / 60000)}m ago`);
      } else if (timeSince < 86400000) {
        parts.push(`${Math.floor(timeSince / 3600000)}h ago`);
      }
    }
    
    return parts.join(' • ');
  }

  /**
   * Get enhanced tooltip with detailed information
   */
  private getEnhancedTooltip(element: ApiKeyTreeItem): string {
    if (element.type !== 'apiKey') {
      return element.tooltip || element.description || '';
    }

    // Use accessibility service for comprehensive description
    const accessibleDescription = accessibilityService.generateApiKeyAccessibleDescription(element);
    
    // Create accessible tooltip with visual formatting for sighted users
    const title = `API Key ${element.keyId}`;
    const actions = ['View Details', 'Test Key', 'Remove Key'];
    
    return accessibilityService.createAccessibleTooltip(
      title,
      accessibleDescription,
      actions
    );
  }

  /**
   * Get children for tree structure
   */
  async getChildren(element?: ApiKeyTreeItem): Promise<ApiKeyTreeItem[]> {
    if (!element) {
      // Root level - return API key groups and individual keys
      return this.getRootItems();
    }
    
    // For groups, return child items
    if (element.type === 'apiKeyGroup') {
      return this.getGroupChildren(element);
    }
    
    return [];
  }

  /**
   * Get root level items
   */
  private async getRootItems(): Promise<ApiKeyTreeItem[]> {
    const items: ApiKeyTreeItem[] = [];
    const apiKeys = uiStateManager.getApiKeys();
    const isRotatingProxy = uiStateManager.isRotatingProxyEnabled();
    
    // Add status summary group
    const statusSummary = this.createStatusSummaryItem(apiKeys);
    items.push(statusSummary);
    
    // Add rotating proxy info if enabled
    if (isRotatingProxy) {
      const rotatingProxyInfo = this.createRotatingProxyInfoItem();
      items.push(rotatingProxyInfo);
    }
    
    // Add individual API keys
    for (const apiKey of apiKeys) {
      items.push(apiKey);
    }
    
    // If no API keys, show helpful message
    if (apiKeys.length === 0) {
      items.push(this.createEmptyStateItem());
    }
    
    return items;
  }

  /**
   * Get children for a group
   */
  private getGroupChildren(group: ApiKeyTreeItem): ApiKeyTreeItem[] {
    const apiKeys = uiStateManager.getApiKeys();
    
    switch (group.id) {
      case 'status-summary':
        return this.createStatusBreakdown(apiKeys);
      case 'rotating-proxy-info':
        return this.createRotatingProxyDetails();
      default:
        return [];
    }
  }

  /**
   * Create status summary group item
   */
  private createStatusSummaryItem(apiKeys: ApiKeyTreeItem[]): ApiKeyTreeItem {
    const activeCount = apiKeys.filter(k => k.status === 'active').length;
    const totalCount = apiKeys.length;
    const hasErrors = apiKeys.some(k => k.status === 'error');
    const hasRateLimited = apiKeys.some(k => k.status === 'rate_limited');
    
    let icon = ICONS.API_KEY_ACTIVE;
    let status: 'active' | 'inactive' | 'error' | 'rate_limited' = 'active';
    
    if (hasErrors) {
      icon = ICONS.API_KEY_ERROR;
      status = 'error';
    } else if (hasRateLimited) {
      icon = ICONS.API_KEY_RATE_LIMITED;
      status = 'rate_limited';
    } else if (activeCount === 0) {
      icon = ICONS.API_KEY_INACTIVE;
      status = 'inactive';
    }
    
    return {
      id: 'status-summary',
      label: 'API Keys Overview',
      description: `${activeCount}/${totalCount} active`,
      tooltip: `${activeCount} active keys out of ${totalCount} total`,
      iconPath: icon,
      contextValue: CONTEXT_VALUES.API_KEY_GROUP,
      collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
      type: 'apiKeyGroup',
      status: status
    };
  }

  /**
   * Create rotating proxy info item
   */
  private createRotatingProxyInfoItem(): ApiKeyTreeItem {
    const rotatingProxyUrl = uiStateManager.getRotatingProxyUrl();
    const apiKeys = uiStateManager.getApiKeys();
    
    return {
      id: 'rotating-proxy-info',
      label: 'Rotating Proxy Mode',
      description: `${apiKeys.length} keys using rotating proxy`,
      tooltip: `All API keys are using rotating proxy: ${rotatingProxyUrl}`,
      iconPath: ICONS.ROTATING_PROXY,
      contextValue: CONTEXT_VALUES.API_KEY_GROUP,
      collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
      type: 'apiKeyGroup',
      status: 'active'
    };
  }

  /**
   * Create status breakdown items
   */
  private createStatusBreakdown(apiKeys: ApiKeyTreeItem[]): ApiKeyTreeItem[] {
    const statusCounts = {
      active: apiKeys.filter(k => k.status === 'active').length,
      inactive: apiKeys.filter(k => k.status === 'inactive').length,
      error: apiKeys.filter(k => k.status === 'error').length,
      rate_limited: apiKeys.filter(k => k.status === 'rate_limited').length
    };
    
    const items: ApiKeyTreeItem[] = [];
    
    if (statusCounts.active > 0) {
      items.push({
        id: 'status-active',
        label: `Active Keys: ${statusCounts.active}`,
        description: 'Ready for requests',
        iconPath: ICONS.API_KEY_ACTIVE,
        contextValue: 'statusInfo',
        type: 'apiKeyGroup',
        status: 'active'
      });
    }
    
    if (statusCounts.rate_limited > 0) {
      items.push({
        id: 'status-rate-limited',
        label: `Rate Limited: ${statusCounts.rate_limited}`,
        description: 'Cooling down',
        iconPath: ICONS.API_KEY_RATE_LIMITED,
        contextValue: 'statusInfo',
        type: 'apiKeyGroup',
        status: 'rate_limited'
      });
    }
    
    if (statusCounts.error > 0) {
      items.push({
        id: 'status-error',
        label: `Error Keys: ${statusCounts.error}`,
        description: 'Need attention',
        iconPath: ICONS.API_KEY_ERROR,
        contextValue: 'statusInfo',
        type: 'apiKeyGroup',
        status: 'error'
      });
    }
    
    if (statusCounts.inactive > 0) {
      items.push({
        id: 'status-inactive',
        label: `Inactive Keys: ${statusCounts.inactive}`,
        description: 'Not in use',
        iconPath: ICONS.API_KEY_INACTIVE,
        contextValue: 'statusInfo',
        type: 'apiKeyGroup',
        status: 'inactive'
      });
    }
    
    return items;
  }

  /**
   * Create rotating proxy details
   */
  private createRotatingProxyDetails(): ApiKeyTreeItem[] {
    const rotatingProxyUrl = uiStateManager.getRotatingProxyUrl();
    const apiKeys = uiStateManager.getApiKeys();
    
    return [
      {
        id: 'rotating-proxy-url',
        label: 'Proxy Endpoint',
        description: rotatingProxyUrl || 'Not configured',
        iconPath: ICONS.ROTATING_PROXY,
        contextValue: 'rotatingProxyInfo',
        type: 'apiKeyGroup',
        status: 'active'
      },
      {
        id: 'rotating-proxy-keys',
        label: 'Assigned Keys',
        description: `${apiKeys.length} keys`,
        iconPath: ICONS.API_KEY_ACTIVE,
        contextValue: 'rotatingProxyInfo',
        type: 'apiKeyGroup',
        status: 'active'
      }
    ];
  }

  /**
   * Create empty state item
   */
  private createEmptyStateItem(): ApiKeyTreeItem {
    return {
      id: 'empty-state',
      label: 'No API Keys',
      description: 'Click to add your first API key',
      tooltip: 'Add API keys to start using the aggregator',
      iconPath: new vscode.ThemeIcon('add'),
      contextValue: 'emptyState',
      type: 'apiKeyGroup',
      status: 'inactive'
    };
  }

  /**
   * Refresh the tree view
   */
  public refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  /**
   * Update API key manager reference
   */
  public setApiKeyManager(apiKeyManager: ApiKeyManager): void {
    this.apiKeyManager = apiKeyManager;
    this.refresh();
  }

  /**
   * Dispose resources
   */
  public dispose(): void {
    this._onDidChangeTreeData.dispose();
    this.disposables.forEach(d => d.dispose());
    this.disposables = [];
  }
}