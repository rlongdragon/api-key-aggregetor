import React, { useState } from "react";
import { ProxyServer, ProxyAssignment } from "src/types/Proxy";
import TimestampDisplay from "../TimestampDisplay";
import style from "./style.module.css";

interface ProxyManagerProps {
  proxies: ProxyServer[];
  proxyAssignments: ProxyAssignment[];
  onAddProxy: (url: string) => Promise<void>;
  onUpdateProxy: (id: string, url: string) => Promise<void>;
  onRemoveProxy: (id: string) => Promise<void>;
  onRebalanceProxies: () => Promise<void>;
  isRotatingProxy: boolean;
  onRotatingProxyChange: (isRotating: boolean) => void;
}

export const ProxyManager: React.FC<ProxyManagerProps> = ({
  proxies,
  proxyAssignments,
  onAddProxy,
  onUpdateProxy,
  onRemoveProxy,
  onRebalanceProxies,
  isRotatingProxy,
  onRotatingProxyChange
}) => {
  const [newProxy, setNewProxy] = useState("");
  const [editingProxyId, setEditingProxyId] = useState<string | null>(null);
  const [editingProxyUrl, setEditingProxyUrl] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isValidProxyUrl = (url: string): boolean => {
    try {
      const parsed = new URL(url);
      return ['http:', 'https:', 'socks:', 'socks5:'].includes(parsed.protocol);
    } catch {
      return false;
    }
  };

  const handleAddProxy = async () => {
    setIsAdding(true);
    setError(null);
    
    try {
      const trimmedProxy = newProxy.trim();
      if (!trimmedProxy) {
        setError("Proxy URL cannot be empty");
        return;
      }
      
      if (!isValidProxyUrl(trimmedProxy)) {
        setError("Invalid proxy URL format. Expected format: http://host:port or https://host:port");
        return;
      }
      
      if (proxies.some(p => p.url === trimmedProxy)) {
        setError("This proxy URL already exists");
        return;
      }
      
      await onAddProxy(trimmedProxy);
      setNewProxy("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add proxy");
    } finally {
      setIsAdding(false);
    }
  };

  const handleUpdateProxy = async (id: string) => {
    setError(null);
    
    try {
      if (!editingProxyUrl) {
        setError("Proxy URL cannot be empty");
        return;
      }
      
      if (!isValidProxyUrl(editingProxyUrl)) {
        setError("Invalid proxy URL format. Expected format: http://host:port or https://host:port");
        return;
      }
      
      if (proxies.some(p => p.url === editingProxyUrl && p.id !== id)) {
        setError("This proxy URL already exists");
        return;
      }
      
      await onUpdateProxy(id, editingProxyUrl);
      setEditingProxyId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update proxy");
    }
  };

  const handleRemoveProxy = async (id: string) => {
    setError(null);
    
    try {
      const proxy = proxies.find(p => p.id === id);
      if (proxy && proxy.assignedKeyCount > 0) {
        if (!window.confirm(`This proxy has ${proxy.assignedKeyCount} assigned API keys. Are you sure you want to remove it?`)) {
          return;
        }
      }
      
      await onRemoveProxy(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove proxy");
    }
  };

  const handleRebalanceProxies = async () => {
    setError(null);
    
    try {
      await onRebalanceProxies();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to rebalance proxies");
    }
  };

  const startEditing = (proxy: ProxyServer) => {
    setEditingProxyId(proxy.id);
    setEditingProxyUrl(proxy.url);
  };

  const cancelEditing = () => {
    setEditingProxyId(null);
    setEditingProxyUrl("");
  };

  const getStatusClass = (status: string) => {
    switch (status) {
      case 'active': return style.statusActive;
      case 'error': return style.statusError;
      case 'inactive': return style.statusInactive;
      default: return '';
    }
  };

  return (
    <div className={style.proxyManager}>
      <h3>Proxy Management</h3>
      
      <div className={style.proxyControls}>
        <div className={style.proxyControlsRow}>
          <div className={style.rotatingProxyToggle}>
            <label>
              <input
                type="checkbox"
                checked={isRotatingProxy}
                onChange={(e) => onRotatingProxyChange(e.target.checked)}
              />
              Enable rotating proxy mode
            </label>
            <div className={style.helpText}>
              <strong>Dedicated Mode (Recommended):</strong> Each API key gets its own assigned proxy for better performance and rate limit isolation.<br/>
              <strong>Rotating Mode (Legacy):</strong> All API keys share proxies in rotation - simpler but less optimal.
            </div>
          </div>
          
          <button 
            onClick={handleRebalanceProxies} 
            disabled={isRotatingProxy || proxies.filter(p => p.status === 'active').length <= 1}
            className={style.rebalanceButton}
            title="Redistribute API keys evenly across available proxies for optimal load balancing"
          >
            Rebalance Proxy Assignments
          </button>
        </div>
        
        <div className={style.quickTips}>
          <h5>💡 Quick Tips</h5>
          <ul>
            <li><strong>Start Simple:</strong> Add 2-3 proxies and let the system auto-assign</li>
            <li><strong>Monitor Status:</strong> Green = working, Red = issues, Gray = disabled</li>
            <li><strong>Geographic Spread:</strong> Use proxies from different regions for better performance</li>
            <li><strong>Test First:</strong> Verify proxy works before adding multiple API keys</li>
          </ul>
        </div>
      </div>
      
      <div className={style.proxyInput}>
        <input
          type="text"
          value={newProxy}
          onChange={(e) => setNewProxy(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleAddProxy()}
          placeholder="Add new proxy (e.g., http://host:port)"
          disabled={isAdding}
        />
        <button onClick={handleAddProxy} disabled={isAdding}>
          {isAdding ? "Adding..." : "Add"}
        </button>
      </div>
      
      {error && <div className={style.error}>{error}</div>}
      
      <div className={style.proxyTableContainer}>
        <table className={style.proxyTable}>
          <thead>
            <tr>
              <th>URL</th>
              <th>Status</th>
              <th>Assigned Keys</th>
              <th>Last Updated</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {proxies.map((proxy) => (
              <tr key={proxy.id}>
                <td>
                  {editingProxyId === proxy.id ? (
                    <input
                      type="text"
                      value={editingProxyUrl}
                      onChange={(e) => setEditingProxyUrl(e.target.value)}
                      autoFocus
                    />
                  ) : (
                    <span className={style.proxyUrl}>{proxy.url}</span>
                  )}
                </td>
                <td>
                  <span className={getStatusClass(proxy.status)}>
                    {proxy.status}
                    {proxy.lastError && (
                      <span className={style.errorTooltip} title={proxy.lastError}>
                        ⓘ
                      </span>
                    )}
                  </span>
                </td>
                <td>{proxy.assignedKeyCount}</td>
                <td>
                  {proxy.updatedAt ? (
                    <TimestampDisplay date={new Date(proxy.updatedAt)} />
                  ) : (
                    "N/A"
                  )}
                </td>
                <td>
                  {editingProxyId === proxy.id ? (
                    <div className={style.actionButtons}>
                      <button onClick={() => handleUpdateProxy(proxy.id)}>Save</button>
                      <button onClick={cancelEditing}>Cancel</button>
                    </div>
                  ) : (
                    <div className={style.actionButtons}>
                      <button onClick={() => startEditing(proxy)}>Edit</button>
                      <button 
                        onClick={() => handleRemoveProxy(proxy.id)}
                        disabled={proxy.assignedKeyCount > 0 && isRotatingProxy}
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {proxies.length === 0 && (
              <tr>
                <td colSpan={5} className={style.emptyState}>
                  No proxies configured. Add a proxy to get started.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      
      <div className={style.helpSection}>
        <h4>Proxy Configuration Help</h4>
        <div className={style.helpGrid}>
          <div className={style.helpColumn}>
            <h5>📋 Supported Formats</h5>
            <ul>
              <li><code>http://host:port</code> - Standard HTTP proxy</li>
              <li><code>https://host:port</code> - Secure HTTPS proxy</li>
              <li><code>socks://host:port</code> - SOCKS4 proxy</li>
              <li><code>socks5://host:port</code> - SOCKS5 proxy</li>
            </ul>
            
            <h5>🔐 With Authentication</h5>
            <ul>
              <li><code>http://user:pass@host:port</code></li>
              <li><code>https://user:pass@host:port</code></li>
            </ul>
          </div>
          
          <div className={style.helpColumn}>
            <h5>⚡ How It Works</h5>
            <ul>
              <li>Each API key gets its own dedicated proxy</li>
              <li>Requests are automatically routed through assigned proxies</li>
              <li>Failed proxies are detected and disabled automatically</li>
              <li>Load balancing distributes keys evenly across proxies</li>
            </ul>
            
            <h5>🛠️ Management Tips</h5>
            <ul>
              <li>Use "Rebalance" to optimize proxy distribution</li>
              <li>Monitor proxy status and error rates</li>
              <li>Remove or replace proxies with high error rates</li>
              <li>Test proxies before adding them to production</li>
            </ul>
          </div>
        </div>
        
        <div className={style.helpExamples}>
          <h5>💡 Popular Proxy Services</h5>
          <div className={style.exampleGrid}>
            <div className={style.example}>
              <strong>Bright Data:</strong><br/>
              <code>http://user:pass@zproxy.lum-superproxy.io:22225</code>
            </div>
            <div className={style.example}>
              <strong>Oxylabs:</strong><br/>
              <code>http://user:pass@pr.oxylabs.io:7777</code>
            </div>
            <div className={style.example}>
              <strong>Smartproxy:</strong><br/>
              <code>http://user:pass@gate.smartproxy.com:7000</code>
            </div>
          </div>
        </div>
        
        <div className={style.troubleshooting}>
          <h5>🔧 Troubleshooting</h5>
          <details>
            <summary>Common Issues & Solutions</summary>
            <div className={style.troubleshootingContent}>
              <p><strong>Connection Refused:</strong> Check if proxy server is running and accessible</p>
              <p><strong>Authentication Failed:</strong> Verify username and password in proxy URL</p>
              <p><strong>Slow Response:</strong> Try different proxy or check network connection</p>
              <p><strong>High Error Rate:</strong> Consider replacing the proxy with a more reliable one</p>
            </div>
          </details>
        </div>
      </div>
    </div>
  );
};
