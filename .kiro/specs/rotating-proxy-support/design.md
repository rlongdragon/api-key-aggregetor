# Design Document

## Overview

This design implements rotating proxy support as an alternative to the current proxy-per-API-key system. When a rotating proxy is configured, all API requests will use the single rotating endpoint that automatically provides different IP addresses per request.

## Architecture

### Configuration Detection
- Check for `ROTATING_PROXY` environment variable on startup
- If set and valid, enable rotating proxy mode
- If not set or invalid, fall back to individual proxy mode

### Proxy Mode Selection
```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│ Request Arrives │───▶│ Check Proxy Mode │───▶│ Route to Handler│
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                │                        │
                                ▼                        ▼
                       ┌─────────────────┐    ┌─────────────────┐
                       │ Rotating Proxy? │    │ Individual Mode │
                       └─────────────────┘    └─────────────────┘
                                │                        │
                                ▼                        ▼
                       ┌─────────────────┐    ┌─────────────────┐
                       │ Use Single      │    │ Use Assigned    │
                       │ Rotating Proxy  │    │ Proxy per Key   │
                       └─────────────────┘    └─────────────────┘
```

## Components and Interfaces

### 1. Configuration Manager Enhancement
- Add `getRotatingProxy()` method to return configured rotating proxy
- Add `isRotatingProxyEnabled()` method to check if rotating mode is active
- Validate rotating proxy format on startup

### 2. GoogleApiForwarder Enhancement
- Modify `forwardRequest()` to check proxy mode before selecting proxy
- When rotating proxy is enabled, use it for all requests regardless of API key
- Maintain existing proxy logic as fallback

### 3. ApiKeyManager Enhancement
- Skip proxy assignment when rotating proxy is enabled
- Continue to manage API keys normally but ignore proxy assignments

## Data Models

### Rotating Proxy Configuration
```typescript
interface RotatingProxyConfig {
  enabled: boolean;
  url: string;
  isValid: boolean;
  lastHealthCheck?: Date;
  errorCount: number;
}
```

### Enhanced API Key Interface
```typescript
interface ApiKey {
  key: string;
  keyId: string;
  status: 'active' | 'rate_limited' | 'error';
  proxy?: string; // Ignored when rotating proxy is enabled
  useRotatingProxy?: boolean; // Flag to indicate rotating proxy usage
  currentRequests: number;
  lastUsed?: Date;
  usedHistory: Date[];
}
```

## Implementation Strategy

### Phase 1: Configuration and Detection
1. Add rotating proxy configuration loading
2. Add validation for rotating proxy format
3. Add mode detection logic

### Phase 2: Request Routing
1. Modify GoogleApiForwarder to check proxy mode
2. Route requests through rotating proxy when enabled
3. Maintain fallback to individual proxy logic

### Phase 3: Integration
1. Update ApiKeyManager to handle rotating proxy mode
2. Update health checking for rotating proxy
3. Update UI to show rotating proxy status

## Error Handling

### Rotating Proxy Failures
- If rotating proxy fails, log error and attempt retry
- After max retries, fall back to individual proxy mode if available
- Provide clear error messages about rotating proxy status

### Configuration Errors
- Invalid rotating proxy format: Log warning and disable rotating mode
- Network errors: Retry with exponential backoff
- Authentication errors: Log error and disable rotating proxy

## Testing Strategy

### Unit Tests
- Test rotating proxy configuration loading
- Test proxy mode detection logic
- Test request routing with rotating proxy

### Integration Tests
- Test full request flow with rotating proxy
- Test fallback behavior when rotating proxy fails
- Test switching between proxy modes

### Manual Testing
- Verify rotating proxy works with real Webshare endpoint
- Test IP rotation by making multiple requests
- Verify fallback to individual proxies when needed