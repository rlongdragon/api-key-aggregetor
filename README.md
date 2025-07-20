# Gemini API Key Aggregator Proxy Plus

A VS Code extension that aggregates multiple Google Gemini API keys with dedicated proxy support to bypass rate limits and improve concurrency for AI-powered extensions like Cline, Roo Code, and Continue.

## 🚀 Key Features

### 🔑 **Multi-API Key Management**
- Add, modify, and delete multiple Gemini API keys
- Automatic round-robin distribution of requests
- Real-time status monitoring and rate limit tracking
- Persistent storage with VS Code SecretStorage

### 🌐 **Advanced Proxy System**
- **Dedicated proxy per API key** - Each key gets its own assigned proxy
- **Automatic load balancing** - Even distribution across available proxies
- **Health monitoring** - Automatic detection and handling of failed proxies
- **Manual control** - Assign specific proxies to individual keys
- **Multiple proxy types** - HTTP, HTTPS, SOCKS4, and SOCKS5 support

### 📊 **Real-time Management**
- Live proxy status and assignment updates
- Performance monitoring and optimization recommendations
- Error recovery with graceful fallbacks
- Interactive management panel

## 📦 Installation

1. Install from VS Code Marketplace (coming soon)
2. Or install from VSIX file:
   ```bash
   code --install-extension gemini-aggregator-proxy-plus.vsix
   ```

## ⚙️ Quick Setup

### 1. Add API Keys
```bash
# Open Command Palette (Ctrl+Shift+P / Cmd+Shift+P)
> Gemini: Add API Key
```

### 2. Configure Proxies
```bash
# Open the management panel
> Gemini: Open Aggregator Panel
```

### 3. Start Using
The extension automatically starts a proxy server on port 3146. Configure your AI extensions to use:
```
http://localhost:3146
```

## 🌐 Proxy Configuration

### Supported Proxy Types

| Type | Format | Example |
|------|--------|---------|
| HTTP | `http://host:port` | `http://proxy.example.com:8080` |
| HTTPS | `https://host:port` | `https://proxy.example.com:8443` |
| SOCKS4 | `socks://host:port` | `socks://proxy.example.com:1080` |
| SOCKS5 | `socks5://host:port` | `socks5://proxy.example.com:1080` |

### Proxy Assignment Modes

#### 🎯 **Dedicated Assignment (Default)**
Each API key gets its own assigned proxy for all requests:
- **Better Performance**: Dedicated connection per key
- **Rate Limit Isolation**: Each key uses different IP addresses
- **Geographic Distribution**: Spread requests across regions
- **Easier Debugging**: Clear proxy-to-key mapping
- **Automatic Load Balancing**: Even distribution across proxies

#### 🔄 **Rotating Mode (Legacy)**
All API keys share proxies in rotation:
- **Simple Setup**: One proxy pool for all keys
- **Good for Testing**: Quick setup for development
- **Less Optimal**: Potential bottlenecks and rate limit conflicts

### Step-by-Step Configuration

#### 1. Open Management Panel
```bash
# Via Command Palette
Ctrl+Shift+P (Windows/Linux) or Cmd+Shift+P (Mac)
> Gemini: Open Aggregator Panel
```

#### 2. Add Proxy Servers
In the Proxy Management section:
1. Enter proxy URL in the input field (e.g., `http://proxy.example.com:8080`)
2. Click "Add" button
3. Verify proxy status shows as "🟢 active"
4. Repeat for additional proxies

**💡 Quick Tips:**
- Start with 2-3 proxies for basic load distribution
- Test each proxy before adding multiple API keys
- Use proxies from different geographic regions for better performance
- Monitor the status indicators: 🟢 Active, 🔴 Error, ⚪ Inactive

#### 3. Configure Assignment Mode
- **🎯 Dedicated Mode (Recommended)**: Leave "Enable rotating proxy mode" unchecked
  - Each API key gets its own assigned proxy
  - Better performance and rate limit isolation
  - Automatic load balancing across proxies
- **🔄 Rotating Mode (Legacy)**: Check "Enable rotating proxy mode"
  - All API keys share proxies in rotation
  - Simpler setup but less optimal performance

#### 4. Verify Assignments
- Check API Keys table to see proxy assignments
- Look for assignment indicators: 🔧 Manual, ⚡ Auto, 🔗 Direct
- Use "Rebalance Proxy Assignments" to optimize distribution
- Monitor proxy status and error rates in real-time

#### 5. Test Your Setup
```bash
# Verify the proxy server is working
curl http://localhost:3146/health

# Check proxy assignments in the management panel
# Make a test request through your AI extension
# Monitor response times and error rates
```

### Configuration Examples

#### Basic HTTP Proxies
```bash
# Standard HTTP proxies
http://proxy1.datacenter.com:8080
http://proxy2.datacenter.com:8080
http://proxy3.datacenter.com:8080
```

#### Secure HTTPS Proxies
```bash
# HTTPS proxies for enhanced security
https://secure-proxy1.provider.com:8443
https://secure-proxy2.provider.com:8443
```

#### SOCKS Proxies
```bash
# SOCKS4 and SOCKS5 proxies
socks://socks-proxy1.provider.com:1080
socks5://socks-proxy2.provider.com:1080
```

#### Authenticated Proxies
```bash
# With username and password
http://username:password@auth-proxy.provider.com:8080
https://user123:pass456@secure-proxy.provider.com:8443
socks5://myuser:mypass@socks-proxy.provider.com:1080
```

#### Mixed Configuration
```bash
# Combine different proxy types for optimal distribution
http://datacenter1.provider.com:8080
https://residential1.provider.com:8443
socks5://mobile1.provider.com:1080
http://user:pass@premium.provider.com:3128
```

### Popular Proxy Services

#### Residential Proxies
- **Bright Data**: `http://session-user:pass@zproxy.lum-superproxy.io:22225`
- **Oxylabs**: `http://customer-user:pass@pr.oxylabs.io:7777`
- **Smartproxy**: `http://user:pass@gate.smartproxy.com:7000`
- **NetNut**: `http://username:password@gw.netnut.io:5959`

#### Datacenter Proxies
- **ProxyMesh**: `http://user:pass@us-wa.proxymesh.com:31280`
- **Storm Proxies**: `http://user:pass@rotating-residential.stormproxies.com:9000`
- **MyPrivateProxy**: `http://user:pass@proxy-server.myprivateproxy.net:8080`
- **SSLPrivateProxy**: `https://user:pass@premium-datacenter.sslprivateproxy.com:8080`

#### Mobile Proxies
- **Proxy-Seller**: `http://user:pass@mobile.proxy-seller.com:10000`
- **ProxyEmpire**: `socks5://user:pass@mobile.proxyempire.io:9001`

### Proxy Health Monitoring

The extension automatically monitors proxy health:

#### Health Check Indicators
- **🟢 Active**: Proxy is working normally
- **🔴 Error**: Proxy has connection issues
- **⚪ Inactive**: Proxy is temporarily disabled

#### Automatic Actions
- **Failed Requests**: Automatically retry with different proxy
- **High Error Rate**: Temporarily disable problematic proxies
- **Recovery**: Re-enable proxies when they become available
- **Load Balancing**: Redistribute assignments for optimal performance

#### Manual Management
- **Rebalance**: Click "Rebalance Proxy Assignments" to optimize distribution
- **Remove**: Delete proxies with consistently high error rates
- **Edit**: Update proxy URLs or credentials as needed

## 🔧 Advanced Configuration

### Health Check Settings
```typescript
// Configurable via management panel
{
  healthCheckInterval: 60000,     // Check every 60 seconds
  maxErrorsBeforeDisable: 3,      // Disable after 3 consecutive failures
  autoAssignmentEnabled: true,    // Automatically assign proxies to new keys
  loadBalancingStrategy: "least_loaded" // round_robin, least_loaded, random
}
```

### Performance Optimization
- **Load Balancing**: Automatic distribution based on current load
- **Health Monitoring**: Failed proxies are automatically disabled
- **Error Recovery**: Graceful fallback to direct connection
- **Memory Management**: Automatic cleanup of old metrics

## 📱 Management Interface

### API Keys & Proxy Assignments Table
- **Comprehensive View**: All API keys with their current proxy assignments
- **Assignment Indicators**: 🔧 Manual, ⚡ Auto, 🔗 Direct connection
- **Real-time Status**: Available, cooling down, or disabled states
- **Interactive Management**: Click dropdown to reassign proxies instantly
- **Usage Tracking**: Last used timestamps and rate limit monitoring
- **Built-in Help**: Hover tooltips explain each column and status

### Proxy Management Section
- **Easy Addition**: Simple URL input with format validation
- **Status Monitoring**: 🟢 Active, 🔴 Error, ⚪ Inactive indicators
- **Load Balancing**: View assigned key count per proxy
- **Health Checking**: Automatic detection of failed proxies
- **Quick Actions**: Edit, delete, and rebalance with one click
- **Comprehensive Help**: Built-in configuration examples and troubleshooting

### Interactive Help & Guidance
- **Quick Tips**: Essential setup guidance right in the interface
- **Format Examples**: Common proxy URL formats with real provider examples
- **Assignment Legend**: Clear explanation of manual vs automatic assignments
- **Status Indicators**: Visual guide to all status meanings
- **Troubleshooting**: Expandable help sections for common issues
- **Empty State Guidance**: Step-by-step instructions when no keys are configured

### Performance Dashboard
- **Real-time Metrics**: Live proxy performance and error rates
- **Load Distribution**: Visual representation of key assignments
- **Health Monitoring**: Automatic proxy failure detection and recovery
- **Optimization Recommendations**: Smart suggestions for better performance

## 🛠️ Troubleshooting

### Common Issues

#### "No available API keys" Error
- **Cause**: No API keys configured or all keys are cooling down
- **Solution**: Add more API keys or wait for cooldown to expire
- **Command**: `> Gemini: Add API Key`

#### Proxy Connection Failures
- **Cause**: Proxy server is down or unreachable
- **Solution**: Check proxy URL format and availability
- **Test**: `curl -x http://proxy:port https://httpbin.org/ip`

#### Rate Limiting Issues
- **Cause**: Too many requests from single IP/proxy
- **Solution**: Add more proxies or API keys
- **Monitor**: Check rate limit indicators in management panel

### Debug Mode
Enable detailed logging:
```bash
# Set environment variable
DEBUG=gemini-aggregator:* code
```

### Health Check
Test your configuration:
```bash
# Open terminal in VS Code
npm run test:proxy
```

## 🔒 Security & Privacy

### Data Protection
- API keys stored securely with VS Code SecretStorage
- No data transmitted to external services
- Local proxy server only accessible from localhost

### Best Practices
- Use HTTPS proxies when available
- Rotate API keys regularly
- Monitor proxy usage for unexpected activity
- Use test API keys for development

### Proxy Security
- Validate proxy URLs before adding
- Use authenticated proxies for sensitive work
- Monitor proxy performance and errors
- Remove unused or failing proxies

## 🚀 Integration Examples

### Cline Configuration
```json
{
  "anthropic": {
    "baseURL": "http://localhost:3146"
  }
}
```

### Continue Configuration
```json
{
  "models": [{
    "title": "Gemini Pro via Aggregator",
    "provider": "gemini",
    "model": "gemini-pro",
    "apiBase": "http://localhost:3146"
  }]
}
```

### Roo Code Configuration
```json
{
  "gemini": {
    "endpoint": "http://localhost:3146",
    "model": "gemini-pro"
  }
}
```

## 📊 Performance Tips

### Optimal Setup
- **API Keys**: 3-5 keys for most use cases
- **Proxies**: 1-2 proxies per API key
- **Geographic Distribution**: Use proxies from different regions
- **Load Balancing**: Enable automatic rebalancing

### Monitoring
- Check error rates regularly (should be <5%)
- Monitor response times (should be <3s)
- Watch for proxy failures
- Review load distribution

### Scaling
- Add more API keys for higher throughput
- Use faster proxies for better performance
- Enable automatic proxy assignment
- Monitor memory usage with many proxies

## 🤝 Contributing

### Development Setup
```bash
git clone https://github.com/your-repo/gemini-aggregator
cd gemini-aggregator
npm install
npm run compile
```

### Testing
```bash
# Setup test environment
npm run test:setup

# Run integration tests
npm run test:integration

# Test with real proxies
npm run test:proxy
```

### Building
```bash
npm run vscode:prepublish
vsce package
```

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Issues**: [GitHub Issues](https://github.com/your-repo/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-repo/discussions)
- **Documentation**: [Wiki](https://github.com/your-repo/wiki)

## 🔄 Changelog

### v1.0.0 - Proxy-per-API-Key Release
- ✅ Dedicated proxy assignment per API key
- ✅ Advanced proxy management interface
- ✅ Real-time performance monitoring
- ✅ Automatic load balancing and health checking
- ✅ Seamless migration from legacy system
- ✅ Comprehensive error handling and recovery

### v0.0.2 - Legacy Release
- Basic proxy rotation support
- Multiple API key management
- Simple rate limit handling

---

**Made with ❤️ for the AI development community**