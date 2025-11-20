#!/bin/bash
# HANSEI Unified Deployment Script
# Optimized deployment for Vultr server (155.138.196.189)

set -e  # Exit on error

# Color codes for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo "========================================"
echo "  HANSEI Deployment Starting..."
echo "========================================"

# Configuration
FRONTEND_DIR="/var/www/hansei"
NGINX_CONF="/etc/nginx/sites-available/hansei"
SERVER_IP="155.138.196.189"

echo -e "${BLUE}[1/7] Updating system packages...${NC}"
apt-get update -y
apt-get upgrade -y

echo -e "${BLUE}[2/7] Installing Nginx...${NC}"
apt-get install -y nginx

echo -e "${BLUE}[3/7] Creating frontend directory...${NC}"
mkdir -p $FRONTEND_DIR
chown -R www-data:www-data $FRONTEND_DIR

echo -e "${BLUE}[4/7] Configuring Nginx...${NC}"
cat > $NGINX_CONF << 'EOF'
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

    # 3D visualization route
    location = /3d {
        try_files /index-3d.html =404;
        add_header Cache-Control "public, max-age=3600";
    }

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
EOF

echo -e "${BLUE}[5/7] Enabling Nginx site...${NC}"
ln -sf $NGINX_CONF /etc/nginx/sites-enabled/hansei
rm -f /etc/nginx/sites-enabled/default

echo -e "${BLUE}[6/7] Testing and starting Nginx...${NC}"
nginx -t
systemctl enable nginx
systemctl restart nginx

echo -e "${BLUE}[7/7] Configuring firewall...${NC}"
ufw --force enable
ufw allow 'Nginx Full'
ufw allow OpenSSH

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  ✅ Server Setup Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "Server ready at: ${BLUE}http://$SERVER_IP${NC}"
echo -e "Frontend directory: ${BLUE}$FRONTEND_DIR${NC}"
echo ""
echo "Upload frontend files with:"
echo -e "${BLUE}scp -r frontend/* root@$SERVER_IP:$FRONTEND_DIR/${NC}"
echo ""