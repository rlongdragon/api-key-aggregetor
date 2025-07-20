/**
 * Represents a proxy server in the proxy pool
 */
export interface ProxyServer {
  /**
   * Unique identifier for the proxy
   */
  id: string;
  
  /**
   * Proxy URL (http://, https://, socks://, socks5://)
   */
  url: string;
  
  /**
   * Current status of the proxy
   */
  status: 'active' | 'inactive' | 'error';
  
  /**
   * Number of API keys assigned to this proxy
   */
  assignedKeyCount: number;
  
  /**
   * Timestamp of the last health check
   */
  lastHealthCheck?: number;
  
  /**
   * Number of consecutive errors
   */
  errorCount: number;
  
  /**
   * Last error message (if any)
   */
  lastError?: string;
  
  /**
   * Timestamp when the proxy was added
   */
  createdAt: number;
  
  /**
   * Timestamp when the proxy was last updated
   */
  updatedAt: number;
}

/**
 * Represents an assignment between an API key and a proxy server
 */
export interface ProxyAssignment {
  /**
   * API Key ID
   */
  keyId: string;
  
  /**
   * Proxy server ID
   */
  proxyId: string;
  
  /**
   * Timestamp when the assignment was made
   */
  assignedAt: number;
  
  /**
   * Whether the assignment was made manually
   */
  isManual: boolean;
  
  /**
   * Timestamp when the assignment was last used
   */
  lastUsed?: number;
}