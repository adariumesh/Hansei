# HANSEI - Quick Deployment Reference

## 🚀 Quick Deploy (TL;DR)

### Backend (Already Done ✅)
```bash
✅ Deployed to Raindrop Cloud
✅ URL: https://svc-01ka9za29rb1k3xhtqxxe8qn20.01ka4j4ktmq3vmg0nfmg652rkw.lmapp.run
```

### Frontend (Your Turn 👇)

**1. Create Vultr Server**
- Type: Ubuntu 22.04 LTS
- Size: $6/month (1GB RAM)
- Note your IP address

**2. SSH Into Server**
```bash
ssh root@YOUR_SERVER_IP
```

**3. Run Setup Script**
```bash
# Update system
apt-get update -y && apt-get upgrade -y

# Install Nginx
apt-get install -y nginx

# Create directory
mkdir -p /var/www/hansei
chown -R www-data:www-data /var/www/hansei

# Configure Nginx
cat > /etc/nginx/sites-available/hansei << 'EOF'
server {
    listen 80;
    server_name _;
    root /var/www/hansei;
    index index.html;

    location / {
        try_files $uri $uri/ =404;
    }
}
EOF

ln -sf /etc/nginx/sites-available/hansei /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
systemctl restart nginx

# Configure firewall
ufw --force enable
ufw allow 'Nginx Full'
ufw allow OpenSSH
```

**4. Upload Files (From Your Local Machine)**
```bash
cd /mnt/c/Users/srini/Desktop/Stuff/Hansei/Hansei
scp -r frontend/* root@YOUR_SERVER_IP:/var/www/hansei/
```

**5. Test**
```
http://YOUR_SERVER_IP/
```

---

## 📋 Essential Commands

### On Vultr Server

```bash
# Check Nginx status
systemctl status nginx

# Restart Nginx
systemctl restart nginx

# View logs
tail -f /var/log/nginx/hansei-access.log
tail -f /var/log/nginx/hansei-error.log

# Update files
# (run from local machine)
scp -r frontend/* root@YOUR_SERVER_IP:/var/www/hansei/
```

### On Local Machine (Raindrop Backend)

```bash
# Check status
raindrop build status

# View logs
raindrop logs tail -f

# Redeploy backend
raindrop build deploy --start
```

---

## 🔒 Optional: Add SSL (FREE)

```bash
# Install Certbot
apt-get install -y certbot python3-certbot-nginx

# Get certificate (after setting up domain DNS)
certbot --nginx -d yourdomain.com

# Auto-renew is set up automatically
```

---

## 🐛 Quick Troubleshooting

| Issue | Fix |
|-------|-----|
| Can't access site | `systemctl restart nginx` |
| 404 Not Found | Check files: `ls /var/www/hansei/` |
| API errors | Test backend: `curl BACKEND_URL/health` |
| Permission errors | `chown -R www-data:www-data /var/www/hansei` |

---

## 📊 What You Have Now

✅ **Backend:** Raindrop Cloud (AI-powered, scalable)
✅ **Frontend:** Vultr VPS (fast, reliable)
✅ **Cost:** ~$6/month
✅ **Features:** Voice recording, transcription, entity extraction, 3D visualization

---

## 📞 Need Help?

- Full guide: See `VULTR_DEPLOYMENT.md`
- Raindrop docs: https://docs.liquidmetal.ai
- Vultr support: https://my.vultr.com/support/
