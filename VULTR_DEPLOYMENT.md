# HANSEI - Vultr Deployment Guide

## Architecture Overview

**Backend (Raindrop Cloud):**
- URL: `https://svc-01ka9za29rb1k3xhtqxxe8qn20.01ka4j4ktmq3vmg0nfmg652rkw.lmapp.run`
- Status: ✅ Deployed & Running
- Provides: AI transcription, entity extraction, semantic memory

**Frontend (Vultr VPS):**
- Static HTML/CSS/JS files
- Served via Nginx
- Connects to backend API

---

## Step-by-Step Deployment

### STEP 1: Create Vultr Server

1. **Login to Vultr:** https://my.vultr.com/
2. **Deploy New Server:**
   - **Type:** Cloud Compute - Shared CPU
   - **Location:** Choose nearest location
   - **OS:** Ubuntu 22.04 LTS x64
   - **Plan:** $6/month (1 CPU, 1GB RAM)
   - **Hostname:** `hansei-frontend`
   - Click **Deploy Now**

3. **Get Server Credentials:**
   - IP Address: `YOUR_SERVER_IP`
   - Username: `root`
   - Password: (provided in dashboard)

---

### STEP 2: Connect to Your Server

**Using SSH:**

```bash
ssh root@YOUR_SERVER_IP
# Enter password when prompted
```

**Using PuTTY (Windows):**
- Host: YOUR_SERVER_IP
- Port: 22
- Connection Type: SSH

---

### STEP 3: Run Deployment Script

**On your Vultr server, run:**

```bash
# Download and run the deployment script
curl -sL https://raw.githubusercontent.com/YOUR_REPO/deploy-to-vultr.sh | bash
```

**OR manually copy the script:**

```bash
# Create the script file
nano /root/deploy.sh

# Paste the contents from deploy-to-vultr.sh
# Save with Ctrl+X, then Y, then Enter

# Make it executable
chmod +x /root/deploy.sh

# Run it
./deploy.sh
```

This script will:
- Update system packages
- Install Nginx web server
- Create frontend directory at `/var/www/hansei`
- Configure Nginx with optimization
- Enable firewall rules
- Start Nginx service

---

### STEP 4: Upload Frontend Files

**From your local machine (NOT on the server):**

```bash
# Navigate to your project directory
cd /mnt/c/Users/srini/Desktop/Stuff/Hansei/Hansei

# Upload frontend files to Vultr
scp -r frontend/* root@YOUR_SERVER_IP:/var/www/hansei/

# Enter password when prompted
```

**Verify upload on server:**

```bash
# SSH into server
ssh root@YOUR_SERVER_IP

# Check files
ls -la /var/www/hansei/
# You should see: index.html, index-3d.html
```

---

### STEP 5: Test Deployment

**Open your browser and navigate to:**

```
http://YOUR_SERVER_IP/
```

You should see the HANSEI interface!

**Test 3D visualization:**

```
http://YOUR_SERVER_IP/index-3d.html
```

---

## Optional: Configure Custom Domain & SSL

### Option A: Using Certbot (Let's Encrypt - FREE)

1. **Update DNS records:**
   - Add A record: `hansei.yourdomain.com` → `YOUR_SERVER_IP`

2. **Install Certbot:**

```bash
apt-get install -y certbot python3-certbot-nginx
```

3. **Update Nginx config:**

```bash
nano /etc/nginx/sites-available/hansei
# Change: server_name _;
# To:     server_name hansei.yourdomain.com;
```

4. **Get SSL certificate:**

```bash
certbot --nginx -d hansei.yourdomain.com
# Follow prompts, choose option 2 (redirect HTTP to HTTPS)
```

5. **Auto-renewal:**

```bash
certbot renew --dry-run
```

### Option B: Using Cloudflare (FREE SSL + CDN)

1. **Add domain to Cloudflare:** https://dash.cloudflare.com/
2. **Update nameservers** as instructed
3. **Add DNS record:**
   - Type: A
   - Name: hansei (or @)
   - Content: YOUR_SERVER_IP
   - Proxy status: Proxied (orange cloud)
4. **SSL/TLS Settings:**
   - Mode: Full (Strict)
   - Enable Always Use HTTPS

---

## Maintenance Commands

### Check Nginx Status

```bash
systemctl status nginx
```

### Restart Nginx

```bash
systemctl restart nginx
```

### View Logs

```bash
# Access logs
tail -f /var/log/nginx/hansei-access.log

# Error logs
tail -f /var/log/nginx/hansei-error.log
```

### Update Frontend Files

```bash
# From your local machine
scp -r frontend/* root@YOUR_SERVER_IP:/var/www/hansei/
```

### Monitor Server Resources

```bash
# CPU/Memory usage
htop

# Disk usage
df -h

# Network usage
iftop
```

---

## Troubleshooting

### Issue: "Connection Refused"

**Fix:**
```bash
systemctl start nginx
ufw allow 80/tcp
ufw allow 443/tcp
```

### Issue: "404 Not Found"

**Fix:**
```bash
# Check file permissions
chown -R www-data:www-data /var/www/hansei
chmod -R 755 /var/www/hansei

# Verify files exist
ls -la /var/www/hansei/
```

### Issue: "API calls failing"

**Fix:**
1. Check browser console for CORS errors
2. Verify backend URL in frontend files
3. Test backend directly:
   ```bash
   curl https://svc-01ka9za29rb1k3xhtqxxe8qn20.01ka4j4ktmq3vmg0nfmg652rkw.lmapp.run/health
   ```

### Issue: "502 Bad Gateway"

**Fix:**
```bash
# Check Nginx configuration
nginx -t

# Restart Nginx
systemctl restart nginx

# Check logs
tail -f /var/log/nginx/hansei-error.log
```

---

## Security Best Practices

1. **Disable root login:**
```bash
# Create new user
adduser hansei
usermod -aG sudo hansei

# Disable root SSH
nano /etc/ssh/sshd_config
# Set: PermitRootLogin no
systemctl restart sshd
```

2. **Set up SSH keys** (instead of passwords)

3. **Enable automatic updates:**
```bash
apt-get install unattended-upgrades
dpkg-reconfigure -plow unattended-upgrades
```

4. **Install fail2ban:**
```bash
apt-get install fail2ban
systemctl enable fail2ban
```

---

## Performance Optimization

### Enable HTTP/2

```bash
# Edit Nginx config
nano /etc/nginx/sites-available/hansei

# Change:
listen 443 ssl;
# To:
listen 443 ssl http2;
```

### Enable Brotli Compression

```bash
apt-get install -y nginx-module-brotli
# Add to Nginx config
brotli on;
brotli_comp_level 6;
brotli_types text/plain text/css application/json;
```

### Add CDN Caching Headers

```bash
# Already included in deployment script
add_header Cache-Control "public, max-age=3600";
```

---

## Monitoring & Analytics

### Install Netdata (Real-time monitoring)

```bash
bash <(curl -Ss https://my-netdata.io/kickstart.sh)
# Access at: http://YOUR_SERVER_IP:19999
```

### Add Google Analytics

Edit `frontend/index.html` and `frontend/index-3d.html`:

```html
<!-- Add before </head> -->
<script async src="https://www.googletagmanager.com/gtag/js?id=GA_MEASUREMENT_ID"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'GA_MEASUREMENT_ID');
</script>
```

---

## Backup Strategy

### Manual Backup

```bash
# Backup frontend files
tar -czf hansei-backup-$(date +%Y%m%d).tar.gz /var/www/hansei

# Download to local machine
scp root@YOUR_SERVER_IP:/root/hansei-backup-*.tar.gz ./
```

### Automated Backups (Cron)

```bash
# Create backup script
cat > /root/backup-hansei.sh << 'EOF'
#!/bin/bash
tar -czf /root/backups/hansei-$(date +%Y%m%d).tar.gz /var/www/hansei
find /root/backups -name "hansei-*.tar.gz" -mtime +7 -delete
EOF

chmod +x /root/backup-hansei.sh
mkdir -p /root/backups

# Add to cron (daily at 2 AM)
crontab -e
# Add: 0 2 * * * /root/backup-hansei.sh
```

---

## Cost Breakdown

- **Vultr VPS:** $6/month (shared CPU, 1GB RAM)
- **Raindrop Backend:** FREE tier available, check limits
- **Domain (optional):** $12/year
- **SSL (Let's Encrypt):** FREE

**Total:** ~$6-7/month

---

## Next Steps

1. ✅ Test the application thoroughly
2. ✅ Set up custom domain (optional)
3. ✅ Enable SSL/HTTPS (recommended)
4. ✅ Configure backups
5. ✅ Set up monitoring
6. ✅ Share with users!

---

## Support & Documentation

- **Raindrop Docs:** https://docs.liquidmetal.ai
- **Vultr Support:** https://my.vultr.com/support/
- **Nginx Docs:** https://nginx.org/en/docs/

---

**Deployment Date:** November 17, 2025
**Backend URL:** https://svc-01ka9za29rb1k3xhtqxxe8qn20.01ka4j4ktmq3vmg0nfmg652rkw.lmapp.run
**Frontend:** Deploy to YOUR_SERVER_IP
