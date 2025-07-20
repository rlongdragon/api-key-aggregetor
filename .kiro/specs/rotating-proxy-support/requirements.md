# Requirements Document

## Introduction

This feature adds support for rotating proxy endpoints as an alternative to the current proxy-per-API-key system. A rotating proxy uses a single endpoint that automatically rotates IP addresses on each request, providing IP diversity without needing to manage multiple individual proxy servers.

## Requirements

### Requirement 1

**User Story:** As a developer using the Gemini API aggregator, I want to configure a rotating proxy endpoint so that I can get IP rotation benefits with simpler configuration.

#### Acceptance Criteria

1. WHEN a user configures a rotating proxy endpoint THEN the system SHALL accept the rotating proxy format (username-rotate:password@host:port)
2. WHEN a rotating proxy is configured THEN the system SHALL use this proxy for all API requests instead of individual proxy assignments
3. WHEN using a rotating proxy THEN each API request SHALL automatically get a different IP address from the proxy provider
4. WHEN a rotating proxy is set THEN the system SHALL disable the proxy-per-API-key assignment logic

### Requirement 2

**User Story:** As a user, I want to easily switch between rotating proxy mode and individual proxy mode so that I can choose the best approach for my use case.

#### Acceptance Criteria

1. WHEN rotating proxy is enabled THEN individual proxy assignments SHALL be ignored
2. WHEN rotating proxy is disabled THEN the system SHALL fall back to proxy-per-API-key assignments
3. WHEN switching proxy modes THEN existing API key assignments SHALL be preserved for fallback
4. WHEN no rotating proxy is configured THEN the system SHALL use the existing proxy-per-API-key logic

### Requirement 3

**User Story:** As a user, I want to configure the rotating proxy through environment variables so that I can easily manage the configuration.

#### Acceptance Criteria

1. WHEN ROTATING_PROXY environment variable is set THEN the system SHALL use rotating proxy mode
2. WHEN ROTATING_PROXY is not set or empty THEN the system SHALL use individual proxy mode
3. WHEN rotating proxy configuration is invalid THEN the system SHALL log an error and fall back to individual proxy mode
4. WHEN rotating proxy is configured THEN the system SHALL validate the format before using it

### Requirement 4

**User Story:** As a user, I want the rotating proxy to work with all existing API functionality so that I don't lose any features when switching modes.

#### Acceptance Criteria

1. WHEN using rotating proxy THEN all API methods (generateContent, streamGenerateContent) SHALL work correctly
2. WHEN using rotating proxy THEN error handling and retry logic SHALL function as expected
3. WHEN using rotating proxy THEN request logging and monitoring SHALL continue to work
4. WHEN rotating proxy fails THEN the system SHALL provide clear error messages and fallback options

### Requirement 5

**User Story:** As a user, I want to see the status of the rotating proxy in the management interface so that I can monitor its health and usage.

#### Acceptance Criteria

1. WHEN rotating proxy is active THEN the management UI SHALL display rotating proxy status
2. WHEN rotating proxy is healthy THEN the UI SHALL show it as active with usage statistics
3. WHEN rotating proxy fails health checks THEN the UI SHALL show error status and details
4. WHEN in rotating proxy mode THEN the UI SHALL clearly indicate this mode is active