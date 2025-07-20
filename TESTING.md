# Testing the Proxy-per-API-Key Feature

This document explains how to test the proxy-per-API-key functionality with real proxies and API keys.

## Quick Setup

1. **Copy the environment template:**
   ```bash
   cp .env.example .env
   ```

2. **Edit the `.env` file with your real values:**
   ```bash
   # Add your actual Gemini API keys (comma-separated)
   TEST_API_KEYS="AIzaSyABC123...,AIzaSyDEF456...,AIzaSyGHI789..."
   
   # Add your proxy URLs (comma-separated)
   TEST_PROXIES="http://proxy1.example.com:8080,http://proxy2.example.com:8080,socks5://proxy3.example.com:1080"
   
   # Optional: Customize test settings
   TEST_MODEL=gemini-pro
   TEST_PROMPT="Hello, how are you? Please respond briefly."
   ```

3. **Run the tests:**
   ```bash
   # Interactive test runner with detailed output
   npm run test:proxy
   
   # Full integration test suite
   npm run test:integration
   ```

## Environment Variables

### Required Variables

- **`TEST_API_KEYS`**: Comma-separated list of your Gemini API keys
  - Example: `"key1,key2,key3"`
  - Get your keys from: https://makersuite.google.com/app/apikey

- **`TEST_PROXIES`**: Comma-separated list of proxy URLs
  - Supported formats:
    - HTTP: `http://host:port`
    - HTTPS: `https://host:port`
    - SOCKS4: `socks://host:port`
    - SOCKS5: `socks5://host:port`
  - Example: `"http://proxy1.com:8080,socks5://proxy2.com:1080"`

### Optional Variables

- **`TEST_MODEL`**: Gemini model to use for testing (default: `gemini-pro`)
- **`TEST_PROMPT`**: Test prompt to send (default: `"Hello, how are you? Please respond briefly."`)

## Test Scripts

### Interactive Test Runner (`npm run test:proxy`)

This script provides detailed, real-time output showing:
- ✅ Proxy addition and health checks
- 🔗 API key to proxy assignments
- 🧪 Actual API requests through each proxy
- 📊 Final status report

**Example output:**
```
🚀 Starting Proxy-per-API-Key Test Runner
=====================================
📊 Test Configuration:
   API Keys: 3 keys
   Proxies: 2 proxies
   Model: gemini-pro

🌐 Adding proxies to the pool...
   ✅ Added proxy: http://proxy1.com:8080 (ID: proxy_123)
   ✅ Added proxy: http://proxy2.com:8080 (ID: proxy_456)

🔗 Assigning proxies to API keys...
   ✅ Assigned http://proxy1.com:8080 to test_key_1
   ✅ Assigned http://proxy2.com:8080 to test_key_2

🧪 Testing requests through assigned proxies...
   ✅ Request successful through http://proxy1.com:8080
   ✅ Request successful through http://proxy2.com:8080
```

### Integration Test Suite (`npm run test:integration`)

Comprehensive test suite that validates:
- Proxy pool management
- Automatic proxy assignment
- Request routing through proxies
- Error handling and fallbacks
- Load balancing and rebalancing

## Proxy Requirements

### Supported Proxy Types

1. **HTTP/HTTPS Proxies**
   - Format: `http://host:port` or `https://host:port`
   - Most common type, works with most proxy providers

2. **SOCKS Proxies**
   - Format: `socks://host:port` or `socks5://host:port`
   - Better for bypassing restrictions

### Proxy Provider Examples

Popular proxy services you can use for testing:

- **Bright Data** (formerly Luminati)
- **Oxylabs**
- **Smartproxy**
- **ProxyMesh**
- **Storm Proxies**

### Free Proxy Lists (for testing only)

⚠️ **Warning**: Free proxies are unreliable and should only be used for testing:
- https://www.proxy-list.download/
- https://free-proxy-list.net/
- https://www.proxynova.com/

## Troubleshooting

### Common Issues

1. **"No API keys provided" error**
   - Make sure `TEST_API_KEYS` is set in your `.env` file
   - Check that API keys are comma-separated without spaces

2. **"No proxies provided" error**
   - Make sure `TEST_PROXIES` is set in your `.env` file
   - Verify proxy URL format (include protocol: http://, https://, socks://, socks5://)

3. **Proxy connection failures**
   - Test proxy manually: `curl -x http://proxy:port https://httpbin.org/ip`
   - Check if proxy requires authentication
   - Verify proxy is not blocked by your network

4. **API rate limiting**
   - The test includes delays between requests
   - Use multiple API keys to distribute load
   - Consider using fewer test iterations

### Debug Mode

Enable verbose logging by setting:
```bash
DEBUG=proxy-per-api-key npm run test:proxy
```

### Testing Individual Components

Test specific components:
```bash
# Test only proxy pool management
npm run compile && node -e "
const { ProxyPoolManager } = require('./out/server/core/ProxyPoolManager');
// ... test code
"

# Test only proxy assignments
npm run compile && node -e "
const { ProxyAssignmentManager } = require('./out/server/core/ProxyAssignmentManager');
// ... test code
"
```

## Security Notes

- **Never commit your `.env` file** - it contains sensitive API keys
- **Use test API keys** when possible, not production keys
- **Rotate API keys** regularly
- **Monitor proxy usage** to avoid unexpected charges
- **Use HTTPS proxies** when available for better security

## Expected Test Results

### Successful Test Run

When everything works correctly, you should see:
- All proxies added successfully
- Health checks passing for active proxies
- API keys assigned to different proxies
- Successful API requests through each proxy
- Balanced load distribution

### Partial Success

It's normal to see some failures:
- Some proxies may fail health checks (marked as inactive)
- Some API requests may fail due to proxy issues
- The system should gracefully handle these failures

### Complete Failure

If all tests fail, check:
- API keys are valid and have quota remaining
- Proxies are accessible from your network
- No firewall blocking proxy connections
- Environment variables are correctly set

## Performance Testing

For load testing with many proxies/keys:

```bash
# Set larger test dataset
TEST_API_KEYS="key1,key2,key3,key4,key5" \
TEST_PROXIES="proxy1,proxy2,proxy3,proxy4,proxy5" \
npm run test:integration
```

Monitor:
- Response times through different proxies
- Error rates per proxy
- Load balancing effectiveness
- Memory usage during tests