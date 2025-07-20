import * as vscode from 'vscode';

/**
 * Base interface for all tree items in the native UI
 */
export interface BaseTreeItem {
  id: string;
  label: string;
  description?: string;
  tooltip?: string;
  iconPath?: vscode.ThemeIcon;
  contextValue?: string;
  collapsibleState?: vscode.TreeItemCollapsibleState;
}

/**
 * API Key tree item representation
 */
export interface ApiKeyTreeItem extends BaseTreeItem {
  type: 'apiKey' | 'apiKeyGroup';
  keyId?: string;
  status: 'active' | 'inactive' | 'error' | 'rate_limited';
  currentRequests?: number;
  lastUsed?: Date;
  proxyAssigned?: string;
  usageStats?: {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
  };
}

/**
 * Proxy tree item representation
 */
export interface ProxyTreeItem extends BaseTreeItem {
  type: 'proxy' | 'proxyGroup' | 'rotatingProxy';
  proxyId?: string;
  url?: string;
  status: 'active' | 'inactive' | 'error' | 'checking';
  assignedKeys?: string[];
  healthStatus?: {
    lastCheck: Date;
    responseTime?: number;
    errorCount: number;
    isHealthy: boolean;
  };
}

/**
 * Server status information
 */
export interface ServerStatus {
  isRunning: boolean;
  port?: number;
  uptime?: number;
  totalRequests: number;
  activeConnections: number;
  lastError?: string;
}

/**
 * Overall UI state management
 */
export interface UIState {
  serverStatus: ServerStatus;
  apiKeys: ApiKeyTreeItem[];
  proxies: ProxyTreeItem[];
  isRotatingProxyMode: boolean;
  rotatingProxyUrl?: string;
  rotatingProxyHealth?: {
    isHealthy: boolean;
    lastCheck: Date;
    responseTime?: number;
    errorCount: number;
    uptime: number;
    lastError?: string;
  };
  lastRefresh: Date;
}

/**
 * Event types for UI updates
 */
export interface UIEvents {
  'apiKeyAdded': { keyId: string; item: ApiKeyTreeItem };
  'apiKeyRemoved': { keyId: string };
  'apiKeyUpdated': { keyId: string; item: ApiKeyTreeItem };
  'proxyAdded': { proxyId: string; item: ProxyTreeItem };
  'proxyRemoved': { proxyId: string };
  'proxyUpdated': { proxyId: string; item: ProxyTreeItem };
  'serverStatusChanged': { status: ServerStatus };
  'refreshRequested': {};
}

/**
 * Command context values for tree items
 */
export const CONTEXT_VALUES = {
  API_KEY: 'apiKey',
  API_KEY_GROUP: 'apiKeyGroup',
  PROXY: 'proxy',
  PROXY_GROUP: 'proxyGroup',
  ROTATING_PROXY: 'rotatingProxy'
} as const;

/**
 * Theme-aware icon mappings for different states
 * Uses VS Code's ThemeIcon system for consistent iconography across themes
 */
export const ICONS = {
  // API Key icons with theme-aware colors
  API_KEY_ACTIVE: new vscode.ThemeIcon('key', new vscode.ThemeColor('testing.iconPassed')),
  API_KEY_INACTIVE: new vscode.ThemeIcon('key', new vscode.ThemeColor('testing.iconQueued')),
  API_KEY_ERROR: new vscode.ThemeIcon('key', new vscode.ThemeColor('testing.iconFailed')),
  API_KEY_RATE_LIMITED: new vscode.ThemeIcon('key', new vscode.ThemeColor('testing.iconSkipped')),
  API_KEY_LOADING: new vscode.ThemeIcon('loading~spin', new vscode.ThemeColor('progressBar.background')),
  
  // Proxy icons with semantic colors
  PROXY_ACTIVE: new vscode.ThemeIcon('globe', new vscode.ThemeColor('testing.iconPassed')),
  PROXY_INACTIVE: new vscode.ThemeIcon('globe', new vscode.ThemeColor('testing.iconQueued')),
  PROXY_ERROR: new vscode.ThemeIcon('globe', new vscode.ThemeColor('testing.iconFailed')),
  PROXY_CHECKING: new vscode.ThemeIcon('sync~spin', new vscode.ThemeColor('progressBar.background')),
  PROXY_WARNING: new vscode.ThemeIcon('warning', new vscode.ThemeColor('list.warningForeground')),
  
  // Server icons with status colors
  SERVER_RUNNING: new vscode.ThemeIcon('server-process', new vscode.ThemeColor('testing.iconPassed')),
  SERVER_STOPPED: new vscode.ThemeIcon('server-process', new vscode.ThemeColor('testing.iconQueued')),
  SERVER_ERROR: new vscode.ThemeIcon('server-process', new vscode.ThemeColor('testing.iconFailed')),
  SERVER_STARTING: new vscode.ThemeIcon('loading~spin', new vscode.ThemeColor('progressBar.background')),
  
  // Group and organizational icons
  GROUP: new vscode.ThemeIcon('folder', new vscode.ThemeColor('icon.foreground')),
  GROUP_EXPANDED: new vscode.ThemeIcon('folder-opened', new vscode.ThemeColor('icon.foreground')),
  ROTATING_PROXY: new vscode.ThemeIcon('sync', new vscode.ThemeColor('symbolIcon.operatorForeground')),
  
  // Action icons
  ADD: new vscode.ThemeIcon('add', new vscode.ThemeColor('icon.foreground')),
  REMOVE: new vscode.ThemeIcon('trash', new vscode.ThemeColor('testing.iconFailed')),
  REFRESH: new vscode.ThemeIcon('refresh', new vscode.ThemeColor('icon.foreground')),
  SETTINGS: new vscode.ThemeIcon('gear', new vscode.ThemeColor('icon.foreground')),
  INFO: new vscode.ThemeIcon('info', new vscode.ThemeColor('symbolIcon.keywordForeground')),
  
  // Status indicators
  SUCCESS: new vscode.ThemeIcon('check', new vscode.ThemeColor('testing.iconPassed')),
  WARNING: new vscode.ThemeIcon('warning', new vscode.ThemeColor('list.warningForeground')),
  ERROR: new vscode.ThemeIcon('error', new vscode.ThemeColor('testing.iconFailed')),
  LOADING: new vscode.ThemeIcon('loading~spin', new vscode.ThemeColor('progressBar.background'))
} as const;