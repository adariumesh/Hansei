# HANSEI - Troubleshooting Guide

**Version:** 1.0.0
**Last Updated:** November 17, 2025

---

## Table of Contents

1. [Quick Diagnostics](#quick-diagnostics)
2. [Backend Issues](#backend-issues)
3. [Frontend Issues](#frontend-issues)
4. [Network Issues](#network-issues)
5. [Performance Issues](#performance-issues)
6. [Error Messages](#error-messages)
7. [Recovery Procedures](#recovery-procedures)

---

## Quick Diagnostics

### Health Check Script

Run this comprehensive health check first:

```bash
#!/bin/bash
# hansei-health-check.sh

echo "===================================="
echo "  HANSEI Health Check"
echo "===================================="
echo ""

BACKEND_URL="https://svc-01ka9za29rb1k3xhtqxxe8qn20.01ka4j4ktmq3vmg0nfmg652rkw.lmapp.run"
FRONTEND_IP="155.138.196.189"

# 1. Backend Health
echo "[1/8] Checking backend..."
if curl -sf $BACKEND_URL/health > /dev/null; then
    echo "  ✅ Backend healthy"
else
    echo "  ❌ Backend DOWN"
fi

# 2. Frontend Accessibility
echo "[2/8] Checking frontend..."
if curl -sf http://$FRONTEND_IP/ | grep -q "HANSEI"; then
    echo "  ✅ Frontend accessible"
else
    echo "  ❌ Frontend issue detected"
fi

# 3. Nginx Status
echo "[3/8] Checking Nginx..."
if systemctl is-active --quiet nginx; then
    echo "  ✅ Nginx running"
else
    echo "  ❌ Nginx not running"
fi

# 4. Disk Space
echo "[4/8] Checking disk space..."
DISK_USAGE=$(df / | tail -1 | awk '{print $5}' | sed 's/%//')
if [ $DISK_USAGE -lt 85 ]; then
    echo "  ✅ Disk usage: ${DISK_USAGE}%"
else
    echo "  ⚠️  High disk usage: ${DISK_USAGE}%"
fi

# 5. Memory
echo "[5/8] Checking memory..."
MEM_USAGE=$(free | grep Mem | awk '{printf "%.0f", $3/$2 * 100}')
if [ $MEM_USAGE -lt 90 ]; then
    echo "  ✅ Memory usage: ${MEM_USAGE}%"
else
    echo "  ⚠️  High memory usage: ${MEM_USAGE}%"
fi

# 6. CPU
echo "[6/8] Checking CPU..."
CPU_USAGE=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1)
echo "  ℹ️  CPU usage: ${CPU_USAGE}%"

# 7. Firewall
echo "[7/8] Checking firewall..."
if ufw status | grep -q "Status: active"; then
    echo "  ✅ Firewall active"
    if ufw status | grep -q "80.*ALLOW"; then
        echo "  ✅ Port 80 open"
    else
        echo "  ❌ Port 80 not open"
    fi
else
    echo "  ❌ Firewall inactive"
fi

# 8. Recent Errors
echo "[8/8] Checking recent errors..."
ERROR_COUNT=$(tail -100 /var/log/nginx/hansei-error.log 2>/dev/null | wc -l)
if [ $ERROR_COUNT -lt 10 ]; then
    echo "  ✅ Error count: $ERROR_COUNT"
else
    echo "  ⚠️  Error count: $ERROR_COUNT"
fi

echo ""
echo "===================================="
echo "Health check complete!"
echo "===================================="
```

Save as `/root/hansei-health-check.sh` and run:

```bash
chmod +x /root/hansei-health-check.sh
/root/hansei-health-check.sh
```

---

## Backend Issues

### Backend Not Responding

**Symptoms:**
- API calls timeout
- `/health` endpoint returns error
- No response from backend URL

**Diagnosis:**

```bash
# Check Raindrop deployment status
raindrop build status

# View recent logs
raindrop logs tail -f

# Check for errors
raindrop logs query --level error --since 1h
```

**Solutions:**

1. **Restart backend:**
   ```bash
   raindrop build restart
   ```

2. **Redeploy:**
   ```bash
   raindrop build deploy --start
   ```

3. **Check Raindrop service status:**
   ```bash
   raindrop build list
   ```

4. **Verify environment:**
   ```bash
   raindrop env list
   ```

### API Endpoints Returning Errors

**Symptoms:**
- 500 Internal Server Error
- 502 Bad Gateway
- 422 Unprocessable Entity

**Diagnosis:**

```bash
# Test each endpoint
curl -X GET https://svc-01ka9za29rb1k3xhtqxxe8qn20.01ka4j4ktmq3vmg0nfmg652rkw.lmapp.run/health

curl -X POST https://svc-01ka9za29rb1k3xhtqxxe8qn20.01ka4j4ktmq3vmg0nfmg652rkw.lmapp.run/infer \
    -H "Content-Type: application/json" \
    -d '{"content":"test","user_id":"test"}'

# Check logs for specific error
raindrop logs query --grep "error" --since 5m
```

**Solutions:**

1. **Check request format:**
   - Ensure JSON is valid
   - Required fields are present
   - Content length < 10,000 characters

2. **Check AI model availability:**
   ```bash
   raindrop logs query --grep "whisper\|llama" --since 1h
   ```

3. **Verify SmartMemory:**
   ```bash
   raindrop build find
   # Look for agent-memory status
   ```

### Slow API Response

**Symptoms:**
- Requests taking > 5 seconds
- Timeouts

**Diagnosis:**

```bash
# Measure response time
time curl -X POST https://svc-01ka9za29rb1k3xhtqxxe8qn20.01ka4j4ktmq3vmg0nfmg652rkw.lmapp.run/infer \
    -H "Content-Type: application/json" \
    -d '{"content":"test","user_id":"test"}'

# Check backend metrics
raindrop logs query --since 5m
```

**Solutions:**

1. **Check AI model performance:**
   - LLaMA 3.3 70B typically takes 2-4s
   - Whisper typically takes 1-2s

2. **Optimize request size:**
   - Reduce content length
   - Batch requests if possible

3. **Check Raindrop status:**
   ```bash
   raindrop build status
   ```

---

## Frontend Issues

### Website Not Loading

**Symptoms:**
- Browser shows "Connection refused"
- Timeout errors
- Blank page

**Diagnosis:**

```bash
# Check if Nginx is running
systemctl status nginx

# Test locally
curl -I http://localhost/

# Test externally
curl -I http://155.138.196.189/

# Check firewall
ufw status

# Check port 80
ss -tlnp | grep :80
```

**Solutions:**

1. **Start Nginx:**
   ```bash
   systemctl start nginx
   systemctl enable nginx
   ```

2. **Check Nginx configuration:**
   ```bash
   nginx -t
   systemctl reload nginx
   ```

3. **Open firewall:**
   ```bash
   ufw allow 80/tcp
   ufw allow 443/tcp
   ufw status
   ```

4. **Check Vultr firewall:**
   - Login to Vultr dashboard
   - Check firewall/security groups
   - Ensure ports 80, 443 are allowed

### Showing Default Nginx Page

**Symptoms:**
- "Welcome to nginx!" instead of HANSEI
- Wrong content displayed

**Diagnosis:**

```bash
# Check enabled sites
ls -la /etc/nginx/sites-enabled/

# Check what Nginx is serving
curl http://localhost/ | head -20

# Verify files exist
ls -lh /var/www/hansei/
```

**Solutions:**

1. **Check Nginx configuration:**
   ```bash
   cat /etc/nginx/sites-enabled/hansei
   ```

   Should show:
   ```nginx
   root /var/www/hansei;
   ```

2. **Fix configuration:**
   ```bash
   # Remove default site
   rm -f /etc/nginx/sites-enabled/default

   # Ensure hansei is enabled
   ln -sf /etc/nginx/sites-available/hansei /etc/nginx/sites-enabled/hansei

   # Test and reload
   nginx -t
   systemctl reload nginx
   ```

3. **Verify files:**
   ```bash
   ls -lh /var/www/hansei/
   # Should show index.html and index-3d.html
   ```

### 404 Not Found Errors

**Symptoms:**
- All pages return 404
- Only index.html works

**Diagnosis:**

```bash
# Check file permissions
ls -lah /var/www/hansei/

# Check Nginx error log
tail -50 /var/log/nginx/hansei-error.log

# Test specific file
curl -I http://localhost/index-3d.html
```

**Solutions:**

1. **Fix permissions:**
   ```bash
   chown -R www-data:www-data /var/www/hansei
   chmod -R 755 /var/www/hansei
   find /var/www/hansei -type f -exec chmod 644 {} \;
   ```

2. **Check file exists:**
   ```bash
   ls /var/www/hansei/index-3d.html
   ```

3. **Verify Nginx config:**
   ```nginx
   location / {
       try_files $uri $uri/ =404;
   }
   ```

### Frontend-Backend Connection Issues

**Symptoms:**
- Frontend loads but no data
- Console errors about CORS or network
- API calls failing

**Diagnosis:**

```bash
# Check browser console (F12)
# Look for errors like:
# - CORS policy blocked
# - Failed to fetch
# - Network error
```

**Solutions:**

1. **Verify backend URL in frontend:**
   ```bash
   grep "API_BASE" /var/www/hansei/index.html
   # Should show: const API_BASE = 'https://svc-...lmapp.run';
   ```

2. **Update if wrong:**
   ```bash
   BACKEND_URL="https://svc-01ka9za29rb1k3xhtqxxe8qn20.01ka4j4ktmq3vmg0nfmg652rkw.lmapp.run"

   sed -i "s|const API_BASE = '.*'|const API_BASE = '$BACKEND_URL'|g" /var/www/hansei/index.html
   sed -i "s|const API_BASE = '.*'|const API_BASE = '$BACKEND_URL'|g" /var/www/hansei/index-3d.html
   ```

3. **Test backend from frontend server:**
   ```bash
   curl https://svc-01ka9za29rb1k3xhtqxxe8qn20.01ka4j4ktmq3vmg0nfmg652rkw.lmapp.run/health
   ```

---

## Network Issues

### Cannot Access Website Externally

**Symptoms:**
- Works with `curl http://localhost/`
- Doesn't work from browser
- Connection timeout from external IP

**Diagnosis:**

```bash
# Test local access
curl -I http://localhost/

# Test loopback
curl -I http://127.0.0.1/

# Test server IP
curl -I http://155.138.196.189/

# Check if port is listening
ss -tlnp | grep :80

# Check firewall
ufw status numbered
```

**Solutions:**

1. **Ensure Nginx listens on all interfaces:**
   ```nginx
   # Should have:
   listen 80;
   listen [::]:80;

   # NOT:
   listen 127.0.0.1:80;
   ```

2. **Open firewall:**
   ```bash
   ufw allow 80/tcp
   ufw allow 443/tcp
   ufw reload
   ```

3. **Check Vultr firewall:**
   - Vultr Dashboard → Server → Firewall
   - Ensure HTTP (80) and HTTPS (443) are allowed

### SSL/TLS Issues

**Symptoms:**
- "Your connection is not private"
- Certificate errors
- Mixed content warnings

**Diagnosis:**

```bash
# Check certificate
openssl s_client -connect your-domain.com:443 -servername your-domain.com

# Check certificate expiry
certbot certificates

# Test SSL configuration
curl -I https://your-domain.com
```

**Solutions:**

1. **Renew certificate:**
   ```bash
   certbot renew
   systemctl reload nginx
   ```

2. **Fix mixed content:**
   - Ensure all resources load via HTTPS
   - Update API_BASE to use HTTPS

3. **Test SSL rating:**
   ```bash
   # Visit: https://www.ssllabs.com/ssltest/
   # Enter your domain
   ```

---

## Performance Issues

### High CPU Usage

**Diagnosis:**

```bash
# Find CPU-intensive processes
top -bn1 | head -20

# Nginx workers
ps aux | grep nginx | grep -v grep

# Check load average
uptime
```

**Solutions:**

1. **Check for DDoS:**
   ```bash
   # Count connections per IP
   netstat -ntu | awk '{print $5}' | cut -d: -f1 | sort | uniq -c | sort -n

   # Block suspicious IPs
   ufw deny from 192.0.2.1
   ```

2. **Optimize Nginx workers:**
   ```nginx
   # /etc/nginx/nginx.conf
   worker_processes auto;
   worker_connections 1024;
   ```

3. **Enable caching:**
   ```nginx
   # Add to server block
   location ~* \.(jpg|jpeg|png|gif|ico|css|js)$ {
       expires 1y;
       add_header Cache-Control "public, immutable";
   }
   ```

### High Memory Usage

**Diagnosis:**

```bash
# Check memory usage
free -h

# Find memory hogs
ps aux --sort=-%mem | head -10

# Check for memory leaks
ps -eo pid,ppid,cmd,%mem,%cpu --sort=-%mem | head -20
```

**Solutions:**

1. **Restart Nginx:**
   ```bash
   systemctl restart nginx
   ```

2. **Clear cache:**
   ```bash
   sync; echo 3 > /proc/sys/vm/drop_caches
   ```

3. **Check for runaway processes:**
   ```bash
   kill -9 PID_OF_PROBLEM_PROCESS
   ```

### Slow Page Load

**Diagnosis:**

```bash
# Measure load time
curl -w "\nTotal: %{time_total}s\nDNS: %{time_namelookup}s\nConnect: %{time_connect}s\nTransfer: %{time_starttransfer}s\n" \
    -o /dev/null -s http://155.138.196.189/

# Check backend response time
curl -w "\nTime: %{time_total}s\n" \
    -o /dev/null -s \
    https://svc-01ka9za29rb1k3xhtqxxe8qn20.01ka4j4ktmq3vmg0nfmg652rkw.lmapp.run/health
```

**Solutions:**

1. **Enable gzip:**
   ```nginx
   gzip on;
   gzip_types text/plain text/css text/javascript application/json;
   ```

2. **Add caching headers:**
   ```nginx
   add_header Cache-Control "public, max-age=3600";
   ```

3. **Use CDN (Cloudflare):**
   - Proxy traffic through Cloudflare
   - Enable auto-minify
   - Enable Brotli compression

---

## Error Messages

### "Connection Refused"

**Cause:** Service not running or firewall blocking

**Solution:**
```bash
systemctl start nginx
ufw allow 80/tcp
```

### "502 Bad Gateway"

**Cause:** Backend service down or misconfigured

**Solution:**
```bash
# Check backend
raindrop build status

# Check Nginx config
nginx -t
systemctl reload nginx
```

### "CORS Policy Blocked"

**Cause:** Frontend domain not allowed by backend

**Solution:**
- Check browser console for exact error
- Verify CORS configuration in backend
- Ensure frontend URL is in allowed origins

### "Failed to Fetch"

**Cause:** Network issue or wrong backend URL

**Solution:**
```bash
# Verify backend URL in frontend
grep "API_BASE" /var/www/hansei/index.html

# Test backend connectivity
curl https://svc-01ka9za29rb1k3xhtqxxe8qn20.01ka4j4ktmq3vmg0nfmg652rkw.lmapp.run/health
```

---

## Recovery Procedures

### Complete System Failure

**Emergency Recovery Steps:**

1. **Check server status:**
   ```bash
   # Login via Vultr console if SSH fails
   # Or via Vultr dashboard: View Console
   ```

2. **Check system logs:**
   ```bash
   journalctl -xe
   dmesg | tail -50
   ```

3. **Restart services:**
   ```bash
   systemctl restart nginx
   systemctl restart ufw
   ```

4. **Restore from backup:**
   ```bash
   # See BACKUP.md for detailed instructions
   cd /root/backups
   tar -xzf latest-backup.tar.gz -C /
   systemctl restart nginx
   ```

### Database Corruption (SmartMemory)

**Symptoms:**
- Graph queries return no data
- Entity extraction fails to save

**Solution:**
```bash
# Backend handles this automatically
# SmartMemory is resilient to corruption

# If needed, check Raindrop status
raindrop build status

# View SmartMemory logs
raindrop logs query --grep "smartmemory" --since 1h
```

### Lost Root Access

**Recovery:**

1. **Use Vultr console:**
   - Login to Vultr dashboard
   - Click on server → View Console
   - Login with root password

2. **Reset password:**
   ```bash
   # Via console
   passwd root
   ```

3. **Re-add SSH key:**
   ```bash
   mkdir -p /root/.ssh
   echo "YOUR_PUBLIC_KEY" > /root/.ssh/authorized_keys
   chmod 700 /root/.ssh
   chmod 600 /root/.ssh/authorized_keys
   ```

---

## Getting Additional Help

### Collect Diagnostic Information

Before asking for help, collect this information:

```bash
#!/bin/bash
# collect-diagnostics.sh

OUTPUT="/root/hansei-diagnostics-$(date +%Y%m%d-%H%M).txt"

{
    echo "=== HANSEI Diagnostics ==="
    echo "Date: $(date)"
    echo ""

    echo "=== System Info ==="
    uname -a
    lsb_release -a
    echo ""

    echo "=== Nginx Status ==="
    systemctl status nginx
    echo ""

    echo "=== Nginx Config Test ==="
    nginx -t
    echo ""

    echo "=== Enabled Sites ==="
    ls -la /etc/nginx/sites-enabled/
    echo ""

    echo "=== Frontend Files ==="
    ls -lh /var/www/hansei/
    echo ""

    echo "=== Recent Nginx Errors ==="
    tail -50 /var/log/nginx/hansei-error.log
    echo ""

    echo "=== Firewall Status ==="
    ufw status verbose
    echo ""

    echo "=== Network Ports ==="
    ss -tlnp
    echo ""

    echo "=== Disk Usage ==="
    df -h
    echo ""

    echo "=== Memory Usage ==="
    free -h
    echo ""

    echo "=== CPU Load ==="
    uptime
    echo ""

    echo "=== Backend Health ==="
    curl -I https://svc-01ka9za29rb1k3xhtqxxe8qn20.01ka4j4ktmq3vmg0nfmg652rkw.lmapp.run/health 2>&1
    echo ""

} > "$OUTPUT"

echo "Diagnostics saved to: $OUTPUT"
cat "$OUTPUT"
```

### Support Channels

- **Documentation:** `/docs` directory
- **GitHub Issues:** https://github.com/your-repo/issues
- **Email Support:** support@your-domain.com
- **Raindrop Support:** https://docs.liquidmetal.ai
- **Vultr Support:** https://my.vultr.com/support/

---

**Remember:** Most issues can be resolved by restarting services or checking logs. Always check logs first!
