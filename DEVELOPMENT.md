# Development Guide for API Key Aggregator VS Code Extension

This document provides instructions for setting up the development environment, building, running, and contributing to the API Key Aggregator VS Code Extension project.

## Prerequisites

*   Node.js (version 20.x or later recommended)
*   npm (usually comes with Node.js)
*   Git
*   VS Code

## Setting up the Development Environment

1.  **Clone the project:**
    ```bash
    git clone https://github.com/JamzYang/api-key-aggregetor
    cd api-key-aggregetor
    ```
2.  **Install dependencies:**
    ```bash
    npm install -g yo generator-code
    npm install
    ```
3.  **Open the extension project in VS Code:**
    ```bash
    code api-key-aggregetor
    ```

## Building and Running

1.  **Compile the project:**
    ```bash
    npm run compile
    ```
    Or use `npm run watch` to automatically recompile on file changes.

2.  **Run the extension (Debug Mode):**
    *   In the newly opened VS Code window, open the Debug View (usually the bug icon in the sidebar).
    *   Select the "Run Extension" configuration from the top dropdown menu.
    *   Click the green start debugging button.

    This will open a new VS Code window with the extension we are developing loaded. When the extension is activated, the embedded proxy server should start and output startup information in the debug console (e.g., "Proxy server is running on port XXXX").

## Testing

*   Run tests using the command:
    ```bash
    npm test
    ```

## Packaging the Extension

*   To package the extension for distribution, execute:
    ```bash
    vsce package
    ```
    This will create a `.vsix` file in the project root directory.

## Proxy Configuration for Development

### Setting Up Test Environment

For development and testing, you'll need to configure proxy servers. Here are common setups:

#### Local Proxy Setup (for testing)
```bash
# Install a local proxy server for testing
npm install -g http-proxy-cli

# Start a local HTTP proxy on port 8080
http-proxy-cli --port 8080

# Test the proxy
curl -x http://localhost:8080 https://httpbin.org/ip
```

#### Using Public Test Proxies
```bash
# Free test proxies (use only for development)
http://proxy-server.com:8080
http://free-proxy.example.com:3128

# Note: Never use free proxies for production!
```

#### Docker Proxy Setup
```dockerfile
# Create a test proxy using Docker
version: '3'
services:
  squid-proxy:
    image: ubuntu/squid:latest
    ports:
      - "3128:3128"
    volumes:
      - ./squid.conf:/etc/squid/squid.conf
```

### Development Configuration Examples

#### Basic Development Setup
```json
// .env file for development
TEST_PROXIES=http://localhost:8080,http://localhost:3128
TEST_API_KEYS=AIzaSy...your-test-key-1,AIzaSy...your-test-key-2
DEBUG=gemini-aggregator:*
```

#### VS Code Settings for Development
```json
// .vscode/settings.json
{
  "geminiAggregator-dev.port": 3146,
  "geminiAggregator-dev.debug": true,
  "geminiAggregator-dev.healthCheckInterval": 30000,
  "geminiAggregator-dev.maxErrorsBeforeDisable": 5
}
```

#### Testing Different Proxy Types
```bash
# HTTP proxy
http://test-proxy.local:8080

# HTTPS proxy
https://secure-test-proxy.local:8443

# SOCKS5 proxy
socks5://socks-test-proxy.local:1080

# Authenticated proxy
http://testuser:testpass@auth-proxy.local:8080
```

### Running Tests with Proxies

```bash
# Setup test environment with proxies
npm run test:setup

# Run proxy-specific tests
npm run test:proxy

# Run integration tests with real proxies
TEST_PROXIES="http://proxy1:8080,http://proxy2:8080" npm run test:integration

# Test with authentication
TEST_PROXIES="http://user:pass@proxy:8080" npm test
```

### Debugging Proxy Issues

#### Enable Debug Logging
```bash
# Start VS Code with debug logging
DEBUG=gemini-aggregator:* code

# Or set in VS Code settings
"geminiAggregator-dev.debug": true
```

#### Monitor Proxy Health
```bash
# Check proxy status in development
curl -x http://proxy:port https://httpbin.org/ip

# Test proxy response time
time curl -x http://proxy:port https://google.com

# Check proxy authentication
curl -x http://user:pass@proxy:port https://httpbin.org/headers
```

#### Common Development Issues

**Port Conflicts:**
```bash
# Check if port 3146 is in use
lsof -i :3146

# Kill process using the port
kill -9 $(lsof -t -i:3146)

# Use different port for development
"geminiAggregator-dev.port": 3147
```

**Proxy Connection Issues:**
```bash
# Test proxy connectivity
telnet proxy.example.com 8080

# Check proxy logs (if available)
tail -f /var/log/proxy/access.log

# Verify proxy configuration
curl -v -x http://proxy:port https://httpbin.org/ip
```

### Mock Proxy Server for Testing

Create a mock proxy server for consistent testing:

```javascript
// scripts/mock-proxy-server.js
const http = require('http');
const httpProxy = require('http-proxy');

const proxy = httpProxy.createProxyServer({});

const server = http.createServer((req, res) => {
  // Add delay to simulate network latency
  setTimeout(() => {
    proxy.web(req, res, {
      target: 'https://generativelanguage.googleapis.com',
      changeOrigin: true,
      secure: true
    });
  }, Math.random() * 1000); // Random delay 0-1s
});

server.listen(8080, () => {
  console.log('Mock proxy server running on port 8080');
});
```

```bash
# Run mock proxy server
node scripts/mock-proxy-server.js

# Use in tests
TEST_PROXIES="http://localhost:8080" npm test
```

## Project Status and Future Plans

### Current Features
- ✅ Dedicated proxy assignment per API key
- ✅ Automatic load balancing across proxies
- ✅ Real-time proxy health monitoring
- ✅ Comprehensive error handling and recovery
- ✅ Migration from legacy proxy system
- ✅ Rich management interface with inline help

### Future Enhancements
- 🔄 Geographic proxy selection based on API endpoint
- 🔄 Advanced load balancing strategies (weighted, latency-based)
- 🔄 Proxy performance analytics and recommendations
- 🔄 Integration with popular proxy management services
- 🔄 Automated proxy testing and validation