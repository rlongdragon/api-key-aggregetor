/**
 * ApiKeyStatus api 的詳細資訊
 */
export interface ApiKeyStatus {
  /**
   * API Key 的 ID
   */
  keyId: string;
  /**
   * API Key 值
   */
  key: string;
  status: "pending" | "success" | "failed" | "cooling_down" | ""; // 請求狀態
  /**
   * 使用此 API Key 的歷史記錄
   * @date 請求時間
   * @rate 使用速率 (每分鐘請求數)
   */
  usedHistory: { date: Date, rate: number, serverCurrentTime?: number }[];
  /**
   * 上次使用時間戳 (ms)
   */
  lastUsed?: number;
  /**
   * 冷卻結束時間戳 (ms)，如果處於冷卻狀態
   */
  coolingDownUntil?: number;
  /**
   * 當前使用此 Key 處理的並發請求數
   */
  currentRequests?: number;
  /**
   * 代理服务器地址 (Legacy field)
   */
  proxy?: string;
  /**
   * ID of the assigned proxy server from the proxy pool
   */
  assignedProxyId?: string;
  /**
   * Timestamp when the proxy was assigned
   */
  proxyAssignedAt?: number;
}
