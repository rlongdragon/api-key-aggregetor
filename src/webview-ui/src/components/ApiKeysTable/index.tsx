import React from "react";
import { ApiKeyStatus } from "src/types/ApiKeyStatus";
import { ProxyServer, ProxyAssignment } from "src/types/Proxy";
import TimestampDisplay from "../TimestampDisplay";
import RateInfo from "../RateInfo";

import style from "./style.module.css";

// create component via class
class KeyComponent extends React.Component<{
  keyData: ApiKeyStatus;
  status: string;
  proxies: ProxyServer[];
  proxyAssignments: ProxyAssignment[];
  onProxyChange: (keyId: string, proxyId: string | null, isManual: boolean) => void;
}> {
  render() {
    const { keyData, status, proxies, proxyAssignments, onProxyChange } = this.props;
    
    // Find the current assignment for this key
    const currentAssignment = proxyAssignments.find(a => a.keyId === keyData.keyId);
    const currentProxyId = currentAssignment?.proxyId;
    
    // Find the proxy URL for display
    let proxyUrl = "";
    if (currentProxyId) {
      const proxy = proxies.find(p => p.id === currentProxyId);
      if (proxy) {
        proxyUrl = proxy.url;
      }
    } else if (keyData.proxy) {
      // Legacy proxy field
      proxyUrl = keyData.proxy;
    }
    
    // Get active proxies for the dropdown
    const activeProxies = proxies.filter(p => p.status === 'active');
    
    return (
      <tr className={status == "pending" ? style.scanner : ""}>
        <td>{keyData.keyId}</td>
        <td>
          <code>{"*".repeat(Math.max(0, keyData.key.length - 4)) + keyData.key.slice(-4)}</code>
        </td>
        <td>
          <select
            value={currentProxyId || ""}
            onChange={(e) => onProxyChange(keyData.keyId, e.target.value || null, true)}
            className={currentAssignment?.isManual ? style.manualAssignment : ""}
            title={
              currentAssignment?.isManual 
                ? "Manual assignment - You manually selected this proxy" 
                : "Automatic assignment - System assigned this proxy for load balancing"
            }
          >
            <option value="" title="Direct connection without proxy">
              No proxy
            </option>
            {activeProxies.map((proxy) => (
              <option 
                key={proxy.id} 
                value={proxy.id}
                title={`${proxy.url} - Currently assigned to ${proxy.assignedKeyCount} API key${proxy.assignedKeyCount !== 1 ? 's' : ''}`}
              >
                {proxy.url} ({proxy.assignedKeyCount} keys)
              </option>
            ))}
          </select>
          {currentAssignment && (
            <div className={style.assignmentInfo}>
              <span title={currentAssignment.isManual ? "You manually assigned this proxy" : "System automatically assigned this proxy"}>
                {currentAssignment.isManual ? "🔧 Manual" : "⚡ Auto"} assignment
              </span>
              {currentAssignment.assignedAt && (
                <span title="When this proxy was assigned to this API key">
                  {" - Assigned: "}
                  <TimestampDisplay date={new Date(currentAssignment.assignedAt)} />
                </span>
              )}
            </div>
          )}
          {!currentAssignment && (
            <div className={style.assignmentInfo} title="This API key will use direct connection to Google's API">
              Direct connection (no proxy)
            </div>
          )}
        </td>
        <td>
          {keyData.usedHistory.length > 0 ? (
            <TimestampDisplay date={new Date(keyData.usedHistory[keyData.usedHistory.length - 1].date)} />
          ) : (
            "Never used"
          )}
        </td>
        <td>{keyData.status}</td>
        <td>
          <RateInfo keyData={keyData} />
        </td>
      </tr>
    );
  }
}

export class ApiKeysTable extends React.Component<{
  keys: ApiKeyStatus[];
  status: { [key: string]: string };
  proxies: ProxyServer[];
  proxyAssignments: ProxyAssignment[];
  onProxyChange: (keyId: string, proxyId: string | null, isManual: boolean) => void;
}> {
  render() {
    const { keys, status, proxies, proxyAssignments, onProxyChange } = this.props;

    return (
      <div>
        <div className={style.tableHeader}>
          <h3>API Keys & Proxy Assignments</h3>
          <div className={style.tableHelpText}>
            Each API key can be assigned to a specific proxy server. Use the dropdown to manually assign proxies or let the system auto-assign for optimal load balancing.
          </div>
        </div>
        
        {keys.length > 0 ? (
          <>
            <table className={style.apiKeysTable}>
              <thead>
                <tr>
                  <th title="Unique identifier for this API key">Key ID</th>
                  <th title="Your Google Gemini API key (last 4 characters shown for security)">API Key</th>
                  <th title="Assigned proxy server for this API key - click dropdown to change assignment">Proxy Assignment</th>
                  <th title="When this API key was last used for a request">Last Called</th>
                  <th title="Current status: available (ready to use), cooling_down (rate limited), or disabled">Status</th>
                  <th title="Current rate limit usage and remaining quota from Google">Rate Limits</th>
                </tr>
              </thead>
              <tbody>
                {keys.map((apiKey, i) => (
                  <KeyComponent
                    key={i}
                    keyData={apiKey}
                    status={status[apiKey.keyId]}
                    proxies={proxies}
                    proxyAssignments={proxyAssignments}
                    onProxyChange={onProxyChange}
                  />
                ))}
              </tbody>
            </table>
            
            <div className={style.tableFooter}>
              <div className={style.assignmentLegend}>
                <h5>Assignment Types:</h5>
                <div className={style.legendItems}>
                  <span className={style.legendItem}>
                    <span className={style.manualIcon}>🔧</span> Manual - You selected this proxy
                  </span>
                  <span className={style.legendItem}>
                    <span className={style.autoIcon}>⚡</span> Auto - System assigned for load balancing
                  </span>
                  <span className={style.legendItem}>
                    <span className={style.directIcon}>🔗</span> Direct - No proxy (direct connection)
                  </span>
                </div>
              </div>
              
              <div className={style.statusLegend}>
                <h5>Status Indicators:</h5>
                <div className={style.legendItems}>
                  <span className={style.legendItem}>
                    <span className={style.statusAvailable}>●</span> Available - Ready for requests
                  </span>
                  <span className={style.legendItem}>
                    <span className={style.statusCooling}>●</span> Cooling Down - Rate limited, waiting
                  </span>
                  <span className={style.legendItem}>
                    <span className={style.statusDisabled}>●</span> Disabled - Not in use
                  </span>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className={style.emptyState}>
            <h4>No API Keys Configured</h4>
            <p>Add your first Google Gemini API key to get started:</p>
            <ol>
              <li>Open Command Palette (Ctrl+Shift+P / Cmd+Shift+P)</li>
              <li>Type "Gemini: Add API Key"</li>
              <li>Paste your API key (starts with "AIzaSy...")</li>
              <li>The system will automatically assign a proxy if available</li>
            </ol>
            <div className={style.helpNote}>
              <strong>Need an API key?</strong> Get one from the <a href="https://makersuite.google.com/app/apikey" target="_blank" rel="noopener noreferrer">Google AI Studio</a>
            </div>
          </div>
        )}
      </div>
    );
  }
}
