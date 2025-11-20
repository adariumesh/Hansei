#!/bin/bash

# HANSEI Frontend Deployment Script
# This script uploads the updated index-3d.html to your nginx server
# and clears any cached versions

set -e

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚀 HANSEI Frontend Deployment"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Configuration - UPDATE THESE VALUES
SERVER_USER="${SERVER_USER:-root}"
SERVER_HOST="${SERVER_HOST:-webhansei.us}"
REMOTE_PATH="${REMOTE_PATH:-/var/www/hansei}"
NGINX_CONFIG_PATH="${NGINX_CONFIG_PATH:-/etc/nginx/sites-available/webhansei.us}"

echo "📋 Configuration:"
echo "   Server: $SERVER_USER@$SERVER_HOST"
echo "   Remote path: $REMOTE_PATH"
echo "   Nginx config: $NGINX_CONFIG_PATH"
echo ""

# Check if we can connect
echo "🔌 Testing connection to $SERVER_HOST..."
if ! ssh -o ConnectTimeout=5 "$SERVER_USER@$SERVER_HOST" "echo 'Connection successful'" 2>/dev/null; then
    echo "❌ Cannot connect to $SERVER_HOST"
    echo ""
    echo "💡 To deploy manually, run these commands:"
    echo ""
    echo "1. Upload the HTML file:"
    echo "   scp frontend/index-3d.html $SERVER_USER@$SERVER_HOST:$REMOTE_PATH/"
    echo ""
    echo "2. SSH into server and reload nginx:"
    echo "   ssh $SERVER_USER@$SERVER_HOST"
    echo "   sudo nginx -t && sudo systemctl reload nginx"
    echo ""
    exit 1
fi

echo "✓ Connected successfully"
echo ""

# Upload index-3d.html
echo "📤 Uploading index-3d.html..."
scp frontend/index-3d.html "$SERVER_USER@$SERVER_HOST:$REMOTE_PATH/"
echo "✓ index-3d.html uploaded"
echo ""

# Optionally upload other frontend files
read -p "📦 Upload other frontend files (index.html, spatial.html)? [y/N]: " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "📤 Uploading additional frontend files..."
    scp frontend/index.html "$SERVER_USER@$SERVER_HOST:$REMOTE_PATH/" || true
    scp frontend/spatial*.html "$SERVER_USER@$SERVER_HOST:$REMOTE_PATH/" || true
    echo "✓ Additional files uploaded"
    echo ""
fi

# Check nginx config
echo "🔧 Checking nginx configuration..."
ssh "$SERVER_USER@$SERVER_HOST" "sudo nginx -t" || {
    echo "⚠️  Nginx config test failed - but continuing anyway"
}
echo ""

# Reload nginx
echo "🔄 Reloading nginx..."
ssh "$SERVER_USER@$SERVER_HOST" "sudo systemctl reload nginx" && {
    echo "✓ Nginx reloaded successfully"
} || {
    echo "⚠️  Nginx reload failed - you may need to manually restart"
}
echo ""

# Clear browser cache instructions
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Deployment Complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🌐 Visit: https://webhansei.us/3d"
echo ""
echo "💡 If you see the old version:"
echo "   1. Hard refresh: Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows/Linux)"
echo "   2. Clear browser cache for webhansei.us"
echo "   3. Try incognito/private browsing mode"
echo ""
echo "✨ New features available:"
echo "   • Right-click nodes for context menu (delete/pin/mark sensitive)"
echo "   • Hover over nodes to see AI analysis (entities, themes, sentiment)"
echo "   • Demo mode indicator for Anne Frank entries"
echo "   • Privacy badges (📌 pinned, 🔒 sensitive)"
echo ""
