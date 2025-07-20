# Proxy Setup Examples

This document provides step-by-step configuration examples for common proxy setups with the Gemini API Key Aggregator Proxy Plus extension.

## 🚀 Quick Start Guide

### 1. Basic Setup (No Proxies)
Perfect for testing or when you don't need proxy functionality.

```bash
# Step 1: Add API keys
Ctrl+Shift+P > Gemini: Add API Key
# Paste your API key: AIzaSy...

# Step 2: Configure your AI extension
# Point to: http://localhost:3146

# That's it! Your API keys will work without proxies.
```

### 2. Simple Proxy Setup (Recommended for Beginners)
Start with 2-3 proxies for basic load distribution.

```bash
# Step 1: Open management panel
Ctrl+Shift+P > Gemini: Open Aggregator Panel

# Step 2: Add proxies in the Proxy Management section
http://proxy1.example.com:8080
http://proxy2.example.com:8080

# Step 3: Add API keys
# Each key will automatically get assigned a proxy

# Step 4: Verify assignments
# Check the API Keys table to see proxy assignments
```

## 🏢 Provider-Specific Examples

### Bright Data (Luminati)

#### Basic Residential Setup
```bash
# Format: http://session-username:password@endpoint:port
http://session-myuser123:mypassword@zproxy.lum-superproxy.io:22225

# Multiple endpoints for load balancing
http://session-myuser123:mypassword@zproxy.lum-superproxy.io:22225
http://session-myuser123:mypassword@zproxy.lum-superproxy.io:22226
http://session-myuser123:mypassword@zproxy.lum-superproxy.io:22227
```

#### Sticky Session Setup
```bash
# Same IP for duration of session
http://session-myuser123-session-rand456:mypassword@zproxy.lum-superproxy.io:22225
http://session-myuser123-session-rand789:mypassword@zproxy.lum-superproxy.io:22225
http://session-myuser123-session-rand012:mypassword@zproxy.lum-superproxy.io:22225
```

#### Country-Specific Setup
```bash
# US-only proxies
http://session-myuser123-country-us:mypassword@zproxy.lum-superproxy.io:22225
http://session-myuser123-country-us-session-rand1:mypassword@zproxy.lum-superproxy.io:22225

# Multiple countries for geographic distribution
http://session-myuser123-country-us:mypassword@zproxy.lum-superproxy.io:22225
http://session-myuser123-country-gb:mypassword@zproxy.lum-superproxy.io:22225
http://session-myuser123-country-de:mypassword@zproxy.lum-superproxy.io:22225
```

### Oxylabs

#### Rotating Residential
```bash
# Basic rotating setup
http://customer-myuser:mypassword@pr.oxylabs.io:7777

# Multiple endpoints
http://customer-myuser:mypassword@pr.oxylabs.io:7777
http://customer-myuser:mypassword@pr.oxylabs.io:7778
http://customer-myuser:mypassword@pr.oxylabs.io:7779
```

#### Sticky Sessions
```bash
# Sticky session format
http://customer-myuser-session-rand123:mypassword@pr.oxylabs.io:7777
http://customer-myuser-session-rand456:mypassword@pr.oxylabs.io:7777
http://customer-myuser-session-rand789:mypassword@pr.oxylabs.io:7777
```

#### Datacenter Proxies
```bash
# Datacenter endpoints
http://customer-myuser:mypassword@dc.oxylabs.io:8001
http://customer-myuser:mypassword@dc.oxylabs.io:8002
http://customer-myuser:mypassword@dc.oxylabs.io:8003
```

### Smartproxy

#### Residential Rotating
```bash
# Basic setup
http://myuser:mypassword@gate.smartproxy.com:7000

# Multiple ports for load balancing
http://myuser:mypassword@gate.smartproxy.com:7000
http://myuser:mypassword@gate.smartproxy.com:7001
http://myuser:mypassword@gate.smartproxy.com:7002
```

#### Sticky Sessions
```bash
# Session-based sticky IPs
http://myuser-session-rand123:mypassword@gate.smartproxy.com:7000
http://myuser-session-rand456:mypassword@gate.smartproxy.com:7000
http://myuser-session-rand789:mypassword@gate.smartproxy.com:7000
```

#### City-Level Targeting
```bash
# Specific cities
http://myuser-city-newyork:mypassword@gate.smartproxy.com:7000
http://myuser-city-losangeles:mypassword@gate.smartproxy.com:7000
http://myuser-city-chicago:mypassword@gate.smartproxy.com:7000
```

### ProxyMesh

#### US Locations
```bash
# Different US regions
http://myuser:mypassword@us-wa.proxymesh.com:31280
http://myuser:mypassword@us-ca.proxymesh.com:31280
http://myuser:mypassword@us-il.proxymesh.com:31280
http://myuser:mypassword@us-fl.proxymesh.com:31280
```

#### International
```bash
# Global distribution
http://myuser:mypassword@uk.proxymesh.com:31280
http://myuser:mypassword@de.proxymesh.com:31280
http://myuser:mypassword@jp.proxymesh.com:31280
http://myuser:mypassword@au.proxymesh.com:31280
```

### NetNut

#### Residential Setup
```bash
# Basic residential
http://myuser:mypassword@gw.netnut.io:5959

# Multiple gateways
http://myuser:mypassword@gw.netnut.io:5959
http://myuser:mypassword@gw2.netnut.io:5959
http://myuser:mypassword@gw3.netnut.io:5959
```

#### Datacenter Setup
```bash
# Datacenter proxies
http://myuser:mypassword@gw-dc.netnut.io:5960
http://myuser:mypassword@gw-dc2.netnut.io:5960
http://myuser:mypassword@gw-dc3.netnut.io:5960
```

## 🔧 Advanced Configuration Scenarios

### High-Volume Setup (10+ API Keys)
For applications requiring high throughput and reliability.

```bash
# Step 1: Add multiple proxy types for redundancy
# Residential proxies (primary)
http://user1:pass1@residential1.provider.com:8080
http://user1:pass1@residential2.provider.com:8080
http://user1:pass1@residential3.provider.com:8080

# Datacenter proxies (backup)
http://user2:pass2@datacenter1.provider.com:3128
http://user2:pass2@datacenter2.provider.com:3128

# Mobile proxies (premium)
socks5://user3:pass3@mobile1.provider.com:1080
socks5://user3:pass3@mobile2.provider.com:1080

# Step 2: Add 10+ API keys
# Each will be automatically distributed across proxies

# Step 3: Monitor and optimize
# Use "Rebalance Proxy Assignments" as needed
# Remove underperforming proxies
# Add more proxies if error rates are high
```

### Geographic Distribution Setup
Optimize for global users with region-specific proxies.

```bash
# North America
http://user:pass@us-east.provider.com:8080
http://user:pass@us-west.provider.com:8080
http://user:pass@canada.provider.com:8080

# Europe
http://user:pass@uk.provider.com:8080
http://user:pass@germany.provider.com:8080
http://user:pass@france.provider.com:8080

# Asia Pacific
http://user:pass@japan.provider.com:8080
http://user:pass@singapore.provider.com:8080
http://user:pass@australia.provider.com:8080
```

### Development vs Production Setup

#### Development Environment
```bash
# Simple setup for testing
http://test-proxy.local:8080
http://dev-proxy.company.com:3128

# Or use free/cheap proxies for development
http://free-proxy1.example.com:8080
http://free-proxy2.example.com:8080
```

#### Production Environment
```bash
# Premium residential proxies
https://premium-user:secure-pass@residential.premium-provider.com:8443
https://premium-user:secure-pass@residential2.premium-provider.com:8443

# Backup datacenter proxies
https://dc-user:dc-pass@datacenter.reliable-provider.com:8443
https://dc-user:dc-pass@datacenter2.reliable-provider.com:8443

# Mobile proxies for special cases
socks5://mobile-user:mobile-pass@mobile.premium-provider.com:1080
```

### Mixed Protocol Setup
Using different proxy types for optimal performance.

```bash
# HTTP proxies (fastest, least secure)
http://fast-proxy1.provider.com:8080
http://fast-proxy2.provider.com:8080

# HTTPS proxies (secure, good performance)
https://secure-proxy1.provider.com:8443
https://secure-proxy2.provider.com:8443

# SOCKS5 proxies (most flexible, good for special cases)
socks5://socks-proxy1.provider.com:1080
socks5://socks-proxy2.provider.com:1080
```

## 🛠️ Configuration Best Practices

### 1. Start Small, Scale Up
```bash
# Begin with 2-3 proxies
# Add more based on usage patterns
# Monitor error rates and performance
```

### 2. Test Before Production
```bash
# Test each proxy manually:
curl -x http://proxy:port https://httpbin.org/ip

# Expected: Different IP than your real IP
# If same IP returned, proxy is not working
```

### 3. Monitor and Maintain
```bash
# Regular checks:
# - Proxy status in management panel
# - Error rates (should be <5%)
# - Response times (should be <3s)
# - Load distribution (should be even)
```

### 4. Security Considerations
```bash
# Use HTTPS proxies when possible
https://user:pass@secure-proxy.com:8443

# Avoid HTTP for sensitive data
# Use strong passwords
# Rotate credentials regularly
```

### 5. Performance Optimization
```bash
# Geographic proximity
# Use proxies close to Google's servers
# US West Coast often performs best

# Load balancing
# Distribute API keys evenly
# Use "Rebalance" button regularly

# Redundancy
# Have backup ils.uration detanfig your co withrepo/issues)r-com/youithub.https://gtHub Issue]( Open a [Giic setup?** your specif help with
**Need-
``

--r
`lovec faitiutomatoring
# Atime moni# Real-oxy types
of all prers
# Mix le providmultipxies across 
# 10+ pro``bashs)
`PI Key0+ Aavy Usage (1He### 
```

#onitor daily
# Mtributionic dis# Geographdential)
enter + resis (datacproxiemixed ash
# 5-7 eys)
```b10 API K(4-Usage #### Medium 

``ekly
`weMonitor nabled
# nt eassignmeo-# Autes
ter proxientac da 2-3``bash
# Keys)
`PI(1-3 Aight Usage 
#### LCase
s by Use gurationd Confi# Recommende``

##.0-5.0s
`oxy: 2 Mobile pr 1.5-4.0s
#ial proxy:Resident
# 0-2.5sr proxy: 1.Datacente5-1.5s
# ection: 0.ct connreDi``bash
# ype
`xy T by Proe Timesesponsal R# Typics

##chmark Benancerform Pe 📊```

##0
xy.com:8080ssw0rd@procom:p%4main.://user%40dos:
httpw0rd becomep@ssn.com:maiser@dole: u%3A
# Examps come
# : be%40@ becomes 
# ers:actial charor spec fL encodingURh
# Check 
```basFailuresentication  Issue: Auth
###s
```
vice proxy serse premium# 4. U
requestsrrent ce concu)
# 3. Redu residentialter vsdatacenroxy type (o faster ptch t
# 2. Swiation loc to yourerroxies clos1. Use p:
# olutions S`bash
#e)
``se timespon5s re (>erformanc Slow P# Issue:

##listed
```s blackck if IP i
# 4. Chedloaribute istxies to droe pmor
# 3. Add teratacenead of dntial inst resider
# 2. Usexy provident pro to differetch1. Swions:
# utiSol
# )
```bashates (>20%or Righ Erre: H# Issud
```

##telisteot whiIP n - 
#nrvice dowoxy se Prs
# -g connectionckinwall blo- Firentials
# Wrong crede
# - s:ommon causep

# Crg/in.otps://httpbi0 htcom:808ple.oxy.examprpass@r:se -x http://uly
curlxy manualt pro
# Tesle.com
mp.exag proxyvity
pinonnectiwork c
# Check net
```bashr" Statusowing "Erroxies Sh Pro# Issue: Alltups

##Se Common shootingTrouble
## 🔍 ```
rs
t providefferendiy
# Mix es readproxi