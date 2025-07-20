// src/server/core/EventManager.ts
import { EventEmitter } from "events";
import { ApiKey } from "../types/ApiKey"; // 引入 ApiKey 介面
import { ProxyServer, ProxyAssignment } from "../types/Proxy"; // 引入 Proxy 相關介面

// 定義請求狀態類型
export interface RequestStatus {
  requestId: string; // 唯一請求識別符
  keyId: string; // 使用的 API Key ID
  modelId: string; // 請求的模型 ID
  methodName: string; // 請求的方法名 (e.g., 'generateContent')
  status: "pending" | "success" | "failed" | "cooling_down"; // 請求狀態
  startTime: number; // 請求開始時間戳
  endTime?: number; // 請求結束時間戳 (如果已結束)
  errorMessage?: string; // 錯誤訊息 (如果請求失敗)
  coolDownDuration?: number; // 冷卻持續時間 (如果因速率限制而冷卻)
  proxyId?: string; // 使用的代理伺服器 ID
}

export class EventManager extends EventEmitter { // 導出 EventManager 類別
  /**
   * 當 API Key 狀態改變時發送事件。
   * @param apiKey 更新後的 ApiKey 物件。
   */
  emitApiKeyStatusUpdate(apiKey: ApiKey) {
    this.emit("apiKeyStatusUpdate", apiKey);
  }

  /**
   * 當請求狀態改變時發送事件 (例如：開始、成功、失敗、冷卻)。
   * @param requestStatus 更新後的 RequestStatus 物件。
   */
  emitRequestUpdate(requestStatus: RequestStatus) {
    console.log("Emitting request update:", requestStatus);
    this.emit("requestUpdate", requestStatus);
  }

  /**
   * 當代理伺服器被新增時發送事件。
   * @param proxy 新增的代理伺服器。
   */
  emitProxyAdded(proxy: ProxyServer) {
    this.emit("proxyAdded", proxy);
  }

  /**
   * 當代理伺服器被移除時發送事件。
   * @param proxyId 被移除的代理伺服器 ID。
   */
  emitProxyRemoved(proxyId: string) {
    this.emit("proxyRemoved", proxyId);
  }

  /**
   * 當代理伺服器被更新時發送事件。
   * @param proxy 更新後的代理伺服器。
   */
  emitProxyUpdated(proxy: ProxyServer) {
    this.emit("proxyUpdated", proxy);
  }

  /**
   * 當代理伺服器狀態改變時發送事件。
   * @param proxy 狀態改變的代理伺服器。
   */
  emitProxyStatusChanged(proxy: ProxyServer) {
    this.emit("proxyStatusChanged", proxy);
  }

  /**
   * 當 API Key 被指派代理伺服器時發送事件。
   * @param assignment 代理伺服器指派資訊。
   */
  emitProxyAssigned(assignment: ProxyAssignment) {
    this.emit("proxyAssigned", assignment);
  }

  /**
   * 當 API Key 的代理伺服器指派被移除時發送事件。
   * @param keyId API Key ID。
   */
  emitProxyUnassigned(keyId: string) {
    this.emit("proxyUnassigned", keyId);
  }
}

export const eventManager = new EventManager();