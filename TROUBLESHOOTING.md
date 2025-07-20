# Troubleshooting Guide

This guide helps you resolve common issues with the Gemini API Key Aggregator Proxy Plus extension.

## 🚨 Common Issues

### 1. Extension Not Starting

#### Symptoms
- No proxy server message on startup
- Commands not available in Command Palette
- Extension appears inactive

#### Solutions
```bash
# Check VS Code Developer Console
Help > Toggle Developer Tools > Console

# Look for error messages starting with:
# "Failed to start API Key Aggregator Proxy Server"
```

**Common Causes:**
- **Port 3146 already in use**: Another instance is running
- **Permission issues**: VS Code lacks network permissions
- **Extension conflicts**: Other proxy extensions interfering

**Fixes:**
```bash
# Kill existing processes on port 3146
lsof -ti:3146 | xargs kill -9

# Or change port in settings
"geminiAggregator-dev.port": 3147
```

### 2. No API Keys Available

#### Symptoms
- "Service Unavailable: No available API keys" error
- Empty API keys table in management panel

#### Solutions
```bash
# Add API keys via Command Palette
Ctrl+Shift+P > Gemini: Add API Key

# Or check existing keys
Ctrl+Shift+P > Gemini: List API Keys
```

**Validation Checklist:**
- ✅ API key format: `AIzaSy...` (39 characters)
- ✅ Key has remaining quota
- ✅ Key is not disabled in Google Cloud Console
- ✅ Billing is enabled for the project

### 3. Proxy Connection Failures

#### Symptoms
- "Proxy error detected" in logs
- Requests failing through specific proxies
- High error rates in performance monitor
- API keys showing "No Proxy" status unexpectedly
- Slow response times or timeouts

#### Diagnosis Steps
```bash
# 1. Test proxy manually
curl -x http://proxy:port https://httpbin.org/ip

# 2. Check proxy status in management panel
Ctrl+Shift+P > Gemini: Open Aggregator Panel

# 3. Test with different protocols
curl -x http://proxy:port https://google.com
curl -x https://proxy:port https://google.com

# 4. Check authentication
curl -x http://user:pass@proxy:port https://httpbin.org/ip
```

**Common Proxy Issues:**

| Error | Cause | Solution | Prevention |
|-------|-------|----------|-----------|
| `ECONNREFUSED` | Proxy server down | Check proxy status with provider | Monitor proxy health regularly |
| `ETIMEDOUT` | Network timeout | Increase timeout or try different proxy | Use proxies with better latency |
| `407 Proxy Authentication Required` | Missing credentials | Add username:password to proxy URL | Verify credentials with provider |
| `SSL certificate error` | HTTPS proxy issue | Use HTTP proxy or fix certificate | Use trusted proxy providers |
| `ENOTFOUND` | DNS resolution failed | Check proxy hostname | Use IP addresses instead of hostnames |
| `ECONNRESET` | Connection reset by proxy | Proxy overloaded or blocked | Switch to different proxy |

#### Proxy URL Formats & Validation

**✅ Correct Formats:**
```bash
# HTTP proxies
http://proxy.example.com:8080
http://192.168.1.100:3128

# HTTPS proxies (secure)
https://secure-proxy.example.com:8443
https://10.0.0.50:8080

# SOCKS proxies
socks://socks-proxy.example.com:1080
socks5://socks5-proxy.example.com:1080

# With authentication
http://username:password@proxy.example.com:8080
https://user123:pass456@secure-proxy.example.com:8443
socks5://myuser:mypass@socks-proxy.example.com:1080

# Special characters in credentials (URL encoded)
http://user%40domain.com:p%40ssw0rd@proxy.example.com:8080
```

**❌ Incorrect Formats (Will Fail):**
```bash
proxy.example.com:8080          # Missing protocol
http://proxy.example.com        # Missing port
ftp://proxy.example.com:21      # Unsupported protocol
http://proxy:8080/path          # Path not allowed
ws://proxy.example.com:8080     # WebSocket not supported
```

#### Advanced Proxy Troubleshooting

**Test Proxy Connectivity:**
```bash
# Test basic connectivity
telnet proxy.example.com 8080

# Test HTTP CONNECT method
curl -v -x http://proxy:port https://httpbin.org/ip

# Test with specific user agent
curl -x http://proxy:port -H "User-Agent: GeminiAggregator/1.0" https://httpbin.org/ip

# Test proxy response time
time curl -x http://proxy:port https://httpbin.org/ip
```

**Proxy Performance Analysis:**
```bash
# Check proxy response time (should be <2s)
curl -w "@curl-format.txt" -x http://proxy:port https://httpbin.org/ip

# Create curl-format.txt:
echo "time_namelookup: %{time_namelookup}\ntime_connect: %{time_connect}\ntime_appconnect: %{time_appconnect}\ntime_pretransfer: %{time_pretransfer}\ntime_redirect: %{time_redirect}\ntime_starttransfer: %{time_starttransfer}\ntime_total: %{time_total}" > curl-format.txt
```

#### Proxy Assignment Issues

**Symptoms:**
- API keys not getting proxy assignments
- Manual assignments not persisting
- Uneven proxy distribution
- Assignment indicators not showing correctly

**Diagnosis Steps:**
```bash
# 1. Check proxy pool status
# In management panel, verify all proxies show "🟢 active" status

# 2. Verify assignment mode
# Check if "Enable rotating proxy mode" is configured as intended
# Dedicated mode (unchecked) = each key gets own proxy
# Rotating mode (checked) = keys share proxies

# 3. Check assignment indicators
# 🔧 Manual = You manually selected this proxy
# ⚡ Auto = System assigned for load balancing
# 🔗 Direct = No proxy (direct connection)

# 4. Monitor assignment persistence
# Restart VS Code and verify assignments are restored
# Check VS Code Developer Console for migration messages
```

**Solutions:**
```bash
# Force rebalance assignments
# Click "Rebalance Proxy Assignments" button in management panel

# Clear and reassign problematic proxy
# 1. Note which API keys are assigned to the proxy
# 2. Remove the problematic proxy
# 3. Re-add the proxy with correct URL
# 4. Verify automatic reassignment

# Manual assignment override
# 1. Click dropdown in "Proxy Assignment" column
# 2. Select desired proxy from list
# 3. Verify assignment shows as "🔧 Manual"

# Reset all assignments (if needed)
# 1. Remove all proxies
# 2. Re-add proxies one by one
# 3. System will automatically rebalance
```

**Assignment Logic Troubleshooting:**
```bash
# Check assignment distribution
# Each proxy should have roughly equal number of assigned keys
# If uneven, use "Rebalance Proxy Assignments"

# Verify load balancing strategy
# System assigns new keys to proxy with fewest assignments
# Manual assignments override automatic balancing

# Check for assignment conflicts
# Multiple keys can share same proxy if needed
# No conflicts should occur with proper configuration
```

#### Provider-Specific Issues

**Bright Data:**
```bash
# Common issues:
# - Session management required
# - Specific endpoint formats
# - IP whitelisting needed

# Correct format:
http://session-user123:password@zproxy.lum-superproxy.io:22225

# Test command:
curl -x http://session-user123:password@zproxy.lum-superproxy.io:22225 https://httpbin.org/ip
```

**Oxylabs:**
```bash
# Sticky session format:
http://customer-user-session-rand123:password@pr.oxylabs.io:7777

# Rotating format:
http://customer-user:password@pr.oxylabs.io:7777
```

**Smartproxy:**
```bash
# Endpoint format:
http://user:password@gate.smartproxy.com:7000

# Sticky session:
http://user-session-rand123:password@gate.smartproxy.com:7000
```

### 4. Rate Limiting Issues

#### Symptoms
- "Rate limit exceeded" errors
- API keys stuck in cooling down state
- Slow response times

#### Solutions
```bash
# Check API key status
Ctrl+Shift+P > Gemini: Open Aggregator Panel

# Monitor rate limits in real-time
# Look for "Rate Limits" column in API Keys table
```

**Rate Limit Strategies:**
1. **Add More API Keys**: Distribute load across multiple keys
2. **Use Different Proxies**: Avoid IP-based rate limiting
3. **Implement Delays**: Add delays between requests in your application
4. **Monitor Usage**: Track usage patterns in management panel

#### Rate Limit Debugging
```javascript
// Check current rate limit status
// In management panel, look for:
{
  "usedHistory": [
    {"date": 1234567890, "rate": 15, "serverCurrentTime": 1234567890}
  ],
  "coolingDownUntil": 1234567890  // If cooling down
}
```

### 5. Performance Issues

#### Symptoms
- Slow response times (>5 seconds)
- High memory usage
- Extension becoming unresponsive

#### Performance Monitoring
```bash
# Open performance dashboard
Ctrl+Shift+P > Gemini: Open Aggregator Panel

# Check metrics:
# - Average response time per proxy
# - Error rates
# - Load balancing effectiveness
# - Memory usage
```

**Optimization Steps:**
1. **Remove Slow Proxies**: Error rate >20% or response time >5s
2. **Rebalance Load**: Use "Rebalance Proxy Assignments" button
3. **Clear Old Metrics**: Restart extension to clear memory
4. **Reduce Proxy Count**: Too many proxies can cause overhead

### 6. Migration Issues

#### Symptoms
- Settings lost after update
- Proxies not working after upgrade
- API keys missing assignments

#### Migration Troubleshooting
```bash
# Check migration status in console
# Look for messages starting with:
# "MigrationManager: Starting migration from legacy proxy system"

# Force migration reset (if needed)
# Delete these from VS Code settings:
# - proxyMigrationVersion
# - geminiProxies (legacy)
# - geminiRotatingProxy (legacy)
```

**Manual Migration Steps:**
1. **Backup Settings**: Export current configuration
2. **Note Current Proxies**: List all working proxy URLs
3. **Restart Extension**: Reload VS Code window
4. **Re-add Proxies**: Add proxies through new management panel
5. **Verify Assignments**: Check that API keys have proxy assignments

## 🔧 Advanced Troubleshooting

### Debug Mode

Enable detailed logging:
```bash
# Method 1: Environment variable
DEBUG=gemini-aggregator:* code

# Method 2: VS Code settings
"geminiAggregator-dev.debug": true
```

### Log Analysis

Key log patterns to look for:
```bash
# Successful proxy assignment
"ProxyAssignmentManager: Assigned proxy proxy_123 to key key1"

# Proxy health check failure
"ProxyPoolManager: Proxy proxy_123 marked as error after 3 consecutive failures"

# Request routing
"GoogleApiForwarder: Using proxy http://proxy.com:8080 for key key1"

# Migration completion
"MigrationManager: Migration completed successfully"
```

### Network Diagnostics

Test network connectivity:
```bash
# Test direct connection to Google API
curl -H "Content-Type: application/json" \
     -H "x-goog-api-key: YOUR_API_KEY" \
     -d '{"contents":[{"parts":[{"text":"Hello"}]}]}' \
     https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent

# Test proxy connection
curl -x http://proxy:port https://httpbin.org/ip

# Test local proxy server
curl http://localhost:3146/health
```

### Memory Usage Analysis

Monitor extension memory usage:
```bash
# In VS Code Developer Tools Console
console.log(process.memoryUsage());

# Look for increasing values over time:
# - heapUsed: JavaScript objects
# - external: C++ objects (proxy connections)
```

## 🛠️ Configuration Validation

### Proxy Configuration Checklist

- [ ] **URL Format**: Includes protocol (http/https/socks/socks5)
- [ ] **Port Specified**: URL includes port number
- [ ] **Authentication**: Username/password if required
- [ ] **Network Access**: Proxy accessible from your network
- [ ] **Provider Status**: Proxy service is active
- [ ] **Geographic Location**: Proxy location matches your needs

### API Key Validation

```bash
# Test API key manually
curl -H "x-goog-api-key: YOUR_API_KEY" \
     "https://generativelanguage.googleapis.com/v1beta/models"

# Should return list of available models
# If error, check:
# - API key format (39 characters starting with AIzaSy)
# - Billing enabled in Google Cloud Console
# - API enabled (Generative Language API)
# - Quota remaining
```

### Extension Configuration

```json
// VS Code settings.json
{
  "geminiAggregator-dev.port": 3146,
  "geminiAggregator-dev.debug": false,
  "geminiAggregator-dev.healthCheckInterval": 60000,
  "geminiAggregator-dev.maxErrorsBeforeDisable": 3
}
```

## 🆘 Getting Help

### Before Reporting Issues

1. **Check Console Logs**: VS Code Developer Tools > Console
2. **Test Components**: API keys, proxies, network connectivity
3. **Try Safe Mode**: Disable other extensions temporarily
4. **Update Extension**: Ensure you have the latest version

### Information to Include

When reporting issues, include:
```bash
# Extension version
# VS Code version
# Operating system
# Error messages from console
# Steps to reproduce
# Configuration (without sensitive data)

# Example:
Extension: Gemini API Key Aggregator v1.0.0
VS Code: 1.85.0
OS: Windows 11
Error: "Proxy connection failed: ECONNREFUSED"
Steps: Added proxy http://proxy.com:8080, assigned to API key
Config: 3 API keys, 2 proxies, auto-assignment enabled
```

### Support Channels

- **GitHub Issues**: Bug reports and feature requests
- **GitHub Discussions**: Questions and community help
- **Documentation**: README and Wiki for detailed guides

### Emergency Recovery

If extension is completely broken:
```bash
# 1. Disable extension
Extensions > Gemini API Key Aggregator > Disable

# 2. Clear all settings
Command Palette > Preferences: Open Settings (JSON)
# Remove all "geminiAggregator-dev.*" entries

# 3. Clear stored data
# This will remove API keys and proxy settings!
Command Palette > Developer: Reload Window

# 4. Re-enable and reconfigure
Extensions > Gemini API Key Aggregator > Enable
```

---

**Still having issues?** Open a [GitHub Issue](https://github.com/your-repo/issues) with detailed information.