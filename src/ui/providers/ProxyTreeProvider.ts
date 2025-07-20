import * as vscode from 'vscode';
import { ProxyTreeItem, CONTEXT_VALUES, ICONS } from '../types/TreeViewTypes';
import { uiEventManager } from '../core/UIEventManager';
import { uiStateManager } from '../core/UIStateManager';
import { DataTransformers } from '../utils/DataTransformers';
import { accessibilityService } from '../core/AccessibilityService';
import { ProxyPoolManager } from '../../server/core/ProxyPoolManager';
import { ProxyAssignmentManager } from '../../server/core/ProxyAssignmentManager';

/**
 * Tree data provider for Proxy Management view
 */
export class ProxyTreeProvider implements vscode.TreeDataProvider<ProxyTreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<ProxyTreeItem | undefined | null | void> = new vscode.EventEmitter<ProxyTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<ProxyTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

  private disposables: vscode.Disposable[] = [];
  private proxyPoolManager?: ProxyPoolManager;
  private proxyAssignmentManager?: ProxyAssignmentManager;

  constructor(proxyPoolManager?: ProxyPoolManager, proxyAssignmentManager?: ProxyAssignmentManager) {
    this.proxyPoolManager = proxyPoolManager;
    this.proxyAssignmentManager = proxyAssignmentManager;
    this.setupEventListeners();
  }

  /**
   * Setup event listeners for UI updates
   */
  private setupEventListeners(): void {
    // Listen for proxy events
    this.disposables.push(
      uiEventManager.on('proxyAdded', (data) => {
        this.handleProxyAdded(data);
        this.refresh();
      }),
      uiEventManager.on('proxyRemoved', (data) => {
        this.handleProxyRemoved(data);
        this.refresh();
      }),
      uiEventManager.on('proxyUpdated', (data) => {
        this.handleProxyUpdated(data);
        this.refresh();
      }),
      uiEventManager.on('refreshRequested', () => this.refresh()),
      uiEventManager.on('serverStatusChanged', () => this.refresh())
    );

    // Set up periodic refresh for real-time health updates
    const refreshInterval = setInterval(() => {
      this.updateFromProxyManager();
    }, 10000); // Refresh every 10 seconds for proxy health

    this.disposables.push(new vscode.Disposable(() => {
      clearInterval(refreshInterval);
    }));
  }

  /**
   * Handle proxy added event
   */
  private handleProxyAdded(data: { proxyId: string; item: ProxyTreeItem }): void {
    console.log(`Proxy added: ${data.proxyId}`);
    vscode.window.showInformationMessage(`Proxy ${data.item.url} added successfully`);
  }

  /**
   * Handle proxy removed event
   */
  private handleProxyRemoved(data: { proxyId: string }): void {
    console.log(`Proxy removed: ${data.proxyId}`);
    vscode.window.showInformationMessage(`Proxy removed`);
  }

  /**
   * Handle proxy updated event
   */
  private handleProxyUpdated(data: { proxyId: string; item: ProxyTreeItem }): void {
    console.log(`Proxy updated: ${data.proxyId}, status: ${data.item.status}`);
    
    // Show warning for unhealthy proxies
    if (data.item.status === 'error') {
      vscode.window.showWarningMessage(`Proxy ${data.item.url} is experiencing issues`);
    }
  }

  /**
   * Update tree data from proxy managers
   */
  private updateFromProxyManager(): void {
    if (!this.proxyPoolManager) {
      return;
    }

    try {
      // Get current proxies from manager
      const currentProxies = this.proxyPoolManager.getAllProxies();
      
      // Transform to UI items and update state
      for (const proxy of currentProxies) {
        const treeItem = DataTransformers.transformProxy(proxy);
        
        // Add assignment information
        if (this.proxyAssignmentManager) {
          const allAssignments = this.proxyAssignmentManager.getAllAssignments();
          const proxyAssignments = allAssignments.filter(a => a.proxyId === proxy.id);
          treeItem.assignedKeys = proxyAssignments.map(a => a.keyId);
        }
        
        uiStateManager.updateProxy(proxy.id, treeItem);
      }
    } catch (error) {
      console.error('Error updating proxies from manager:', error);
    }
  }

  /**
   * Get tree item representation
   */
  getTreeItem(element: ProxyTreeItem): vscode.TreeItem {
    const item = new vscode.TreeItem(element.label, element.collapsibleState);
    
    item.id = element.id;
    item.description = this.getEnhancedDescription(element);
    item.tooltip = this.getEnhancedTooltip(element);
    item.iconPath = element.iconPath;
    item.contextValue = element.contextValue;
    
    // Add accessibility features
    item.accessibilityInformation = {
      label: accessibilityService.generateAccessibleLabel(element),
      role: element.type === 'proxy' ? 'treeitem' : 'group'
    };
    
    // Add command for testing proxy
    if (element.type === 'proxy') {
      item.command = {
        command: 'geminiAggregator.testProxy',
        title: 'Test Proxy',
        arguments: [element.proxyId]
      };
    }
    
    // Add resource URI for custom styling based on health
    if (element.status === 'error') {
      item.resourceUri = vscode.Uri.parse(`error:${element.id}`);
    } else if (element.status === 'checking') {
      item.resourceUri = vscode.Uri.parse(`checking:${element.id}`);
    }
    
    return item;
  }

  /**
   * Get children for tree structure
   */
  async getChildren(element?: ProxyTreeItem): Promise<ProxyTreeItem[]> {
    if (!element) {
      // Root level - return proxy groups and individual proxies
      return this.getRootItems();
    }
    
    // For groups, return child items
    if (element.type === 'proxyGroup') {
      return this.getGroupChildren(element);
    }
    
    return [];
  }

  /**
   * Get root level items
   */
  private async getRootItems(): Promise<ProxyTreeItem[]> {
    const items: ProxyTreeItem[] = [];
    const proxies = uiStateManager.getProxies();
    const isRotatingProxy = uiStateManager.isRotatingProxyEnabled();
    
    // Add proxy mode indicator
    const modeIndicator = this.createProxyModeIndicator(isRotatingProxy);
    items.push(modeIndicator);
    
    if (isRotatingProxy) {
      // Show rotating proxy information
      const rotatingProxyUrl = uiStateManager.getRotatingProxyUrl();
      if (rotatingProxyUrl) {
        const apiKeys = uiStateManager.getApiKeys();
        const rotatingProxyItem = DataTransformers.createRotatingProxyItem(rotatingProxyUrl, apiKeys.length);
        items.push(rotatingProxyItem);
      }
    } else {
      // Add health summary group
      const healthSummary = this.createHealthSummaryItem(proxies);
      items.push(healthSummary);
      
      // Add individual proxies
      for (const proxy of proxies) {
        items.push(proxy);
      }
      
      // If no proxies, show helpful message
      if (proxies.length === 0) {
        items.push(this.createEmptyStateItem());
      }
    }
    
    return items;
  }

  /**
   * Get children for a group
   */
  private getGroupChildren(group: ProxyTreeItem): ProxyTreeItem[] {
    const proxies = uiStateManager.getProxies();
    
    switch (group.id) {
      case 'proxy-mode':
        return this.createProxyModeDetails();
      case 'health-summary':
        return this.createHealthBreakdown(proxies);
      default:
        return [];
    }
  }

  /**
   * Create proxy mode indicator
   */
  private createProxyModeIndicator(isRotatingProxy: boolean): ProxyTreeItem {
    if (isRotatingProxy) {
      return {
        id: 'proxy-mode',
        label: 'Rotating Proxy Mode',
        description: 'Single endpoint with IP rotation',
        tooltip: 'All requests use a single rotating proxy endpoint that automatically changes IP addresses',
        iconPath: ICONS.ROTATING_PROXY,
        contextValue: CONTEXT_VALUES.PROXY_GROUP,
        collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
        type: 'proxyGroup',
        status: 'active'
      };
    } else {
      const proxies = uiStateManager.getProxies();
      const activeCount = proxies.filter(p => p.status === 'active').length;
      
      return {
        id: 'proxy-mode',
        label: 'Individual Proxy Mode',
        description: `${activeCount} active proxies`,
        tooltip: 'Each API key is assigned to a specific proxy server',
        iconPath: ICONS.GROUP,
        contextValue: CONTEXT_VALUES.PROXY_GROUP,
        collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
        type: 'proxyGroup',
        status: activeCount > 0 ? 'active' : 'inactive'
      };
    }
  }

  /**
   * Create health summary group item
   */
  private createHealthSummaryItem(proxies: ProxyTreeItem[]): ProxyTreeItem {
    const healthyCount = proxies.filter(p => p.status === 'active').length;
    const totalCount = proxies.length;
    const hasErrors = proxies.some(p => p.status === 'error');
    const hasChecking = proxies.some(p => p.status === 'checking');
    
    let icon = ICONS.PROXY_ACTIVE;
    let status: 'active' | 'inactive' | 'error' | 'checking' = 'active';
    
    if (hasErrors) {
      icon = ICONS.PROXY_ERROR;
      status = 'error';
    } else if (hasChecking) {
      icon = ICONS.PROXY_CHECKING;
      status = 'checking';
    } else if (healthyCount === 0) {
      icon = ICONS.PROXY_INACTIVE;
      status = 'inactive';
    }
    
    return {
      id: 'health-summary',
      label: 'Proxy Health Overview',
      description: `${healthyCount}/${totalCount} healthy`,
      tooltip: `${healthyCount} healthy proxies out of ${totalCount} total`,
      iconPath: icon,
      contextValue: CONTEXT_VALUES.PROXY_GROUP,
      collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
      type: 'proxyGroup',
      status: status
    };
  }

  /**
   * Create proxy mode details
   */
  private createProxyModeDetails(): ProxyTreeItem[] {
    const isRotatingProxy = uiStateManager.isRotatingProxyEnabled();
    const items: ProxyTreeItem[] = [];
    
    if (isRotatingProxy) {
      const rotatingProxyUrl = uiStateManager.getRotatingProxyUrl();
      const rotatingProxyHealth = uiStateManager.getRotatingProxyHealth();
      const apiKeys = uiStateManager.getApiKeys();
      
      // Endpoint info with health status
      const endpointStatus = rotatingProxyHealth?.isHealthy ? 'active' : 'error';
      const endpointIcon = rotatingProxyHealth?.isHealthy ? ICONS.ROTATING_PROXY : ICONS.PROXY_ERROR;
      
      items.push({
        id: 'rotating-endpoint',
        label: 'Endpoint',
        description: rotatingProxyUrl || 'Not configured',
        iconPath: endpointIcon,
        contextValue: 'rotatingProxyInfo',
        type: 'proxyGroup',
        status: endpointStatus
      });

      // Health status item
      if (rotatingProxyHealth) {
        const healthDescription = rotatingProxyHealth.isHealthy 
          ? `Healthy • ${rotatingProxyHealth.uptime.toFixed(1)}% uptime`
          : `Unhealthy • ${rotatingProxyHealth.errorCount} errors`;
        
        items.push({
          id: 'rotating-health',
          label: 'Health Status',
          description: healthDescription,
          iconPath: rotatingProxyHealth.isHealthy ? ICONS.PROXY_ACTIVE : ICONS.PROXY_ERROR,
          contextValue: 'rotatingProxyHealth',
          type: 'proxyGroup',
          status: rotatingProxyHealth.isHealthy ? 'active' : 'error'
        });

        // Performance metrics
        if (rotatingProxyHealth.responseTime) {
          items.push({
            id: 'rotating-performance',
            label: 'Response Time',
            description: `${rotatingProxyHealth.responseTime}ms`,
            iconPath: ICONS.PROXY_ACTIVE,
            contextValue: 'rotatingProxyPerformance',
            type: 'proxyGroup',
            status: 'active'
          });
        }

        // Last check info
        items.push({
          id: 'rotating-lastcheck',
          label: 'Last Health Check',
          description: rotatingProxyHealth.lastCheck.toLocaleString(),
          iconPath: ICONS.PROXY_ACTIVE,
          contextValue: 'rotatingProxyInfo',
          type: 'proxyGroup',
          status: 'active'
        });
      }
      
      items.push({
        id: 'rotating-keys',
        label: 'API Keys',
        description: `${apiKeys.length} keys using this proxy`,
        iconPath: ICONS.API_KEY_ACTIVE,
        contextValue: 'rotatingProxyInfo',
        type: 'proxyGroup',
        status: 'active'
      });
    } else {
      const proxies = uiStateManager.getProxies();
      const totalAssignments = proxies.reduce((sum, p) => sum + (p.assignedKeys?.length || 0), 0);
      
      items.push({
        id: 'individual-proxies',
        label: 'Individual Proxies',
        description: `${proxies.length} proxies configured`,
        iconPath: ICONS.PROXY_ACTIVE,
        contextValue: 'proxyModeInfo',
        type: 'proxyGroup',
        status: 'active'
      });
      
      items.push({
        id: 'proxy-assignments',
        label: 'Assignments',
        description: `${totalAssignments} API keys assigned`,
        iconPath: ICONS.API_KEY_ACTIVE,
        contextValue: 'proxyModeInfo',
        type: 'proxyGroup',
        status: 'active'
      });
    }
    
    return items;
  }

  /**
   * Create health breakdown items
   */
  private createHealthBreakdown(proxies: ProxyTreeItem[]): ProxyTreeItem[] {
    const healthCounts = {
      active: proxies.filter(p => p.status === 'active').length,
      inactive: proxies.filter(p => p.status === 'inactive').length,
      error: proxies.filter(p => p.status === 'error').length,
      checking: proxies.filter(p => p.status === 'checking').length
    };
    
    const items: ProxyTreeItem[] = [];
    
    if (healthCounts.active > 0) {
      items.push({
        id: 'health-active',
        label: `Healthy Proxies: ${healthCounts.active}`,
        description: 'Ready for requests',
        iconPath: ICONS.PROXY_ACTIVE,
        contextValue: 'healthInfo',
        type: 'proxyGroup',
        status: 'active'
      });
    }
    
    if (healthCounts.checking > 0) {
      items.push({
        id: 'health-checking',
        label: `Checking Health: ${healthCounts.checking}`,
        description: 'Health check in progress',
        iconPath: ICONS.PROXY_CHECKING,
        contextValue: 'healthInfo',
        type: 'proxyGroup',
        status: 'checking'
      });
    }
    
    if (healthCounts.error > 0) {
      items.push({
        id: 'health-error',
        label: `Unhealthy Proxies: ${healthCounts.error}`,
        description: 'Need attention',
        iconPath: ICONS.PROXY_ERROR,
        contextValue: 'healthInfo',
        type: 'proxyGroup',
        status: 'error'
      });
    }
    
    if (healthCounts.inactive > 0) {
      items.push({
        id: 'health-inactive',
        label: `Inactive Proxies: ${healthCounts.inactive}`,
        description: 'Not in use',
        iconPath: ICONS.PROXY_INACTIVE,
        contextValue: 'healthInfo',
        type: 'proxyGroup',
        status: 'inactive'
      });
    }
    
    return items;
  }

  /**
   * Create empty state item
   */
  private createEmptyStateItem(): ProxyTreeItem {
    return {
      id: 'empty-state',
      label: 'No Proxies Configured',
      description: 'Click to add your first proxy',
      tooltip: 'Add proxy servers to improve performance and bypass rate limits',
      iconPath: new vscode.ThemeIcon('add'),
      contextValue: 'emptyState',
      type: 'proxyGroup',
      status: 'inactive'
    };
  }

  /**
   * Get enhanced description with real-time status
   */
  private getEnhancedDescription(element: ProxyTreeItem): string {
    if (element.type !== 'proxy' && element.type !== 'rotatingProxy') {
      return element.description || '';
    }

    const parts: string[] = [];
    
    // Add health status
    switch (element.status) {
      case 'active':
        if (element.healthStatus?.responseTime) {
          parts.push(`${element.healthStatus.responseTime}ms`);
        } else {
          parts.push('healthy');
        }
        break;
      case 'error':
        parts.push('unhealthy');
        break;
      case 'checking':
        parts.push('checking...');
        break;
      case 'inactive':
        parts.push('inactive');
        break;
    }
    
    // Add assignment info
    if (element.assignedKeys && element.assignedKeys.length > 0) {
      parts.push(`${element.assignedKeys.length} keys`);
    }
    
    // Add error count if any
    if (element.healthStatus?.errorCount && element.healthStatus.errorCount > 0) {
      parts.push(`${element.healthStatus.errorCount} errors`);
    }
    
    return parts.join(' • ');
  }

  /**
   * Get enhanced tooltip with detailed information
   */
  private getEnhancedTooltip(element: ProxyTreeItem): string {
    if (element.type !== 'proxy' && element.type !== 'rotatingProxy') {
      return element.tooltip || element.description || '';
    }

    const lines: string[] = [
      `🌐 Proxy: ${element.url}`,
      `📊 Status: ${element.status.toUpperCase()}`,
      ''
    ];
    
    // Health information
    if (element.healthStatus) {
      lines.push('🏥 Health Status:');
      lines.push(`   Healthy: ${element.healthStatus.isHealthy ? 'Yes' : 'No'}`);
      lines.push(`   Last Check: ${element.healthStatus.lastCheck.toLocaleString()}`);
      
      if (element.healthStatus.responseTime) {
        lines.push(`   Response Time: ${element.healthStatus.responseTime}ms`);
      }
      
      if (element.healthStatus.errorCount > 0) {
        lines.push(`   Error Count: ${element.healthStatus.errorCount}`);
      }
    }
    
    // Assignment information
    lines.push('');
    lines.push('🔗 Assignments:');
    if (element.assignedKeys && element.assignedKeys.length > 0) {
      lines.push(`   Assigned Keys: ${element.assignedKeys.length}`);
      element.assignedKeys.forEach(keyId => {
        lines.push(`   • ${keyId}`);
      });
    } else {
      lines.push('   No keys assigned');
    }
    
    // Type-specific information
    if (element.type === 'rotatingProxy') {
      lines.push('');
      lines.push('🔄 Rotating Proxy:');
      lines.push('   Automatically rotates IP addresses');
      lines.push('   Used by all API keys in rotating mode');
    }
    
    return lines.join('\n');
  }

  /**
   * Refresh the tree view
   */
  public refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  /**
   * Update proxy manager references
   */
  public setProxyManagers(proxyPoolManager: ProxyPoolManager, proxyAssignmentManager?: ProxyAssignmentManager): void {
    this.proxyPoolManager = proxyPoolManager;
    this.proxyAssignmentManager = proxyAssignmentManager;
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