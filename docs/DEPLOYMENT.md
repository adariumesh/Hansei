# HANSEI - Production Deployment Guide

**Version:** 1.0.0
**Last Updated:** November 17, 2025

---

## Table of Contents

1. [Deployment Overview](#deployment-overview)
2. [Prerequisites](#prerequisites)
3. [Backend Deployment (Raindrop)](#backend-deployment)
4. [Frontend Deployment (Vultr)](#frontend-deployment)
5. [Post-Deployment Configuration](#post-deployment-configuration)
6. [SSL/TLS Setup](#ssltls-setup)
7. [Verification & Testing](#verification--testing)
8. [Rollback Procedures](#rollback-procedures)

---

## Deployment Overview

### Architecture

HANSEI uses a **hybrid deployment architecture**:

- **Backend:** Raindrop Cloud (serverless, AI-optimized)
- **Frontend:** Vultr VPS (static file serving)

### Deployment Strategy

- **Zero-downtime deployments** via Raindrop's deployment system
- **Blue-green frontend** deployments possible
- **Automated health checks** before traffic routing
- **Rollback capability** within 5 minutes

### Estimated Deployment Time

- **Backend:** 5-10 minutes
- **Frontend:** 10-15 minutes
- **SSL Configuration:** 5 minutes
- **Total:** ~30 minutes for complete deployment

---

## Prerequisites

### Required Tools

```bash
# Install Node.js (18+)
node --version  # Should be v18.0.0 or higher

# Install Raindrop CLI
npm install -g @liquidmetal-ai/raindrop

# Verify installation
raindrop --version
```

### Required Accounts

- [x] **Raindrop Account** - Sign up at https://liquidmetal.ai
- [x] **Vultr Account** - Sign up at https://vultr.com
- [x] **Domain Name** (Optional) - For custom domain

### Access Requirements

- SSH key pair for server access
- Raindrop authentication token
- Vultr API key (optional, for automation)

---

## Backend Deployment

### Step 1: Authentication

```bash
# Login to Raindrop
raindrop auth login

# Verify authentication
raindrop auth list
```

Expected output:
```
┌────────────────────────────────┬───────────────────────┐
│     organizationName          │     userEmail         │
├────────────────────────────────┼───────────────────────┤
│ "Your Organization"           │ your@email.com        │
└────────────────────────────────┴───────────────────────┘
```

### Step 2: Install Dependencies

```bash
cd /path/to/Hansei
npm install
```

Verify all dependencies are installed:
```bash
npm list --depth=0
```

### Step 3: Validate Configuration

```bash
# Validate raindrop.manifest
raindrop build validate

# Expected output: "Validation passed"
```

If validation fails, check:
- `raindrop.manifest` syntax
- Service/resource naming conflicts
- Required environment variables

### Step 4: Build & Deploy

```bash
# Build TypeScript
npm run build

# Deploy to Raindrop
raindrop build deploy --start
```

**Deployment Progress:**
```
hansei-memory-core @01ka9z9x... (6 modules)
Status: pending...
Modules (6)
  └─ agent-memory - creating...
  └─ hansei-intel-mcp - deploying...
  └─ hansei-intelligence-processor - deploying...
  └─ ... [other modules]
```

Wait for all modules to show `running` status.

### Step 5: Verify Backend Deployment

```bash
# Check deployment status
raindrop build status

# Get service URLs
raindrop build find

# Test health endpoint
curl https://YOUR_BACKEND_URL/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2025-11-17T23:00:00.000Z"
}
```

### Step 6: Note Backend URL

Save your backend URL from the deployment output:
```
hansei-intelligence-processor: https://svc-XXXXX.lmapp.run
```

You'll need this for frontend configuration.

---

## Frontend Deployment

### Step 1: Provision Vultr Server

**Via Vultr Dashboard:**

1. Login to https://my.vultr.com
2. Click **"Deploy New Server"**
3. **Configuration:**
   - **Type:** Cloud Compute - Shared CPU
   - **Location:** Choose nearest region
   - **Operating System:** Ubuntu 22.04 LTS x64
   - **Plan:** $6/month (1 vCPU, 1GB RAM, 25GB SSD)
   - **Hostname:** `hansei-frontend`
   - **SSH Keys:** Add your public key
4. Click **"Deploy Now"**
5. Wait 2-3 minutes for provisioning
6. Note the **IP address**

**Via Vultr CLI (Optional):**

```bash
# Install Vultr CLI
curl -LO https://github.com/vultr/vultr-cli/releases/latest/download/vultr-cli_linux_amd64.tar.gz
tar -xzf vultr-cli_linux_amd64.tar.gz
sudo mv vultr-cli /usr/local/bin/

# Configure API key
export VULTR_API_KEY="your-api-key"

# Deploy server
vultr-cli instance create \
  --region ewr \
  --plan vc2-1c-1gb \
  --os 387 \
  --label hansei-frontend \
  --ssh-keys "your-ssh-key-id"
```

### Step 2: Initial Server Setup

**SSH into server:**
```bash
ssh root@YOUR_SERVER_IP
```

**Update system:**
```bash
apt-get update -y
apt-get upgrade -y
apt-get install -y curl wget git nano ufw
```

**Configure firewall:**
```bash
ufw --force enable
ufw allow 22/tcp   # SSH
ufw allow 80/tcp   # HTTP
ufw allow 443/tcp  # HTTPS
ufw status verbose
```

### Step 3: Install & Configure Nginx

```bash
# Install Nginx
apt-get install -y nginx

# Verify installation
nginx -v  # Should show nginx version 1.18.0+

# Create web directory
mkdir -p /var/www/hansei
chown -R www-data:www-data /var/www/hansei
chmod -R 755 /var/www/hansei
```

**Create Nginx configuration:**

```bash
nano /etc/nginx/sites-available/hansei
```

Add this configuration:

```nginx
server {
    listen 80 default_server;
    listen [::]:80 default_server;

    root /var/www/hansei;
    index index.html index-3d.html;

    server_name YOUR_DOMAIN_OR_IP;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;

    # Main location
    location / {
        try_files $uri $uri/ =404;
        add_header Cache-Control "public, max-age=3600";
    }

    # Enable gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied expired no-cache no-store private auth;
    gzip_types text/plain text/css text/xml text/javascript
               application/x-javascript application/javascript
               application/xml+rss application/json;
    gzip_disable "MSIE [1-6]\.";

    # Logging
    access_log /var/log/nginx/hansei-access.log;
    error_log /var/log/nginx/hansei-error.log;
}
```

**Enable site:**

```bash
# Remove default site
rm -f /etc/nginx/sites-enabled/default

# Enable HANSEI site
ln -sf /etc/nginx/sites-available/hansei /etc/nginx/sites-enabled/hansei

# Test configuration
nginx -t

# Restart Nginx
systemctl restart nginx
systemctl enable nginx
```

### Step 4: Update Frontend Configuration

**On your local machine:**

```bash
cd /path/to/Hansei

# Update backend URL in frontend files
nano frontend/index.html
# Change: const API_BASE = 'https://YOUR_BACKEND_URL';

nano frontend/index-3d.html
# Change: const API_BASE = 'https://YOUR_BACKEND_URL';
```

Or use sed for automated update:

```bash
BACKEND_URL="https://svc-01ka9za29rb1k3xhtqxxe8qn20.01ka4j4ktmq3vmg0nfmg652rkw.lmapp.run"

sed -i "s|const API_BASE = '.*'|const API_BASE = '$BACKEND_URL'|g" frontend/index.html
sed -i "s|const API_BASE = '.*'|const API_BASE = '$BACKEND_URL'|g" frontend/index-3d.html
```

### Step 5: Upload Frontend Files

```bash
# Upload files via SCP
scp -r frontend/* root@YOUR_SERVER_IP:/var/www/hansei/

# Or use rsync for incremental updates
rsync -avz --progress frontend/ root@YOUR_SERVER_IP:/var/www/hansei/
```

**Verify upload:**

```bash
ssh root@YOUR_SERVER_IP "ls -lh /var/www/hansei/"
```

Expected output:
```
-rw-r--r-- 1 www-data www-data  21K index.html
-rw-r--r-- 1 www-data www-data  16K index-3d.html
```

### Step 6: Set Correct Permissions

```bash
ssh root@YOUR_SERVER_IP << 'EOF'
chown -R www-data:www-data /var/www/hansei
chmod -R 755 /var/www/hansei
find /var/www/hansei -type f -exec chmod 644 {} \;
find /var/www/hansei -type d -exec chmod 755 {} \;
EOF
```

---

## Post-Deployment Configuration

### Environment Variables

**Backend (Raindrop):**

```bash
# Set environment variables in raindrop.manifest
# Add to application block:

application "hansei-memory-core" {
  env "LOG_LEVEL" {
    default = "info"
  }

  env "MAX_UPLOAD_SIZE" {
    default = "10485760"  # 10MB
  }

  # Add secrets via CLI
  # raindrop env set API_KEY "your-secret-key" --secret
}
```

**Frontend:**

Environment variables can be set in JavaScript or via Nginx:

```nginx
# In /etc/nginx/sites-available/hansei
location / {
    # Pass custom headers
    add_header X-App-Version "1.0.0" always;
    add_header X-Environment "production" always;

    try_files $uri $uri/ =404;
}
```

### CORS Configuration

Backend CORS is already configured in `src/hansei-intelligence-processor/index.ts`:

```typescript
app.use('*', cors({
  origin: '*',  // Restrict in production
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  exposeHeaders: ['Content-Length'],
  maxAge: 600,
  credentials: true,
}));
```

**Production recommendation:**

```typescript
app.use('*', cors({
  origin: ['http://155.138.196.189', 'https://yourdomain.com'],
  // ... other settings
}));
```

### Rate Limiting

Add rate limiting to Nginx:

```nginx
# In /etc/nginx/nginx.conf (http block)
limit_req_zone $binary_remote_addr zone=hansei_limit:10m rate=10r/s;

# In /etc/nginx/sites-available/hansei (server block)
location /api/ {
    limit_req zone=hansei_limit burst=20 nodelay;
    proxy_pass https://YOUR_BACKEND_URL;
}
```

---

## SSL/TLS Setup

### Option 1: Let's Encrypt (Free, Recommended)

**Prerequisites:**
- Domain name pointed to server IP
- DNS propagation complete

**Installation:**

```bash
# Install Certbot
apt-get install -y certbot python3-certbot-nginx

# Update Nginx config with domain
nano /etc/nginx/sites-available/hansei
# Change: server_name YOUR_DOMAIN.com www.YOUR_DOMAIN.com;

# Obtain certificate
certbot --nginx -d YOUR_DOMAIN.com -d www.YOUR_DOMAIN.com

# Follow prompts:
# - Enter email address
# - Agree to terms
# - Choose: Redirect HTTP to HTTPS (option 2)
```

**Auto-renewal:**

```bash
# Test renewal
certbot renew --dry-run

# Setup cron job (already configured by default)
systemctl status certbot.timer
```

**Verify SSL:**

```bash
# Check certificate
certbot certificates

# Test SSL configuration
curl -I https://YOUR_DOMAIN.com
```

### Option 2: Cloudflare (Free SSL + CDN)

**Setup:**

1. **Add domain to Cloudflare:**
   - Go to https://dash.cloudflare.com
   - Click "Add Site"
   - Enter your domain

2. **Update nameservers:**
   - Copy Cloudflare nameservers
   - Update at your domain registrar
   - Wait for propagation (2-48 hours)

3. **Configure DNS:**
   - Add A record: `@` → `155.138.196.189`
   - Add A record: `www` → `155.138.196.189`
   - Enable proxy (orange cloud)

4. **SSL/TLS Settings:**
   - Go to SSL/TLS → Overview
   - Set mode: **Full (Strict)**
   - Enable "Always Use HTTPS"
   - Enable "Automatic HTTPS Rewrites"

5. **Performance Settings:**
   - Go to Speed → Optimization
   - Enable "Auto Minify" (HTML, CSS, JS)
   - Enable "Brotli"
   - Set caching level: Standard

### Option 3: Custom SSL Certificate

```bash
# Copy certificate files to server
scp server.crt root@YOUR_SERVER_IP:/etc/ssl/certs/hansei.crt
scp server.key root@YOUR_SERVER_IP:/etc/ssl/private/hansei.key

# Update Nginx configuration
nano /etc/nginx/sites-available/hansei
```

Add SSL configuration:

```nginx
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;

    ssl_certificate /etc/ssl/certs/hansei.crt;
    ssl_certificate_key /etc/ssl/private/hansei.key;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # ... rest of configuration
}

# Redirect HTTP to HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name YOUR_DOMAIN.com;
    return 301 https://$server_name$request_uri;
}
```

---

## Verification & Testing

### Automated Deployment Tests

Create a deployment verification script:

```bash
#!/bin/bash
# deploy-verify.sh

set -e

FRONTEND_URL="http://155.138.196.189"
BACKEND_URL="https://svc-01ka9za29rb1k3xhtqxxe8qn20.01ka4j4ktmq3vmg0nfmg652rkw.lmapp.run"

echo "🔍 Verifying HANSEI Deployment..."

# Test 1: Backend Health
echo "✓ Testing backend health..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" $BACKEND_URL/health)
if [ $HTTP_CODE -eq 200 ]; then
    echo "  ✅ Backend health check passed"
else
    echo "  ❌ Backend health check failed (HTTP $HTTP_CODE)"
    exit 1
fi

# Test 2: Frontend Accessibility
echo "✓ Testing frontend..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" $FRONTEND_URL/)
if [ $HTTP_CODE -eq 200 ]; then
    echo "  ✅ Frontend accessible"
else
    echo "  ❌ Frontend check failed (HTTP $HTTP_CODE)"
    exit 1
fi

# Test 3: Frontend Content
echo "✓ Verifying frontend content..."
if curl -s $FRONTEND_URL/ | grep -q "HANSEI"; then
    echo "  ✅ Frontend content verified"
else
    echo "  ❌ Frontend content verification failed"
    exit 1
fi

# Test 4: API Connectivity
echo "✓ Testing API connectivity..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
    -X POST $BACKEND_URL/infer \
    -H "Content-Type: application/json" \
    -d '{"content":"test","user_id":"test"}')
if [ $HTTP_CODE -eq 200 ] || [ $HTTP_CODE -eq 400 ]; then
    echo "  ✅ API endpoint accessible"
else
    echo "  ❌ API endpoint failed (HTTP $HTTP_CODE)"
    exit 1
fi

# Test 5: 3D Visualization
echo "✓ Testing 3D visualization page..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" $FRONTEND_URL/index-3d.html)
if [ $HTTP_CODE -eq 200 ]; then
    echo "  ✅ 3D visualization page accessible"
else
    echo "  ❌ 3D page check failed (HTTP $HTTP_CODE)"
    exit 1
fi

echo ""
echo "🎉 All deployment tests passed!"
echo "Frontend: $FRONTEND_URL"
echo "Backend: $BACKEND_URL"
```

**Run verification:**

```bash
chmod +x deploy-verify.sh
./deploy-verify.sh
```

### Manual Testing Checklist

- [ ] **Backend Health:** `curl BACKEND_URL/health` returns 200
- [ ] **Frontend Access:** Browser loads `http://YOUR_IP/`
- [ ] **Title Check:** Page title is "HANSEI - Voice Memory System"
- [ ] **Console Check:** No errors in browser console (F12)
- [ ] **Text Input:** Can submit text and see processing
- [ ] **Voice Record:** Microphone access works (if enabled)
- [ ] **Graph Display:** 2D graph renders correctly
- [ ] **3D Visualization:** `http://YOUR_IP/index-3d.html` works
- [ ] **API Calls:** Network tab shows successful API requests
- [ ] **CORS:** No CORS errors in console
- [ ] **Mobile:** Site works on mobile devices
- [ ] **SSL (if configured):** HTTPS works without warnings

### Performance Testing

```bash
# Test page load time
curl -w "@curl-format.txt" -o /dev/null -s http://YOUR_IP/

# Create curl-format.txt:
cat > curl-format.txt << 'EOF'
    time_namelookup:  %{time_namelookup}s\n
       time_connect:  %{time_connect}s\n
    time_appconnect:  %{time_appconnect}s\n
   time_pretransfer:  %{time_pretransfer}s\n
      time_redirect:  %{time_redirect}s\n
 time_starttransfer:  %{time_starttransfer}s\n
                    ----------\n
         time_total:  %{time_total}s\n
EOF

# Load testing with Apache Bench
apt-get install -y apache2-utils
ab -n 100 -c 10 http://YOUR_IP/

# Or use wrk
apt-get install -y wrk
wrk -t12 -c400 -d30s http://YOUR_IP/
```

---

## Rollback Procedures

### Backend Rollback

```bash
# View deployment history
raindrop build list

# Rollback to previous version
raindrop build rollback --to VERSION_ID

# Or stop current deployment
raindrop build stop

# Redeploy known good version
git checkout PREVIOUS_COMMIT
raindrop build deploy --start
```

### Frontend Rollback

**Option 1: Keep backups**

```bash
# Before deployment, create backup
ssh root@YOUR_SERVER_IP "tar -czf /root/hansei-backup-$(date +%Y%m%d-%H%M).tar.gz /var/www/hansei"

# Rollback
ssh root@YOUR_SERVER_IP << 'EOF'
cd /root
LATEST_BACKUP=$(ls -t hansei-backup-*.tar.gz | head -1)
tar -xzf $LATEST_BACKUP -C /
systemctl reload nginx
EOF
```

**Option 2: Git-based deployment**

```bash
# On server, keep git repo
ssh root@YOUR_SERVER_IP << 'EOF'
cd /var/www/hansei-git
git pull origin production
cp -r frontend/* /var/www/hansei/
systemctl reload nginx
EOF

# Rollback
ssh root@YOUR_SERVER_IP << 'EOF'
cd /var/www/hansei-git
git checkout PREVIOUS_COMMIT
cp -r frontend/* /var/www/hansei/
systemctl reload nginx
EOF
```

### Emergency Procedures

**Complete service outage:**

```bash
# 1. Check backend status
raindrop build status

# 2. Check frontend server
ssh root@YOUR_SERVER_IP "systemctl status nginx"

# 3. Check logs
raindrop logs tail -f
ssh root@YOUR_SERVER_IP "tail -f /var/log/nginx/error.log"

# 4. Restart services
raindrop build restart
ssh root@YOUR_SERVER_IP "systemctl restart nginx"

# 5. If still down, deploy maintenance page
ssh root@YOUR_SERVER_IP << 'EOF'
cat > /var/www/hansei/index.html << 'HTML'
<!DOCTYPE html>
<html><head><title>Maintenance</title></head>
<body><h1>Under Maintenance</h1><p>We'll be back shortly.</p></body>
</html>
HTML
EOF
```

---

## Deployment Checklist

### Pre-Deployment

- [ ] All tests passing locally
- [ ] Dependencies updated and locked
- [ ] Environment variables configured
- [ ] Database migrations ready (if any)
- [ ] Backup of current production
- [ ] Rollback plan documented
- [ ] Team notified of deployment window

### During Deployment

- [ ] Backend deployed successfully
- [ ] Backend health check passes
- [ ] Frontend files uploaded
- [ ] Nginx configuration updated
- [ ] Nginx reloaded without errors
- [ ] Frontend accessible
- [ ] API connectivity verified
- [ ] No errors in logs

### Post-Deployment

- [ ] All automated tests passing
- [ ] Manual smoke tests completed
- [ ] Performance metrics normal
- [ ] Error rates normal
- [ ] Monitoring alerts configured
- [ ] Documentation updated
- [ ] Team notified of completion
- [ ] Deployment tagged in git

---

## Monitoring Post-Deployment

```bash
# Watch logs in real-time
raindrop logs tail -f

# Monitor Nginx access logs
ssh root@YOUR_SERVER_IP "tail -f /var/log/nginx/hansei-access.log"

# Monitor error logs
ssh root@YOUR_SERVER_IP "tail -f /var/log/nginx/hansei-error.log"

# Check system resources
ssh root@YOUR_SERVER_IP "htop"

# Monitor network
ssh root@YOUR_SERVER_IP "iftop -i eth0"
```

---

## Cost Estimation

### Monthly Operating Costs

| Service | Cost | Notes |
|---------|------|-------|
| Vultr VPS (1GB) | $6.00 | Frontend hosting |
| Raindrop Cloud | $0-50 | Free tier available, pay-as-you-grow |
| Domain Name | $1.00 | ~$12/year |
| SSL Certificate | $0.00 | Let's Encrypt (free) |
| **Total** | **~$7-57/month** | Scales with usage |

### Scaling Costs

- **10K users/month:** ~$15/month
- **100K users/month:** ~$75/month
- **1M users/month:** ~$300/month

---

## Next Steps

- Configure [Monitoring](./MONITORING.md)
- Set up [Backups](./BACKUP.md)
- Review [Security Guide](./SECURITY.md)
- Implement [Performance Tuning](./PERFORMANCE.md)

---

**Deployment complete!** 🎉

For issues, see [Troubleshooting Guide](./TROUBLESHOOTING.md)
