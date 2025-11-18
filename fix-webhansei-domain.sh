#!/bin/bash
# HANSEI webhansei.us Domain Fix Script
# This script fixes the 404 error for https://webhansei.us/3d

set -e  # Exit on error

# Color codes for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "========================================"
echo "  HANSEI webhansei.us Domain Fix"
echo "========================================"
echo ""
echo -e "${YELLOW}This script will fix the 404 error for webhansei.us/3d${NC}"
echo ""

# Configuration
FRONTEND_DIR="/var/www/hansei"
NGINX_CONF="/etc/nginx/sites-available/webhansei"
BACKUP_CONF="/etc/nginx/sites-available/webhansei.backup.$(date +%Y%m%d-%H%M%S)"

# Check if we're running as root
if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}Error: This script must be run as root${NC}"
  echo "Usage: sudo bash fix-webhansei-domain.sh"
  exit 1
fi

echo -e "${BLUE}[1/8] Backing up existing nginx configuration...${NC}"
if [ -f "$NGINX_CONF" ]; then
    cp "$NGINX_CONF" "$BACKUP_CONF"
    echo -e "${GREEN}✅ Backup created: $BACKUP_CONF${NC}"
else
    echo -e "${YELLOW}⚠️  No existing webhansei config found, creating new one${NC}"
fi

echo -e "${BLUE}[2/8] Creating frontend directory structure...${NC}"
mkdir -p $FRONTEND_DIR
chown -R www-data:www-data $FRONTEND_DIR

echo -e "${BLUE}[3/8] Installing new nginx configuration for webhansei.us...${NC}"
cat > $NGINX_CONF << 'EOF'
server {
    listen 80;
    listen [::]:80;
    server_name webhansei.us www.webhansei.us;

    root /var/www/hansei;
    index index.html index-3d.html;

    # Enable gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/json;

    # 3D visualization route - THE CRITICAL FIX
    location = /3d {
        try_files /index-3d.html =404;
        add_header Cache-Control "public, max-age=3600";
    }

    # Main route
    location / {
        try_files $uri $uri/ =404;
        add_header Cache-Control "public, max-age=3600";
    }

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Logs
    access_log /var/log/nginx/webhansei-access.log;
    error_log /var/log/nginx/webhansei-error.log;
}
EOF

echo -e "${BLUE}[4/8] Enabling nginx site...${NC}"
ln -sf $NGINX_CONF /etc/nginx/sites-enabled/webhansei

echo -e "${BLUE}[5/8] Testing nginx configuration...${NC}"
nginx -t
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Nginx configuration test passed${NC}"
else
    echo -e "${RED}❌ Nginx configuration test failed${NC}"
    exit 1
fi

echo -e "${BLUE}[6/8] Checking if frontend files exist...${NC}"
if [ ! -f "$FRONTEND_DIR/index-3d.html" ]; then
    echo -e "${RED}❌ Critical: $FRONTEND_DIR/index-3d.html not found!${NC}"
    echo -e "${YELLOW}You need to upload the frontend files first:${NC}"
    echo -e "scp -r frontend/* root@webhansei.us:$FRONTEND_DIR/"
    echo ""
    echo -e "${YELLOW}Continuing with nginx reload anyway...${NC}"
else
    echo -e "${GREEN}✅ index-3d.html found${NC}"
fi

echo -e "${BLUE}[7/8] Reloading nginx...${NC}"
systemctl reload nginx
echo -e "${GREEN}✅ Nginx reloaded${NC}"

echo -e "${BLUE}[8/8] Testing the fix...${NC}"
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  ✅ webhansei.us Domain Fix Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# Test the configuration
echo -e "Testing URLs:"
echo -e "Main site: ${BLUE}http://webhansei.us${NC}"
echo -e "3D route:  ${BLUE}http://webhansei.us/3d${NC}"
echo ""

# Check if curl is available for testing
if command -v curl &> /dev/null; then
    echo -e "${BLUE}Testing local nginx response...${NC}"
    if curl -s -o /dev/null -w "%{http_code}" http://localhost/3d | grep -q "200\|404"; then
        echo -e "${GREEN}✅ Local nginx is responding${NC}"
    else
        echo -e "${YELLOW}⚠️  Local test inconclusive${NC}"
    fi
fi

echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. If frontend files are missing, upload them:"
echo -e "   ${BLUE}scp -r frontend/* root@webhansei.us:$FRONTEND_DIR/${NC}"
echo ""
echo "2. Test the URLs in your browser:"
echo -e "   ${BLUE}https://webhansei.us/3d${NC}"
echo ""
echo "3. Check nginx logs if issues persist:"
echo -e "   ${BLUE}tail -f /var/log/nginx/webhansei-error.log${NC}"
echo ""
echo -e "${GREEN}Fix deployment completed!${NC}"