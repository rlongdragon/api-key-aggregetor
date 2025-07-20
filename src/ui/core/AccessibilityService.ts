import * as vscode from 'vscode';
import { ApiKeyTreeItem, ProxyTreeItem } from '../types/TreeViewTypes';

/**
 * Service for managing accessibility features across the extension
 */
export class AccessibilityService {
  private static instance: AccessibilityService;

  private constructor() {}

  /**
   * Get singleton instance
   */
  public static getInstance(): AccessibilityService {
    if (!AccessibilityService.instance) {
      AccessibilityService.instance = new AccessibilityService();
    }
    return AccessibilityService.instance;
  }

  /**
   * Generate accessible description for API key tree item
   */
  public generateApiKeyAccessibleDescription(item: ApiKeyTreeItem): string {
    const parts: string[] = [];
    
    // Basic info
    parts.push(`API Key ${item.keyId || 'Unknown'}`);
    
    // Status
    switch (item.status) {
      case 'active':
        parts.push('Status: Active and ready for requests');
        break;
      case 'inactive':
        parts.push('Status: Inactive, not currently processing requests');
        break;
      case 'error':
        parts.push('Status: Error, requires attention');
        break;
      case 'rate_limited':
        parts.push('Status: Rate limited, temporarily unavailable');
        break;
      default:
        parts.push(`Status: ${item.status}`);
    }
    
    // Usage information
    if (item.usageStats) {
      const { totalRequests, successfulRequests, failedRequests } = item.usageStats;
      parts.push(`Usage: ${totalRequests} total requests, ${successfulRequests} successful, ${failedRequests} failed`);
    }
    
    // Current activity
    if (item.currentRequests && item.currentRequests > 0) {
      parts.push(`Currently processing ${item.currentRequests} requests`);
    }
    
    // Proxy assignment
    if (item.proxyAssigned) {
      parts.push(`Assigned to proxy: ${item.proxyAssigned}`);
    } else {
      parts.push('No proxy assigned, using direct connection');
    }
    
    // Last used
    if (item.lastUsed) {
      const lastUsedDate = typeof item.lastUsed === 'number' ? new Date(item.lastUsed) : item.lastUsed;
      const timeSince = Date.now() - lastUsedDate.getTime();
      const minutesAgo = Math.floor(timeSince / 60000);
      
      if (minutesAgo < 1) {
        parts.push('Last used: Just now');
      } else if (minutesAgo < 60) {
        parts.push(`Last used: ${minutesAgo} minutes ago`);
      } else {
        const hoursAgo = Math.floor(minutesAgo / 60);
        parts.push(`Last used: ${hoursAgo} hours ago`);
      }
    }
    
    return parts.join('. ');
  }

  /**
   * Generate accessible description for proxy tree item
   */
  public generateProxyAccessibleDescription(item: ProxyTreeItem): string {
    const parts: string[] = [];
    
    // Basic info
    const proxyName = item.url || item.proxyId || 'Unknown proxy';
    parts.push(`Proxy ${proxyName}`);
    
    // Status
    switch (item.status) {
      case 'active':
        parts.push('Status: Active and healthy');
        break;
      case 'inactive':
        parts.push('Status: Inactive, not currently in use');
        break;
      case 'error':
        parts.push('Status: Error, connection failed');
        break;
      case 'checking':
        parts.push('Status: Health check in progress');
        break;
      default:
        parts.push(`Status: ${item.status}`);
    }
    
    // Health information
    if (item.healthStatus) {
      const { isHealthy, responseTime, errorCount, lastCheck } = item.healthStatus;
      
      if (isHealthy) {
        parts.push('Health: Good');
      } else {
        parts.push('Health: Poor, may have connectivity issues');
      }
      
      if (responseTime) {
        parts.push(`Response time: ${responseTime} milliseconds`);
      }
      
      if (errorCount > 0) {
        parts.push(`Error count: ${errorCount} recent errors`);
      }
      
      if (lastCheck) {
        const checkTime = typeof lastCheck === 'number' ? new Date(lastCheck) : lastCheck;
        const timeSince = Date.now() - checkTime.getTime();
        const minutesAgo = Math.floor(timeSince / 60000);
        
        if (minutesAgo < 1) {
          parts.push('Last checked: Just now');
        } else if (minutesAgo < 60) {
          parts.push(`Last checked: ${minutesAgo} minutes ago`);
        } else {
          const hoursAgo = Math.floor(minutesAgo / 60);
          parts.push(`Last checked: ${hoursAgo} hours ago`);
        }
      }
    }
    
    // Assignment information
    if (item.assignedKeys && item.assignedKeys.length > 0) {
      parts.push(`Assigned to ${item.assignedKeys.length} API keys`);
    } else {
      parts.push('No API keys assigned');
    }
    
    return parts.join('. ');
  }

  /**
   * Generate accessible label for tree item
   */
  public generateAccessibleLabel(item: ApiKeyTreeItem | ProxyTreeItem): string {
    if ('keyId' in item) {
      // API Key item
      const statusText = this.getStatusText(item.status);
      return `${item.keyId || 'Unknown API Key'}, ${statusText}`;
    } else {
      // Proxy item
      const proxyItem = item as ProxyTreeItem;
      const proxyName = proxyItem.url || proxyItem.proxyId || 'Unknown Proxy';
      const statusText = this.getStatusText(item.status);
      return `${proxyName}, ${statusText}`;
    }
  }

  /**
   * Get human-readable status text
   */
  private getStatusText(status: string): string {
    switch (status) {
      case 'active':
        return 'Active';
      case 'inactive':
        return 'Inactive';
      case 'error':
        return 'Error';
      case 'rate_limited':
        return 'Rate Limited';
      case 'checking':
        return 'Checking';
      default:
        return status;
    }
  }

  /**
   * Generate keyboard navigation instructions
   */
  public generateKeyboardInstructions(): string {
    return [
      'Use arrow keys to navigate between items',
      'Press Enter to activate the selected item',
      'Press Space to expand or collapse groups',
      'Use Tab to move between different sections',
      'Press F2 to rename items where supported',
      'Use context menu key or Shift+F10 for additional actions'
    ].join('. ');
  }

  /**
   * Generate screen reader announcement for status changes
   */
  public generateStatusChangeAnnouncement(
    itemType: 'API Key' | 'Proxy',
    itemName: string,
    oldStatus: string,
    newStatus: string
  ): string {
    const statusChange = `${itemType} ${itemName} status changed from ${this.getStatusText(oldStatus)} to ${this.getStatusText(newStatus)}`;
    
    // Add context based on new status
    switch (newStatus) {
      case 'error':
        return `${statusChange}. Attention required.`;
      case 'active':
        return `${statusChange}. Now available for use.`;
      case 'rate_limited':
        return `${statusChange}. Temporarily unavailable due to rate limiting.`;
      default:
        return statusChange;
    }
  }

  /**
   * Generate progress announcement
   */
  public generateProgressAnnouncement(
    operation: string,
    progress: number,
    message?: string
  ): string {
    const progressText = `${operation} ${progress}% complete`;
    return message ? `${progressText}. ${message}` : progressText;
  }

  /**
   * Generate error announcement with suggestions
   */
  public generateErrorAnnouncement(
    error: string,
    suggestions?: string[]
  ): string {
    let announcement = `Error: ${error}`;
    
    if (suggestions && suggestions.length > 0) {
      announcement += `. Suggestions: ${suggestions.join(', ')}`;
    }
    
    return announcement;
  }

  /**
   * Check if high contrast mode is enabled
   */
  public isHighContrastMode(): boolean {
    // VS Code automatically handles high contrast detection
    // This method can be used for additional high contrast specific logic
    return vscode.window.activeColorTheme.kind === vscode.ColorThemeKind.HighContrast ||
           vscode.window.activeColorTheme.kind === vscode.ColorThemeKind.HighContrastLight;
  }

  /**
   * Get appropriate contrast ratio for current theme
   */
  public getContrastRatio(): number {
    if (this.isHighContrastMode()) {
      return 7.0; // WCAG AAA standard
    } else {
      return 4.5; // WCAG AA standard
    }
  }

  /**
   * Announce important changes to screen readers
   */
  public announceToScreenReader(message: string): void {
    // VS Code doesn't have a direct screen reader API, but we can use
    // status bar messages or information messages for important announcements
    vscode.window.setStatusBarMessage(message, 3000);
  }

  /**
   * Create accessible tooltip text
   */
  public createAccessibleTooltip(
    title: string,
    description: string,
    actions?: string[]
  ): string {
    let tooltip = `${title}. ${description}`;
    
    if (actions && actions.length > 0) {
      tooltip += `. Available actions: ${actions.join(', ')}`;
    }
    
    return tooltip;
  }

  /**
   * Format number for screen readers
   */
  public formatNumberForScreenReader(
    value: number,
    unit?: string,
    context?: string
  ): string {
    let formatted = value.toString();
    
    if (unit) {
      formatted += ` ${unit}`;
      if (value !== 1) {
        formatted += 's';
      }
    }
    
    if (context) {
      formatted = `${context}: ${formatted}`;
    }
    
    return formatted;
  }

  /**
   * Format time duration for screen readers
   */
  public formatDurationForScreenReader(milliseconds: number): string {
    if (milliseconds < 1000) {
      return `${milliseconds} milliseconds`;
    }
    
    const seconds = Math.floor(milliseconds / 1000);
    if (seconds < 60) {
      return `${seconds} second${seconds !== 1 ? 's' : ''}`;
    }
    
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    
    let result = `${minutes} minute${minutes !== 1 ? 's' : ''}`;
    if (remainingSeconds > 0) {
      result += ` and ${remainingSeconds} second${remainingSeconds !== 1 ? 's' : ''}`;
    }
    
    return result;
  }
}

/**
 * Global accessibility service instance
 */
export const accessibilityService = AccessibilityService.getInstance();