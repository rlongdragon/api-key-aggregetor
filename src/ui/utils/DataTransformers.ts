import { ApiKey } from '../../server/types/ApiKey';
import { ProxyServer } from '../../server/types/Proxy';
import { ApiKeyTreeItem, ProxyTreeItem, ICONS, CONTEXT_VALUES } from '../types/TreeViewTypes';
import { themeService } from '../core/ThemeService';

/**
 * Transforms core data models to UI tree items
 */
export class DataTransformers {
  
  /**
   * Transform ApiKey to ApiKeyTreeItem
   */
  static transformApiKey(apiKey: ApiKey): ApiKeyTreeItem {
    const status = DataTransformers.getApiKeyStatus(apiKey);
    const icon = DataTransformers.getApiKeyIcon(status);
    
    return {
      id: apiKey.keyId,
      label: `API Key ${apiKey.keyId}`,
      description: DataTransformers.getApiKeyDescription(apiKey),
      tooltip: DataTransformers.getApiKeyTooltip(apiKey),
      iconPath: icon,
      contextValue: CONTEXT_VALUES.API_KEY,
      type: 'apiKey',
      keyId: apiKey.keyId,
      status: status,
      currentRequests: apiKey.currentRequests,
      lastUsed: typeof apiKey.lastUsed === 'number' ? new Date(apiKey.lastUsed) : apiKey.lastUsed,
      proxyAssigned: apiKey.proxy,
      usageStats: {
        totalRequests: apiKey.usedHistory?.length || 0,
        successfulRequests: apiKey.usedHistory?.length || 0, // Simplified
        failedRequests: 0 // Simplified
      }
    };
  }

  /**
   * Transform ProxyServer to ProxyTreeItem
   */
  static transformProxy(proxy: ProxyServer): ProxyTreeItem {
    const icon = DataTransformers.getProxyIcon(proxy.status);
    
    return {
      id: proxy.id,
      label: DataTransformers.getProxyLabel(proxy),
      description: DataTransformers.getProxyDescription(proxy),
      tooltip: DataTransformers.getProxyTooltip(proxy),
      iconPath: icon,
      contextValue: CONTEXT_VALUES.PROXY,
      type: 'proxy',
      proxyId: proxy.id,
      url: proxy.url,
      status: DataTransformers.mapProxyStatus(proxy.status),
      assignedKeys: [], // Will be populated by assignment manager
      healthStatus: {
        lastCheck: typeof proxy.lastHealthCheck === 'number' ? new Date(proxy.lastHealthCheck) : (proxy.lastHealthCheck || new Date()),
        responseTime: (proxy as any).responseTime,
        errorCount: proxy.errorCount,
        isHealthy: proxy.status === 'active'
      }
    };
  }

  /**
   * Create rotating proxy tree item
   */
  static createRotatingProxyItem(url: string, keyCount: number): ProxyTreeItem {
    return {
      id: 'rotating-proxy',
      label: 'Rotating Proxy',
      description: `${keyCount} keys assigned`,
      tooltip: `Rotating proxy endpoint: ${url}\nAutomatically rotates IP addresses per request`,
      iconPath: ICONS.ROTATING_PROXY,
      contextValue: CONTEXT_VALUES.ROTATING_PROXY,
      type: 'rotatingProxy',
      url: url,
      status: 'active',
      assignedKeys: [],
      healthStatus: {
        lastCheck: new Date(),
        isHealthy: true,
        errorCount: 0
      }
    };
  }

  /**
   * Get API key status from core model
   */
  private static getApiKeyStatus(apiKey: ApiKey): 'active' | 'inactive' | 'error' | 'rate_limited' {
    switch (apiKey.status) {
      case 'available':
        return 'active';
      case 'cooling_down':
        return 'rate_limited';
      case 'disabled':
        return 'error';
      default:
        return 'inactive';
    }
  }

  /**
   * Get appropriate icon for API key status with theme support
   */
  private static getApiKeyIcon(status: string) {
    const icons = themeService.getStateIcons();
    
    switch (status) {
      case 'active':
        return icons.apiKey.active;
      case 'rate_limited':
        return icons.apiKey.rateLimited;
      case 'error':
        return icons.apiKey.error;
      default:
        return icons.apiKey.inactive;
    }
  }

  /**
   * Get API key description
   */
  private static getApiKeyDescription(apiKey: ApiKey): string {
    const parts: string[] = [];
    
    if (apiKey.currentRequests > 0) {
      parts.push(`${apiKey.currentRequests} active`);
    }
    
    if (apiKey.proxy) {
      parts.push('proxied');
    }
    
    if (apiKey.lastUsed) {
      const lastUsedTime = typeof apiKey.lastUsed === 'number' ? apiKey.lastUsed : (apiKey.lastUsed as Date).getTime();
      const timeSince = Date.now() - lastUsedTime;
      if (timeSince < 60000) {
        parts.push('just used');
      } else if (timeSince < 3600000) {
        parts.push(`${Math.floor(timeSince / 60000)}m ago`);
      }
    }
    
    return parts.join(' • ') || 'ready';
  }

  /**
   * Get API key tooltip
   */
  private static getApiKeyTooltip(apiKey: ApiKey): string {
    const lines: string[] = [
      `API Key: ${apiKey.keyId}`,
      `Status: ${apiKey.status}`,
      `Current Requests: ${apiKey.currentRequests}`
    ];
    
    if (apiKey.proxy) {
      lines.push(`Proxy: ${apiKey.proxy}`);
    }
    
    if (apiKey.lastUsed) {
      lines.push(`Last Used: ${apiKey.lastUsed.toLocaleString()}`);
    }
    
    if (apiKey.usedHistory && apiKey.usedHistory.length > 0) {
      lines.push(`Total Usage: ${apiKey.usedHistory.length} requests`);
    }
    
    return lines.join('\n');
  }

  /**
   * Get proxy label
   */
  private static getProxyLabel(proxy: ProxyServer): string {
    try {
      const url = new URL(proxy.url);
      return `${url.hostname}:${url.port}`;
    } catch {
      return proxy.url;
    }
  }

  /**
   * Get proxy description
   */
  private static getProxyDescription(proxy: ProxyServer): string {
    const parts: string[] = [];
    
    if (proxy.assignedKeyCount > 0) {
      parts.push(`${proxy.assignedKeyCount} keys`);
    }
    
    if ((proxy as any).responseTime) {
      parts.push(`${(proxy as any).responseTime}ms`);
    }
    
    if (proxy.errorCount > 0) {
      parts.push(`${proxy.errorCount} errors`);
    }
    
    return parts.join(' • ') || proxy.status;
  }

  /**
   * Get proxy tooltip
   */
  private static getProxyTooltip(proxy: ProxyServer): string {
    const lines: string[] = [
      `Proxy: ${proxy.url}`,
      `Status: ${proxy.status}`,
      `Assigned Keys: ${proxy.assignedKeyCount}`
    ];
    
    if (proxy.lastHealthCheck) {
      lines.push(`Last Check: ${proxy.lastHealthCheck.toLocaleString()}`);
    }
    
    if ((proxy as any).responseTime) {
      lines.push(`Response Time: ${(proxy as any).responseTime}ms`);
    }
    
    if (proxy.errorCount > 0) {
      lines.push(`Error Count: ${proxy.errorCount}`);
    }
    
    if (proxy.lastError) {
      lines.push(`Last Error: ${proxy.lastError}`);
    }
    
    return lines.join('\n');
  }

  /**
   * Get appropriate icon for proxy status with theme support
   */
  private static getProxyIcon(status: string) {
    const icons = themeService.getStateIcons();
    
    switch (status) {
      case 'active':
        return icons.proxy.active;
      case 'error':
        return icons.proxy.error;
      case 'checking':
        return icons.proxy.checking;
      default:
        return icons.proxy.inactive;
    }
  }

  /**
   * Map proxy status from core to UI
   */
  private static mapProxyStatus(status: string): 'active' | 'inactive' | 'error' | 'checking' {
    switch (status) {
      case 'active':
        return 'active';
      case 'error':
        return 'error';
      case 'checking':
        return 'checking';
      default:
        return 'inactive';
    }
  }
}