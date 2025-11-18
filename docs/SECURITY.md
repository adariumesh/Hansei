# HANSEI - Security Guide

**Version:** 1.0.0
**Last Updated:** November 17, 2025

---

## Table of Contents

1. [Security Overview](#security-overview)
2. [Infrastructure Security](#infrastructure-security)
3. [Application Security](#application-security)
4. [Data Security](#data-security)
5. [Network Security](#network-security)
6. [Authentication & Authorization](#authentication--authorization)
7. [Security Monitoring](#security-monitoring)
8. [Incident Response](#incident-response)
9. [Compliance](#compliance)
10. [Security Checklist](#security-checklist)

---

## Security Overview

### Security Principles

HANSEI follows these security principles:

- **Defense in Depth:** Multiple layers of security controls
- **Least Privilege:** Minimal access rights for all components
- **Fail Secure:** System fails to secure state, not open
- **Security by Design:** Security built into architecture
- **Regular Updates:** Timely security patches and updates

### Threat Model

**Protected Against:**
- ✅ SQL Injection
- ✅ Cross-Site Scripting (XSS)
- ✅ Cross-Site Request Forgery (CSRF)
- ✅ DDoS attacks (basic protection)
- ✅ File upload attacks
- ✅ Data exposure

**Considerations:**
- ⚠️ Rate limiting (basic implementation)
- ⚠️ Authentication (not yet implemented)
- ⚠️ Encryption at rest (delegated to Raindrop)

---

## Infrastructure Security

### Server Hardening

**Initial Server Setup:**

```bash
#!/bin/bash
# server-hardening.sh

set -e

echo "🔒 Starting server hardening..."

# 1. Update all packages
apt-get update -y
apt-get upgrade -y
apt-get dist-upgrade -y

# 2. Install security packages
apt-get install -y \
  ufw \
  fail2ban \
  unattended-upgrades \
  logwatch \
  rkhunter \
  chkrootkit

# 3. Configure automatic security updates
dpkg-reconfigure -plow unattended-upgrades

cat > /etc/apt/apt.conf.d/50unattended-upgrades << 'EOF'
Unattended-Upgrade::Allowed-Origins {
    "${distro_id}:${distro_codename}-security";
    "${distro_id}ESMApps:${distro_codename}-apps-security";
};
Unattended-Upgrade::AutoFixInterruptedDpkg "true";
Unattended-Upgrade::MinimalSteps "true";
Unattended-Upgrade::Remove-Unused-Dependencies "true";
Unattended-Upgrade::Automatic-Reboot "false";
EOF

# 4. Configure firewall
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS
ufw --force enable

# 5. Secure SSH
sed -i 's/#PermitRootLogin yes/PermitRootLogin no/' /etc/ssh/sshd_config
sed -i 's/#PasswordAuthentication yes/PasswordAuthentication no/' /etc/ssh/sshd_config
sed -i 's/#PermitEmptyPasswords no/PermitEmptyPasswords no/' /etc/ssh/sshd_config
echo "AllowUsers hansei" >> /etc/ssh/sshd_config
systemctl restart sshd

# 6. Configure fail2ban
cat > /etc/fail2ban/jail.local << 'EOF'
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5

[sshd]
enabled = true
port = 22
logpath = /var/log/auth.log

[nginx-http-auth]
enabled = true
port = http,https
logpath = /var/log/nginx/error.log
EOF

systemctl enable fail2ban
systemctl restart fail2ban

# 7. Disable unused services
systemctl disable bluetooth
systemctl disable cups
systemctl disable avahi-daemon

# 8. Set up log rotation
cat > /etc/logrotate.d/hansei << 'EOF'
/var/log/nginx/hansei-*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 www-data adm
    sharedscripts
    postrotate
        systemctl reload nginx > /dev/null
    endscript
}
EOF

echo "✅ Server hardening complete!"
```

**Run hardening script:**

```bash
chmod +x server-hardening.sh
./server-hardening.sh
```

### User Management

**Create non-root user:**

```bash
# Create hansei user
adduser hansei
usermod -aG sudo hansei

# Set up SSH key
mkdir -p /home/hansei/.ssh
cp /root/.ssh/authorized_keys /home/hansei/.ssh/
chown -R hansei:hansei /home/hansei/.ssh
chmod 700 /home/hansei/.ssh
chmod 600 /home/hansei/.ssh/authorized_keys

# Test SSH access
ssh hansei@YOUR_SERVER_IP

# Then disable root login in /etc/ssh/sshd_config
```

### File Permissions

```bash
# Set restrictive permissions
chmod 750 /var/www/hansei
chown -R www-data:www-data /var/www/hansei

# Nginx configuration files
chmod 644 /etc/nginx/sites-available/hansei
chmod 755 /etc/nginx

# SSL certificates (if using)
chmod 600 /etc/ssl/private/*.key
chmod 644 /etc/ssl/certs/*.crt
```

---

## Application Security

### Nginx Security Configuration

**Enhanced Nginx config with security headers:**

```nginx
# /etc/nginx/sites-available/hansei

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;

    root /var/www/hansei;
    index index.html;

    server_name your-domain.com;

    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384';
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    ssl_stapling on;
    ssl_stapling_verify on;

    # Security Headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://svc-*.lmapp.run;" always;
    add_header Permissions-Policy "geolocation=(), microphone=(self), camera=()" always;

    # Hide server version
    server_tokens off;

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=hansei_general:10m rate=10r/s;
    limit_req zone=hansei_general burst=20 nodelay;

    # Prevent clickjacking
    add_header X-Frame-Options "DENY" always;

    location / {
        try_files $uri $uri/ =404;

        # Cache static files
        location ~* \.(jpg|jpeg|png|gif|ico|css|js|svg|woff|woff2|ttf|eot)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }

    # Block common exploit paths
    location ~ /\. {
        deny all;
        access_log off;
        log_not_found off;
    }

    location ~* (\.git|\.env|\.htaccess|\.htpasswd|\.DS_Store) {
        deny all;
        return 404;
    }

    # Logging
    access_log /var/log/nginx/hansei-access.log;
    error_log /var/log/nginx/hansei-error.log;
}

# Redirect HTTP to HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}
```

**Apply configuration:**

```bash
nginx -t
systemctl reload nginx
```

### Backend Security (Raindrop)

**CORS Configuration:**

Update `src/hansei-intelligence-processor/index.ts`:

```typescript
// Restrict CORS to specific origins
app.use('*', cors({
  origin: [
    'http://155.138.196.189',
    'https://your-domain.com',
    'https://www.your-domain.com'
  ],
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  maxAge: 86400, // 24 hours
}));
```

**Input Validation:**

```typescript
// Add validation for /infer endpoint
app.post('/infer', async (c) => {
  const body = await c.req.json();

  // Validate content length
  const content = body.content || body.transcript || body.text;
  if (!content || content.length === 0) {
    return c.json({ error: 'Content is required' }, 400);
  }
  if (content.length > 10000) {
    return c.json({ error: 'Content exceeds maximum length (10,000 characters)' }, 400);
  }

  // Sanitize user_id
  const userId = String(body.user_id || 'anonymous').replace(/[^a-zA-Z0-9_-]/g, '');

  // ... rest of processing
});
```

**File Upload Security:**

```typescript
// Add file upload validation
app.post('/api/voice/ingest', async (c) => {
  const formData = await c.req.formData();
  const audioFile = formData.get('audio') as File;

  if (!audioFile) {
    return c.json({ error: 'Missing audio file' }, 400);
  }

  // Validate file size (max 10MB)
  if (audioFile.size > 10 * 1024 * 1024) {
    return c.json({ error: 'File size exceeds 10MB limit' }, 400);
  }

  // Validate file type
  const allowedTypes = ['audio/wav', 'audio/mpeg', 'audio/ogg', 'audio/webm'];
  if (!allowedTypes.includes(audioFile.type)) {
    return c.json({ error: 'Invalid audio format' }, 400);
  }

  // ... rest of processing
});
```

---

## Data Security

### Data Classification

| Data Type | Sensitivity | Encryption | Retention |
|-----------|-------------|------------|-----------|
| Voice recordings | High | In-transit | Temporary |
| Transcripts | Medium | At-rest | 90 days |
| Entities | Medium | At-rest | Indefinite |
| User metadata | Low | At-rest | Indefinite |
| Logs | Low | None | 30 days |

### Encryption

**In Transit:**
- All API calls use HTTPS/TLS 1.2+
- Frontend-to-backend: TLS 1.3 preferred
- Certificate: Let's Encrypt or commercial CA

**At Rest:**
- Raindrop handles backend data encryption
- Frontend static files: not sensitive, no encryption needed

### Data Retention

```bash
# Automated log cleanup cron job
cat > /etc/cron.daily/hansei-cleanup << 'EOF'
#!/bin/bash
# Clean up old logs
find /var/log/nginx -name "hansei-*.log.*" -mtime +30 -delete

# Clean up old backups
find /root/backups -name "hansei-*.tar.gz" -mtime +7 -delete
EOF

chmod +x /etc/cron.daily/hansei-cleanup
```

### PII Protection

**Recommendations:**
- Do not log user input verbatim
- Redact sensitive information in logs
- Implement user data deletion on request
- Use pseudonymous user IDs

**Example log sanitization:**

```typescript
// Sanitize logs
const sanitizeLog = (data: any) => {
  if (typeof data === 'string') {
    // Redact email addresses
    data = data.replace(/[\w.-]+@[\w.-]+\.\w+/g, '[EMAIL]');
    // Redact phone numbers
    data = data.replace(/\d{3}-\d{3}-\d{4}/g, '[PHONE]');
  }
  return data;
};

console.log('Processing:', sanitizeLog(userInput));
```

---

## Network Security

### Firewall Configuration

**UFW Rules:**

```bash
# Default policies
ufw default deny incoming
ufw default allow outgoing

# Allow specific ports
ufw allow 22/tcp    # SSH (consider changing port)
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS

# Allow from specific IPs (optional)
ufw allow from 203.0.113.0/24 to any port 22

# Rate limiting for SSH
ufw limit 22/tcp

# Enable
ufw --force enable

# Status
ufw status verbose
```

**Advanced iptables rules:**

```bash
# Block common attacks
iptables -A INPUT -p tcp --tcp-flags ALL NONE -j DROP
iptables -A INPUT -p tcp ! --syn -m state --state NEW -j DROP
iptables -A INPUT -p tcp --tcp-flags ALL ALL -j DROP

# Rate limit new connections
iptables -A INPUT -p tcp -m tcp --dport 80 -m state --state NEW -m recent --set
iptables -A INPUT -p tcp -m tcp --dport 80 -m state --state NEW -m recent --update --seconds 60 --hitcount 20 -j DROP

# Save rules
iptables-save > /etc/iptables/rules.v4
```

### DDoS Protection

**Cloudflare Setup (Recommended):**

1. Add site to Cloudflare
2. Enable "Under Attack Mode" if needed
3. Configure rate limiting rules
4. Enable Bot Fight Mode
5. Set security level to "Medium" or "High"

**Nginx rate limiting:**

```nginx
# In /etc/nginx/nginx.conf
http {
    # Connection rate limiting
    limit_conn_zone $binary_remote_addr zone=addr:10m;
    limit_conn addr 10;

    # Request rate limiting
    limit_req_zone $binary_remote_addr zone=one:10m rate=10r/s;
    limit_req zone=one burst=20 nodelay;

    # Response rate limiting
    limit_rate 500k;
    limit_rate_after 10m;
}
```

### VPN/Private Network (Optional)

For enhanced security, consider:
- Vultr Private Network for backend communication
- VPN for administrative access
- IP whitelisting for SSH

---

## Authentication & Authorization

### Future Implementation

**Planned authentication methods:**

1. **JWT Tokens:**
```typescript
// Future implementation
interface JWTPayload {
  user_id: string;
  email: string;
  exp: number;
}

const verifyToken = (token: string): JWTPayload => {
  // Verify JWT signature
  // Check expiration
  // Return payload
};
```

2. **API Keys:**
```typescript
// Future implementation
const verifyApiKey = async (apiKey: string): Promise<boolean> => {
  // Check API key in database
  // Verify not revoked
  // Rate limit per key
};
```

### Current Security

**No authentication required** - suitable for:
- Prototype/demo environments
- Internal use only
- Non-sensitive data

**To secure in production:**
1. Implement JWT authentication
2. Add rate limiting per user
3. Implement API key system
4. Add OAuth2 for third-party apps

---

## Security Monitoring

### Log Monitoring

**Monitor these logs:**

```bash
# Nginx access logs
tail -f /var/log/nginx/hansei-access.log

# Nginx error logs
tail -f /var/log/nginx/hansei-error.log

# System auth logs
tail -f /var/log/auth.log

# Fail2ban logs
tail -f /var/log/fail2ban.log
```

**Set up log alerts:**

```bash
# Install logwatch
apt-get install -y logwatch

# Configure daily email reports
cat > /etc/cron.daily/logwatch << 'EOF'
#!/bin/bash
/usr/sbin/logwatch --output mail --mailto your@email.com --detail high
EOF

chmod +x /etc/cron.daily/logwatch
```

### Intrusion Detection

**Install and configure rkhunter:**

```bash
# Install
apt-get install -y rkhunter

# Update database
rkhunter --update

# Run check
rkhunter --check --skip-keypress

# Schedule daily checks
cat > /etc/cron.daily/rkhunter << 'EOF'
#!/bin/bash
rkhunter --update
rkhunter --check --skip-keypress --report-warnings-only
EOF

chmod +x /etc/cron.daily/rkhunter
```

### Security Scanning

**Regular security scans:**

```bash
# Install security tools
apt-get install -y lynis

# Run system audit
lynis audit system

# Schedule weekly scans
cat > /etc/cron.weekly/security-scan << 'EOF'
#!/bin/bash
lynis audit system --quick > /var/log/lynis-$(date +%Y%m%d).log
EOF

chmod +x /etc/cron.weekly/security-scan
```

---

## Incident Response

### Incident Response Plan

**1. Detection:**
- Monitor alerts
- Check logs
- User reports

**2. Analysis:**
- Determine scope
- Identify attack vector
- Assess damage

**3. Containment:**
- Isolate affected systems
- Block malicious IPs
- Disable compromised accounts

**4. Eradication:**
- Remove malware
- Close vulnerabilities
- Update credentials

**5. Recovery:**
- Restore from backups
- Verify system integrity
- Resume normal operations

**6. Post-Incident:**
- Document incident
- Update security measures
- Conduct lessons learned

### Emergency Procedures

**If server is compromised:**

```bash
# 1. Isolate server
ufw default deny incoming
ufw default deny outgoing

# 2. Snapshot current state
tar -czf /root/forensics-$(date +%Y%m%d-%H%M).tar.gz \
  /var/log \
  /var/www/hansei \
  /etc/nginx

# 3. Check for rootkits
rkhunter --check
chkrootkit

# 4. Review recent logins
last -a
lastlog

# 5. Check running processes
ps aux | grep -v "\["
netstat -tulpn

# 6. Restore from clean backup
# (see BACKUP.md)
```

**Contact Information:**

- Security Team: security@your-domain.com
- Vultr Support: https://my.vultr.com/support/
- Raindrop Support: support@liquidmetal.ai

---

## Compliance

### GDPR Compliance

**User Rights:**
- Right to access data
- Right to deletion
- Right to data portability
- Right to be informed

**Implementation:**

```typescript
// Data deletion endpoint (future)
app.delete('/api/user/:userId', async (c) => {
  const userId = c.req.param('userId');

  // Delete all user data
  await smartMemory.deleteByUserId(userId);

  return c.json({ success: true });
});

// Data export endpoint (future)
app.get('/api/user/:userId/export', async (c) => {
  const userId = c.req.param('userId');

  // Export user data
  const data = await smartMemory.exportByUserId(userId);

  return c.json(data);
});
```

### Data Protection

**Privacy Policy Requirements:**
- Clearly state data collection practices
- Explain data usage
- Detail retention periods
- Provide contact information

**Terms of Service:**
- Define acceptable use
- Limit liability
- State governing law

---

## Security Checklist

### Pre-Deployment

- [ ] All security patches applied
- [ ] Firewall configured
- [ ] SSH hardened
- [ ] SSL/TLS configured
- [ ] Security headers enabled
- [ ] Rate limiting configured
- [ ] Fail2ban installed
- [ ] Log monitoring set up
- [ ] Backups configured
- [ ] Incident response plan documented

### Post-Deployment

- [ ] Security scan completed (lynis)
- [ ] SSL rating A+ (ssllabs.com)
- [ ] Headers verified (securityheaders.com)
- [ ] Vulnerability scan (OWASP ZAP)
- [ ] Penetration testing (if applicable)

### Ongoing

- [ ] Weekly log reviews
- [ ] Monthly security updates
- [ ] Quarterly security audits
- [ ] Annual penetration testing
- [ ] Continuous monitoring

---

## Security Resources

- OWASP Top 10: https://owasp.org/www-project-top-ten/
- CIS Benchmarks: https://www.cisecurity.org/cis-benchmarks/
- SSL Labs: https://www.ssllabs.com/ssltest/
- Security Headers: https://securityheaders.com/
- Mozilla Observatory: https://observatory.mozilla.org/

---

**Security is an ongoing process. Review and update regularly.**
