export interface ApiKey {
  key: string; // API Key 值
  keyId: string; // 新增 keyId 屬性，用於識別，例如 "key1", "key2"
  status: 'available' | 'cooling_down' | 'disabled'; // 当前状态 (需要持久化)
  coolingDownUntil?: number; // 冷却结束时间戳 (ms) (需要持久化)
  currentRequests: number; // 当前使用此 Key 处理的并发请求数 (可选，用于更复杂的策略)
  lastUsed?: number; // 新增：上次使用時間戳 (ms)，表示該金鑰上次被選中使用的時間
  usedHistory?: { date: number; rate: number }[]; // 新增：金鑰使用歷史 (需要持久化，date 為時間戳)
  
  // Proxy-related fields
  proxy?: string; // Legacy field: direct proxy URL (for backward compatibility)
  assignedProxyId?: string; // ID of the assigned proxy server from the proxy pool
  proxyAssignedAt?: number; // Timestamp when the proxy was assigned
  useRotatingProxy?: boolean; // Flag to indicate if this key should use rotating proxy
  
  // 可以添加其他统计信息，如总请求数、失败次数等
}