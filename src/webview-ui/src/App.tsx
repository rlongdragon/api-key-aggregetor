import React, { useEffect, useState } from "react";
import { ApiKey } from "./types/ApiKey";
import { ApiKeyStatus } from "./types/ApiKeyStatus";
import { ProxyServer, ProxyAssignment } from "./types/Proxy";
import { ApiKeysTable } from "./components/ApiKeysTable";
import { ProxyManager } from "./components/ProxyManager";

declare const acquireVsCodeApi: () => {
  postMessage: (message: any) => void;
  getState: () => any;
  setState: (state: any) => void;
};

const vscode = acquireVsCodeApi();

function App() {
  const [apiKeys, setApiKeys] = useState<ApiKeyStatus[]>([]);
  const [keysStatus, setKeysStatus] = useState<{[key: string]: string;}>();
  const [isLoading, setIsLoading] = useState(true);
  const [proxies, setProxies] = useState<ProxyServer[]>([]);
  const [proxyAssignments, setProxyAssignments] = useState<ProxyAssignment[]>([]);
  const [isRotatingProxy, setIsRotatingProxy] = useState(false);

  useEffect(() => {
    console.log("keystatus:", keysStatus);
  }, [keysStatus])

  useEffect(() => {
    vscode.postMessage({
      command: "getApiKeys(request)",
    });
    vscode.postMessage({
      command: "getProxies(request)",
    });
    vscode.postMessage({
      command: "getProxyAssignments(request)",
    });
    vscode.postMessage({
      command: "getRotatingProxyStatus(request)",
    });
  }, []);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data; // 來自擴充功能的訊息

      switch (message.command) {
        case "getApiKeys(response)":
          interface Key {
            keyId: string;
            key: string;
          }
          interface RequestStatus {
            requestId: string; // 唯一請求識別符
            keyId: string; // 使用的 API Key ID
            modelId: string; // 請求的模型 ID
            methodName: string; // 請求的方法名 (e.g., 'generateContent')
            status: "pending" | "success" | "failed" | "cooling_down"; // 請求狀態
            startTime: number; // 請求開始時間戳
            endTime?: number; // 請求結束時間戳 (如果已結束)
            errorMessage?: string; // 錯誤訊息 (如果請求失敗)
            coolDownDuration?: number; // 冷卻持續時間 (如果因速率限制而冷卻)
          }
          const data = message.keys as ApiKeyStatus[];
          const apiKeyStatus = data.map((key) => ({
            ...key, // 展開 ApiKey 的屬性
            // 確保 usedHistory 中的時間戳轉換為 Date 物件
            usedHistory: key.usedHistory ? key.usedHistory.map(history => ({
              ...history,
              date: new Date(history.date),
            })) : [],
          })) as ApiKeyStatus[];
          setApiKeys(apiKeyStatus);

          // 初始化 keysStatus 狀態
          const initialKeysStatus: {[key: string]: string} = {};
          apiKeyStatus.forEach((key) => {
            initialKeysStatus[key.keyId] = "";
          });
          setKeysStatus(initialKeysStatus);

          setIsLoading(false);
          break;
        case "apiKeyStatusUpdate":
          // 更新 API Key 狀態
          let updatedKey = message.apiKey as ApiKeyStatus;

          // 將 usedHistory 中的時間戳轉換為 Date 物件
          updatedKey = {
            ...updatedKey,
            usedHistory: updatedKey.usedHistory.map(history => ({
              ...history,
              date: new Date(history.date),
            })),
          };

          // 測量前後端時間差異
          if (updatedKey.usedHistory.length > 0) {
            const latestHistory = updatedKey.usedHistory[updatedKey.usedHistory.length - 1];
            if (latestHistory.serverCurrentTime !== undefined) { // 檢查屬性是否存在
              const clientCurrentTime = Date.now();
              const timeDifference = clientCurrentTime - latestHistory.serverCurrentTime;
              console.log(`前後端時間差異: ${timeDifference} 毫秒`);
            }
          }

          setApiKeys((prevKeys) =>
            prevKeys.map((key) =>
              key.keyId === updatedKey.keyId ? updatedKey : key
            )
          );
          break;
        case "requestUpdate":
          // 處理請求狀態更新
          const requestStatus = message.requestStatus as {
            requestId: string;
            keyId: string;
            modelId: string;
            methodName: string;
            status: "pending" | "success" | "failed" | "cooling_down";
            startTime: number;
            endTime?: number;
            errorMessage?: string;
            coolDownDuration?: number;
          };

          setKeysStatus((prevStatus) => ({
            ...prevStatus,
            [requestStatus.keyId]: requestStatus.status,
          }));

          console.log("處理請求狀態更新")
          break;
        case "getProxies(response)":
          setProxies(message.proxies || []);
          break;
        case "getProxyAssignments(response)":
          setProxyAssignments(message.assignments || []);
          break;
        case "getRotatingProxyStatus(response)":
          setIsRotatingProxy(message.isRotatingProxy || false);
          break;
        case "proxyAssignmentUpdate":
          setProxyAssignments(message.assignments || []);
          break;
        case "proxyPoolUpdate":
          setProxies(message.proxies || []);
          break;
        default:
          console.warn("Unhandled message from VS Code:", message);
          break;
      }
    };

    window.addEventListener("message", handleMessage);

    // 清理事件監聽器
    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, []);

  // Proxy management handlers
  const handleAddProxy = async (url: string): Promise<void> => {
    vscode.postMessage({
      command: "addProxy",
      url: url,
    });
  };

  const handleUpdateProxy = async (id: string, url: string): Promise<void> => {
    vscode.postMessage({
      command: "updateProxy",
      id: id,
      url: url,
    });
  };

  const handleRemoveProxy = async (id: string): Promise<void> => {
    vscode.postMessage({
      command: "removeProxy",
      id: id,
    });
  };

  const handleRebalanceProxies = async (): Promise<void> => {
    vscode.postMessage({
      command: "rebalanceProxies",
    });
  };

  const handleRotatingProxyChange = (isRotating: boolean) => {
    setIsRotatingProxy(isRotating);
    vscode.postMessage({
      command: "updateRotatingProxy",
      isRotatingProxy: isRotating,
    });
  };

  const handleProxyChange = (keyId: string, proxyId: string | null, isManual: boolean) => {
    vscode.postMessage({
      command: "updateApiKeyProxyAssignment",
      keyId: keyId,
      proxyId: proxyId,
      isManual: isManual,
    });
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'var(--vscode-font-family)' }}>
      <header style={{ marginBottom: '30px', borderBottom: '1px solid var(--vscode-panel-border)', paddingBottom: '15px' }}>
        <h1 style={{ margin: '0 0 10px 0', color: 'var(--vscode-foreground)' }}>
          🔑 Gemini API Key Aggregator
        </h1>
        <p style={{ margin: 0, color: 'var(--vscode-descriptionForeground)', fontSize: '14px' }}>
          Manage your API keys and proxy assignments for optimal performance and rate limit distribution
        </p>
      </header>

      <ProxyManager 
        proxies={proxies}
        proxyAssignments={proxyAssignments}
        onAddProxy={handleAddProxy}
        onUpdateProxy={handleUpdateProxy}
        onRemoveProxy={handleRemoveProxy}
        onRebalanceProxies={handleRebalanceProxies}
        isRotatingProxy={isRotatingProxy}
        onRotatingProxyChange={handleRotatingProxyChange}
      />
      
      <section style={{ marginTop: '30px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '15px' }}>
          <h2 style={{ margin: 0, color: 'var(--vscode-foreground)' }}>API Keys & Proxy Assignments</h2>
          <div style={{ fontSize: '12px', color: 'var(--vscode-descriptionForeground)' }}>
            {apiKeys.length} key{apiKeys.length !== 1 ? 's' : ''} configured
          </div>
        </div>
        
        {isLoading ? (
          <div style={{ 
            textAlign: 'center', 
            padding: '40px', 
            color: 'var(--vscode-descriptionForeground)' 
          }}>
            <div>Loading API keys...</div>
            <div style={{ fontSize: '12px', marginTop: '5px' }}>
              Please wait while we fetch your configuration
            </div>
          </div>
        ) : apiKeys.length === 0 ? (
          <div style={{ 
            textAlign: 'center', 
            padding: '40px',
            border: '1px dashed var(--vscode-panel-border)',
            borderRadius: '4px',
            backgroundColor: 'var(--vscode-editor-inactiveSelectionBackground)'
          }}>
            <div style={{ fontSize: '16px', marginBottom: '10px' }}>🔑 No API Keys Configured</div>
            <div style={{ color: 'var(--vscode-descriptionForeground)', marginBottom: '15px' }}>
              Add your first Gemini API key to get started
            </div>
            <div style={{ fontSize: '12px', color: 'var(--vscode-descriptionForeground)' }}>
              Use Command Palette: <code>Ctrl+Shift+P</code> → <code>Gemini: Add API Key</code>
            </div>
          </div>
        ) : (
          <>
            <ApiKeysTable
              keys={apiKeys}
              status={keysStatus ?? {}}
              proxies={proxies}
              proxyAssignments={proxyAssignments}
              onProxyChange={handleProxyChange}
            />
            
            <div style={{ 
              marginTop: '15px', 
              padding: '10px', 
              backgroundColor: 'var(--vscode-editor-inactiveSelectionBackground)',
              borderRadius: '4px',
              fontSize: '12px',
              color: 'var(--vscode-descriptionForeground)'
            }}>
              <strong>💡 Tips:</strong>
              <ul style={{ margin: '5px 0', paddingLeft: '20px' }}>
                <li>Each API key automatically gets its own dedicated proxy for better performance</li>
                <li>Use the dropdown to manually reassign proxies if needed</li>
                <li>Monitor proxy status and error rates in the Proxy Management section above</li>
                <li>Click "Rebalance Proxy Assignments" to optimize distribution</li>
              </ul>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

export default App;
