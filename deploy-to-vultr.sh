#!/bin/bash
# HANSEI Frontend Deployment Script for Vultr
# This script sets up Nginx and deploys the frontend

set -e  # Exit on error

echo "========================================="
echo "  HANSEI Frontend Deployment to Vultr"
echo "========================================="

# Color codes for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration
FRONTEND_DIR="/var/www/hansei"
NGINX_CONF="/etc/nginx/sites-available/hansei"

echo -e "${BLUE}[1/6] Updating system packages...${NC}"
apt-get update -y
apt-get upgrade -y

echo -e "${BLUE}[2/6] Installing Nginx...${NC}"
apt-get install -y nginx

echo -e "${BLUE}[3/6] Creating frontend directory...${NC}"
mkdir -p $FRONTEND_DIR
chown -R www-data:www-data $FRONTEND_DIR

echo -e "${BLUE}[4/6] Configuring Nginx...${NC}"
cat > $NGINX_CONF << 'EOF'
server {
    listen 80;
    listen [::]:80;

    server_name _;  # Replace with your domain if you have one

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

    # Main location
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

echo -e "${BLUE}[5/6] Enabling Nginx site...${NC}"
ln -sf $NGINX_CONF /etc/nginx/sites-enabled/hansei
rm -f /etc/nginx/sites-enabled/default  # Remove default site

# Test Nginx configuration
nginx -t

echo -e "${BLUE}[6/6] Starting Nginx...${NC}"
systemctl enable nginx
systemctl restart nginx

# Configure firewall
echo -e "${BLUE}Configuring firewall...${NC}"
ufw --force enable
ufw allow 'Nginx Full'
ufw allow OpenSSH
ufw status

echo ""
echo -e "${GREEN}=========================================${NC}"
echo -e "${GREEN}  Server Setup Complete!${NC}"
echo -e "${GREEN}=========================================${NC}"
echo ""
echo -e "Frontend directory: ${BLUE}$FRONTEND_DIR${NC}"
echo -e "Next step: Upload your frontend files to ${BLUE}$FRONTEND_DIR${NC}"
echo ""
echo "You can upload files using SCP:"
echo -e "${BLUE}scp -r frontend/* root@YOUR_SERVER_IP:$FRONTEND_DIR/${NC}"
echo ""
