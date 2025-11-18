# HANSEI - Deployment Checklist

Use this checklist to track your deployment progress.

## Backend Deployment (Raindrop Cloud)

- [x] Install dependencies (`npm install`)
- [x] Authenticate with Raindrop (`raindrop auth login`)
- [x] Validate manifest (`raindrop build validate`)
- [x] Deploy backend (`raindrop build deploy --start`)
- [x] Verify deployment (`raindrop build status`)
- [x] Test health endpoint (`curl BACKEND_URL/health`)
- [x] Note backend URL: `https://svc-01ka9za29rb1k3xhtqxxe8qn20.01ka4j4ktmq3vmg0nfmg652rkw.lmapp.run`

**Backend Status:** ✅ DEPLOYED & RUNNING

---

## Frontend Deployment (Vultr VPS)

### Pre-Deployment

- [x] Update `frontend/index.html` with backend URL
- [x] Update `frontend/index-3d.html` with backend URL
- [ ] Test frontend locally (optional)

### Vultr Server Setup

- [ ] Create Vultr account (if needed)
- [ ] Deploy Ubuntu 22.04 LTS server
- [ ] Note server IP: `_________________`
- [ ] Note root password: (stored securely)
- [ ] SSH access confirmed

### Server Configuration

- [ ] SSH into server (`ssh root@YOUR_SERVER_IP`)
- [ ] Update system packages
- [ ] Install Nginx
- [ ] Create frontend directory (`/var/www/hansei`)
- [ ] Configure Nginx site
- [ ] Enable firewall (UFW)
- [ ] Start Nginx service

### File Upload

- [ ] Upload `index.html` to server
- [ ] Upload `index-3d.html` to server
- [ ] Verify file permissions
- [ ] Verify ownership (www-data:www-data)

### Testing

- [ ] Access `http://YOUR_SERVER_IP/` in browser
- [ ] Access `http://YOUR_SERVER_IP/index-3d.html` in browser
- [ ] Test voice recording feature
- [ ] Test text input feature
- [ ] Verify graph visualization loads
- [ ] Check browser console for errors
- [ ] Test on mobile device (optional)

---

## Optional Enhancements

### Domain & SSL

- [ ] Purchase/configure domain name
- [ ] Point DNS A record to server IP
- [ ] Install Certbot
- [ ] Obtain SSL certificate
- [ ] Configure auto-renewal
- [ ] Test HTTPS access
- [ ] Verify SSL rating (https://www.ssllabs.com/ssltest/)

### Security Hardening

- [ ] Create non-root user
- [ ] Disable root SSH login
- [ ] Set up SSH key authentication
- [ ] Install fail2ban
- [ ] Configure automatic security updates
- [ ] Review and harden firewall rules

### Monitoring & Backup

- [ ] Set up monitoring (Netdata/other)
- [ ] Configure log rotation
- [ ] Create backup script
- [ ] Schedule automated backups
- [ ] Test backup restoration
- [ ] Set up uptime monitoring

### Performance

- [ ] Enable HTTP/2
- [ ] Configure Brotli compression
- [ ] Add CDN (Cloudflare)
- [ ] Optimize images (if any)
- [ ] Configure browser caching
- [ ] Run performance audit (Lighthouse)

---

## Post-Deployment Verification

### Functionality Tests

- [ ] **Voice Recording:**
  - Record 5-second audio
  - Verify transcription appears
  - Check entities extracted
  - Verify graph updates

- [ ] **Text Input:**
  - Enter sample text
  - Check entity extraction
  - Verify graph updates

- [ ] **Graph Visualization:**
  - 2D graph loads properly
  - 3D graph loads properly
  - Nodes are clickable
  - Edges display relationships
  - Search functionality works

- [ ] **API Integration:**
  - `/health` endpoint responds
  - `/infer` endpoint works
  - `/api/voice/ingest` works
  - `/api/graph` returns data
  - CORS configured correctly

### Performance Tests

- [ ] Page load time < 3 seconds
- [ ] API response time < 2 seconds
- [ ] Graph renders smoothly
- [ ] No console errors
- [ ] Mobile responsive

### Security Tests

- [ ] HTTPS enabled (if domain configured)
- [ ] Security headers present
- [ ] No exposed credentials
- [ ] Firewall configured
- [ ] Server hardened

---

## Maintenance Schedule

### Daily
- [ ] Check error logs
- [ ] Monitor server resources

### Weekly
- [ ] Review access logs
- [ ] Check disk space
- [ ] Verify backups

### Monthly
- [ ] Update system packages
- [ ] Review security updates
- [ ] Test backup restoration
- [ ] Review SSL certificate expiry

---

## Rollback Plan

If deployment fails:

1. **Backend Issues:**
   ```bash
   # Check logs
   raindrop logs tail -f

   # Rollback if needed
   raindrop build stop
   # Fix issues, then redeploy
   raindrop build deploy --start
   ```

2. **Frontend Issues:**
   ```bash
   # Restore previous version
   scp -r backup/frontend/* root@YOUR_SERVER_IP:/var/www/hansei/

   # Or rollback Nginx config
   cp /etc/nginx/sites-available/hansei.backup /etc/nginx/sites-available/hansei
   systemctl restart nginx
   ```

---

## Support Contacts

- **Raindrop Support:** https://docs.liquidmetal.ai
- **Vultr Support:** https://my.vultr.com/support/
- **Community:** (Add Discord/Slack if available)

---

## Deployment Notes

**Deployment Date:** _______________

**Deployed By:** _______________

**Server Details:**
- IP Address: _______________
- Domain: _______________
- SSL Enabled: Yes / No
- Backup Location: _______________

**Issues Encountered:**
```
(Note any issues and resolutions here)
```

**Performance Metrics:**
- Page Load Time: _____ seconds
- API Response Time: _____ seconds
- Uptime Target: 99.9%

---

**Status:**
- Backend: ✅ DEPLOYED
- Frontend: ⏳ IN PROGRESS
- SSL: ⏳ PENDING
- Production Ready: ⏳ PENDING
