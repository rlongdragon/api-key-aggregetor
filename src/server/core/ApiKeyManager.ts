import { ApiKey } from "../types/ApiKey";
import { eventManager, EventManager } from "./EventManager"; // 引入 EventManager 類別
import * as vscode from "vscode"; // 引入 vscode 模組
import { ProxyPoolManager } from "./ProxyPoolManager";
import { ProxyAssignmentManager } from "./ProxyAssignmentManager";
import { ProxyLoadBalancer } from "./ProxyLoadBalancer";
import config from "../config";

class ApiKeyManager {
  private keys: Map<string, ApiKey> = new Map();
  private roundRobinIndex: number = 0;
  private eventManager: EventManager; // 修改為 EventManager 類型
  private context: vscode.ExtensionContext; // 新增屬性
  private proxyPoolManager?: ProxyPoolManager;
  private proxyAssignmentManager?: ProxyAssignmentManager;
  private proxyLoadBalancer?: ProxyLoadBalancer;

  constructor(
    apiKeys: ApiKey[], 
    eventManager: EventManager, 
    context: vscode.ExtensionContext,
    proxyPoolManager?: ProxyPoolManager,
    proxyAssignmentManager?: ProxyAssignmentManager,
    proxyLoadBalancer?: ProxyLoadBalancer
  ) { 
    this.eventManager = eventManager;
    this.context = context;
    this.proxyPoolManager = proxyPoolManager;
    this.proxyAssignmentManager = proxyAssignmentManager;
    this.proxyLoadBalancer = proxyLoadBalancer;
    this.loadKeys(apiKeys); // loadKeys 將在 extension.ts 中被調用，並傳遞帶有 keyId 的 ApiKey 物件
    setInterval(() => this.checkCoolingDownKeys(), 2000);
  }

  async loadKeys(apiKeys: ApiKey[]): Promise<void> { // 修改為 async
    if (!apiKeys || apiKeys.length === 0) {
      console.warn('ApiKeyManager: 未加载任何 API Key。请检查配置。');
      return;
    }

    this.keys.clear();
    for (const keyObj of apiKeys) { // 使用 for...of 處理 async/await
      const keyStatusId = `apiKeyStatus_${keyObj.keyId}`;
      const storedStatusJson = await this.context.secrets.get(keyStatusId);
      let status: 'available' | 'cooling_down' | 'disabled' = 'available';
      let coolingDownUntil: number | undefined = undefined;
      let usedHistory: { date: number; rate: number; serverCurrentTime?: number }[] = []; // 新增：初始化 usedHistory

      // Legacy proxy field (for backward compatibility)
      let proxy: string | undefined = undefined;
      
      // Enhanced proxy fields
      let assignedProxyId: string | undefined = undefined;
      let proxyAssignedAt: number | undefined = undefined;
      
      if (storedStatusJson) {
        try {
          const storedStatus = JSON.parse(storedStatusJson);
          status = storedStatus.status || 'available';
          coolingDownUntil = storedStatus.coolingDownUntil;
          usedHistory = storedStatus.usedHistory || []; // 新增：載入 usedHistory
          proxy = storedStatus.proxy;
          assignedProxyId = storedStatus.assignedProxyId;
          proxyAssignedAt = storedStatus.proxyAssignedAt;
          console.log(`ApiKeyManager: Key ${keyObj.keyId} 載入的 usedHistory:`, usedHistory); // 添加日誌
        } catch (e) {
          console.error(`ApiKeyManager: 解析 Key ${keyObj.keyId} 狀態失敗:`, e);
        }
      } else {
        console.log(`ApiKeyManager: Key ${keyObj.keyId} 沒有找到持久化狀態，usedHistory 初始化為空。`); // 添加日誌
      }

      this.keys.set(keyObj.key, {
        key: keyObj.key,
        keyId: keyObj.keyId,
        status: status, // 使用持久化的狀態
        coolingDownUntil: coolingDownUntil, // 使用持久化的冷卻時間
        currentRequests: keyObj.currentRequests || 0,
        lastUsed: keyObj.lastUsed,
        usedHistory: usedHistory, // 新增：設置 usedHistory
        proxy: proxy, // Legacy field
        assignedProxyId: assignedProxyId,
        proxyAssignedAt: proxyAssignedAt
      });
      
      // If we have a ProxyAssignmentManager and this key doesn't have an assigned proxy,
      // but has a legacy proxy URL, migrate it to the new system
      if (this.proxyAssignmentManager && this.proxyPoolManager && proxy && !assignedProxyId) {
        try {
          // Try to find or create a proxy with this URL
          let proxyId: string | undefined;
          const availableProxies = this.proxyPoolManager.getAvailableProxies();
          const existingProxy = availableProxies.find(p => p.url === proxy);
          
          if (existingProxy) {
            proxyId = existingProxy.id;
          } else {
            // Create a new proxy with this URL
            proxyId = await this.proxyPoolManager.addProxy(proxy);
          }
          
          // Assign this proxy to the key
          if (proxyId) {
            await this.proxyAssignmentManager.assignProxyToKey(keyObj.keyId, proxyId, true);
            console.log(`ApiKeyManager: Migrated legacy proxy for key ${keyObj.keyId} to new proxy system`);
          }
        } catch (error) {
          console.error(`ApiKeyManager: Failed to migrate legacy proxy for key ${keyObj.keyId}:`, error);
        }
      }
      
      // If we have a ProxyAssignmentManager but this key doesn't have an assigned proxy,
      // try to assign one automatically (only if not using rotating proxy mode)
      if (this.proxyAssignmentManager && !assignedProxyId && !proxy && !config.USE_ROTATING_PROXY) {
        try {
          await this.proxyAssignmentManager.assignProxyToKey(keyObj.keyId);
          console.log(`ApiKeyManager: Automatically assigned proxy for key ${keyObj.keyId}`);
        } catch (error) {
          console.warn(`ApiKeyManager: Failed to auto-assign proxy for key ${keyObj.keyId}:`, error);
        }
      } else if (config.USE_ROTATING_PROXY) {
        console.log(`ApiKeyManager: Skipping individual proxy assignment for key ${keyObj.keyId} - using rotating proxy mode`);
      }
      
      this.eventManager.emitApiKeyStatusUpdate(this.keys.get(keyObj.key)!); // 發送初始狀態
    }
    console.info(`ApiKeyManager: 成功加载 ${this.keys.size} 个 API Key。`);
  }

  private async saveKeyStatus(apiKey: ApiKey): Promise<void> {
    const keyStatusId = `apiKeyStatus_${apiKey.keyId}`;
    const statusData = {
      status: apiKey.status,
      coolingDownUntil: apiKey.coolingDownUntil,
      usedHistory: apiKey.usedHistory, // 新增：儲存 usedHistory
      proxy: apiKey.proxy, // Legacy field for backward compatibility
      assignedProxyId: apiKey.assignedProxyId, // Enhanced proxy field
      proxyAssignedAt: apiKey.proxyAssignedAt // Enhanced proxy field
    };
    await this.context.secrets.store(keyStatusId, JSON.stringify(statusData));
    console.log(`ApiKeyManager: Key ${apiKey.keyId} 狀態和歷史已持久化。`);
  }

  private isValidProxyUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      return ['http:', 'https:', 'socks:', 'socks5:'].includes(parsed.protocol);
    } catch {
      return false;
    }
  }

  public async updateApiKeyProxy(keyId: string, proxy: string): Promise<void> {
    // Validate proxy URL format
    if (proxy && !this.isValidProxyUrl(proxy)) {
      throw new Error(`Invalid proxy URL format: ${proxy}`);
    }

    for (const apiKey of this.keys.values()) {
      if (apiKey.keyId === keyId) {
        const originalProxy = apiKey.proxy;
        apiKey.proxy = proxy;
        try {
          await this.saveKeyStatus(apiKey);
          this.eventManager.emitApiKeyStatusUpdate(apiKey);
        } catch (error) {
          // Rollback on error
          apiKey.proxy = originalProxy;
          throw error;
        }
        break;
      }
    }
  }

  private isRotatingProxy: boolean = false;
  private proxies: string[] = [];
  private proxyRoundRobinIndex: number = 0;

  public setRotatingProxy(isRotatingProxy: boolean): void {
    this.isRotatingProxy = isRotatingProxy;
  }

  public setProxies(proxies: string[]): void {
    // Validate all proxy URLs
    const invalidProxies = proxies.filter(proxy => proxy && !this.isValidProxyUrl(proxy));
    if (invalidProxies.length > 0) {
      throw new Error(`Invalid proxy URLs: ${invalidProxies.join(', ')}`);
    }
    this.proxies = proxies;
  }

  async getAvailableKey(): Promise<ApiKey | null> {
    const availableKeys = Array.from(this.keys.values()).filter(
      key => key.status === 'available' && (!key.coolingDownUntil || key.coolingDownUntil <= Date.now())
    );

    if (availableKeys.length === 0) {
      console.warn('ApiKeyManager: 没有可用的 API Key。');
      return null;
    }

    // 简单轮询策略
    const selectedKey = availableKeys[this.roundRobinIndex % availableKeys.length];
    this.roundRobinIndex = (this.roundRobinIndex + 1) % availableKeys.length;

    // 更新 lastUsed 並發送事件
    selectedKey.lastUsed = Date.now();
    
    // Create a copy of the selected key to avoid modifying the original
    let keyToReturn = { ...selectedKey };
    
    // Handle proxy assignment (skip if using rotating proxy mode)
    if (this.proxyAssignmentManager && selectedKey.keyId && !config.USE_ROTATING_PROXY) {
      try {
        // Get the current assignment for this key
        const assignment = this.proxyAssignmentManager.getAssignmentForKey(selectedKey.keyId);
        
        if (assignment && this.proxyPoolManager) {
          // Get the proxy details
          const proxy = this.proxyPoolManager.getProxy(assignment.proxyId);
          
          if (proxy && proxy.status === 'active') {
            // Use the assigned proxy
            keyToReturn.proxy = proxy.url;
            
            // Update the last used timestamp for this assignment
            await this.proxyAssignmentManager.updateLastUsed(selectedKey.keyId);
            
            console.log(`ApiKeyManager: Using assigned proxy ${proxy.url} for key ${selectedKey.keyId}`);
          } else {
            console.warn(`ApiKeyManager: Assigned proxy for key ${selectedKey.keyId} is not active, using direct connection`);
          }
        }
      } catch (error) {
        console.error(`ApiKeyManager: Error getting proxy assignment for key ${selectedKey.keyId}:`, error);
      }
    } else if (config.USE_ROTATING_PROXY) {
      console.log(`ApiKeyManager: Using rotating proxy mode for key ${selectedKey.keyId} - individual proxy assignment skipped`);
    } 
    // Fall back to legacy rotating proxy if no assignment manager or assignment found
    else if (this.isRotatingProxy && this.proxies.length > 0) {
      keyToReturn.proxy = this.proxies[this.proxyRoundRobinIndex % this.proxies.length];
      this.proxyRoundRobinIndex = (this.proxyRoundRobinIndex + 1) % this.proxies.length;
      console.log(`ApiKeyManager: Using rotating proxy ${keyToReturn.proxy} for key ${selectedKey.keyId}`);
    }
    
    this.eventManager.emitApiKeyStatusUpdate(selectedKey);
    return keyToReturn;
  }

  async markAsCoolingDown(key: string, durationMs: number): Promise<void> { // 修改為 async
    const apiKey = this.keys.get(key);
    if (apiKey) {
      apiKey.status = 'cooling_down';
      apiKey.coolingDownUntil = Date.now() + durationMs;
      console.warn(`ApiKeyManager: Key ${apiKey.keyId} 标记为冷却中，直到 ${new Date(apiKey.coolingDownUntil).toISOString()}`);
      this.eventManager.emitApiKeyStatusUpdate(apiKey);
      await this.saveKeyStatus(apiKey); // 持久化狀態
    }
  }

  async markAsAvailable(key: string): Promise<void> { // 修改為 async
    const apiKey = this.keys.get(key);
    if (apiKey) {
      apiKey.status = 'available';
      apiKey.coolingDownUntil = undefined;
      console.info(`ApiKeyManager: Key ${apiKey.keyId} 标记为可用。`);
      this.eventManager.emitApiKeyStatusUpdate(apiKey);
      await this.saveKeyStatus(apiKey); // 持久化狀態
    }
  }

  // 可选方法，用于更复杂的并发控制
  incrementRequestCount(key: string): void {
    const apiKey = this.keys.get(key);
    if (apiKey) {
      apiKey.currentRequests++;
    }
  }

  // 可选方法，用于更复杂的并发控制
  decrementRequestCount(key: string): void {
    const apiKey = this.keys.get(key);
    if (apiKey && apiKey.currentRequests > 0) {
      apiKey.currentRequests--;
    }
  }

  private async checkCoolingDownKeys(): Promise<void> { // 修改為 async
    const now = Date.now();
    for (const apiKey of this.keys.values()) { // 使用 for...of 處理 async/await
      if (apiKey.status === 'cooling_down' && apiKey.coolingDownUntil && apiKey.coolingDownUntil <= now) {
        await this.markAsAvailable(apiKey.key); // 等待持久化完成
      }
    }
  }

  public getAllKeys(): ApiKey[] {
    return Array.from(this.keys.values());
  }

  public async addKeyHistoryEntry(key: string, entry: { date: number; rate: number; serverCurrentTime?: number }): Promise<void> {
    const apiKey = this.keys.get(key);
    if (apiKey) {
      if (!apiKey.usedHistory) {
        apiKey.usedHistory = [];
      }
      apiKey.usedHistory.push(entry);

      // 移除超過一分鐘的舊記錄
      const oneMinuteAgo = Date.now() - 60 * 1000; // 60 秒 * 1000 毫秒
      apiKey.usedHistory = apiKey.usedHistory.filter(historyEntry => historyEntry.date >= oneMinuteAgo);

      this.eventManager.emitApiKeyStatusUpdate(apiKey); // 歷史更新也視為狀態更新
      await this.saveKeyStatus(apiKey); // 持久化更新後的歷史
    }
  }
}

export default ApiKeyManager;