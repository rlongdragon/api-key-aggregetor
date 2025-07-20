/**
 * Type definitions for proxy-related UI components
 */

export interface ProxyDetails {
  id: string;
  url: string;
  status: string;
  assignedKeyCount: number;
  responseTime?: number;
  lastHealthCheck?: Date;
  errorCount: number;
  lastError?: string;
}

export interface ProxyAssignment {
  keyId: string;
  proxyId: string;
  assignedAt: Date;
  isManual: boolean;
}

export interface ProxyQuickPickItem {
  label: string;
  description: string;
  detail: string;
  proxyId: string;
}

export interface ApiKeyQuickPickItem {
  label: string;
  description: string;
  detail: string;
  keyId?: string;
}