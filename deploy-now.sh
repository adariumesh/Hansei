#!/bin/bash
# HANSEI Quick Deploy Script
# Run this on your Vultr server (155.138.196.189)

set -e

echo "========================================"
echo "  HANSEI Deployment Starting..."
echo "========================================"

# Update system
echo "[1/7] Updating system packages..."
apt-get update -y
apt-get upgrade -y

# Install Nginx
echo "[2/7] Installing Nginx..."
apt-get install -y nginx

# Create directory
echo "[3/7] Creating frontend directory..."
mkdir -p /var/www/hansei
chown -R www-data:www-data /var/www/hansei

# Configure Nginx
echo "[4/7] Configuring Nginx..."
cat > /etc/nginx/sites-available/hansei << 'NGINX_EOF'
server {
    listen 80;
    listen [::]:80;
    server_name _;

    root /var/www/hansei;
    index index.html index-3d.html;

    # Enable gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/json;

    location / {
        try_files $uri $uri/ =404;
        add_header Cache-Control "public, max-age=3600";
    }

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Logs
    access_log /var/log/nginx/hansei-access.log;
    error_log /var/log/nginx/hansei-error.log;
}
NGINX_EOF

# Enable site
echo "[5/7] Enabling Nginx site..."
ln -sf /etc/nginx/sites-available/hansei /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Test and restart Nginx
echo "[6/7] Testing Nginx configuration..."
nginx -t
systemctl enable nginx
systemctl restart nginx

# Configure firewall
echo "[7/7] Configuring firewall..."
ufw --force enable
ufw allow 'Nginx Full'
ufw allow OpenSSH

echo ""
echo "========================================"
echo "  ✅ Server Setup Complete!"
echo "========================================"
echo ""
echo "Server is ready at: http://155.138.196.189"
echo "Frontend directory: /var/www/hansei"
echo ""
echo "Next: Upload frontend files with:"
echo "scp -r frontend/* root@155.138.196.189:/var/www/hansei/"
echo ""
