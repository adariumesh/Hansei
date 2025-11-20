# URGENT: webhansei.us/3d Fix Deployment Instructions

## Problem Summary
- **Issue**: https://webhansei.us/3d returns 404 Not Found (nginx/1.18.0 Ubuntu)
- **Working**: https://svc-01kaaeej1ecf9k85z0f29rp6wf.01ka41m1warcc7s5zveqw1tt3z.lmapp.run/3d ✅
- **Root Cause**: Missing nginx location block for `/3d` route on webhansei.us domain

## Immediate Fix Required

### Step 1: Upload Fix Files to Server
```bash
# Upload the fix script to the webhansei.us server
scp fix-webhansei-domain.sh root@webhansei.us:/tmp/
scp nginx-webhansei-fix.conf root@webhansei.us:/tmp/
```

### Step 2: Execute the Fix on webhansei.us Server
```bash
# SSH into the server
ssh root@webhansei.us

# Navigate to the uploaded script
cd /tmp

# Make the script executable
chmod +x fix-webhansei-domain.sh

# Run the fix script
sudo ./fix-webhansei-domain.sh
```

### Step 3: Upload Frontend Files (If Missing)
```bash
# From your local machine, upload the frontend files
scp -r frontend/* root@webhansei.us:/var/www/hansei/
```

### Step 4: Verify the Fix
```bash
# Test the URLs
curl -I http://webhansei.us/3d
curl -I https://webhansei.us/3d

# Should return HTTP 200 instead of 404
```

## What the Fix Does

The script creates a proper nginx configuration for `webhansei.us` with the critical location block:

```nginx
location = /3d {
    try_files /index-3d.html =404;
    add_header Cache-Control "public, max-age=3600";
}
```

## Manual Alternative (If Script Fails)

If the automated script fails, manually create the nginx configuration:

1. **Create the configuration file**:
```bash
sudo nano /etc/nginx/sites-available/webhansei
```

2. **Add this content**:
```nginx
server {
    listen 80;
    listen [::]:80;
    server_name webhansei.us www.webhansei.us;

    root /var/www/hansei;
    index index.html index-3d.html;

    # 3D visualization route - THE CRITICAL FIX
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

    access_log /var/log/nginx/webhansei-access.log;
    error_log /var/log/nginx/webhansei-error.log;
}
```

3. **Enable the site**:
```bash
sudo ln -sf /etc/nginx/sites-available/webhansei /etc/nginx/sites-enabled/webhansei
sudo nginx -t
sudo systemctl reload nginx
```

## Troubleshooting

### If Still Getting 404:
1. **Check if files exist**:
```bash
ls -la /var/www/hansei/index-3d.html
```

2. **Check nginx error logs**:
```bash
tail -f /var/log/nginx/webhansei-error.log
```

3. **Verify nginx configuration**:
```bash
sudo nginx -t
sudo nginx -s reload
```

### If Files Are Missing:
```bash
# Upload frontend files
scp -r frontend/* root@webhansei.us:/var/www/hansei/
sudo chown -R www-data:www-data /var/www/hansei
```

## Expected Results After Fix

✅ **Before Fix**: `https://webhansei.us/3d` → 404 Not Found  
✅ **After Fix**: `https://webhansei.us/3d` → 200 OK (3D visualization loads)

## Files Created
- `/Users/adariprasad/weapon/HANSEI/hansei/fix-webhansei-domain.sh` - Automated fix script
- `/Users/adariprasad/weapon/HANSEI/hansei/nginx-webhansei-fix.conf` - Nginx configuration
- `/Users/adariprasad/weapon/HANSEI/hansei/WEBHANSEI-FIX-INSTRUCTIONS.md` - This instruction file

## Priority: IMMEDIATE
This is a production issue affecting user access to the 3D visualization feature. Please deploy the fix immediately.