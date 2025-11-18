# HANSEI - Monitoring & Observability Guide

**Version:** 1.0.0
**Last Updated:** November 17, 2025

---

## Table of Contents

1. [Monitoring Overview](#monitoring-overview)
2. [Infrastructure Monitoring](#infrastructure-monitoring)
3. [Application Monitoring](#application-monitoring)
4. [Log Management](#log-management)
5. [Alerting](#alerting)
6. [Performance Metrics](#performance-metrics)
7. [Dashboards](#dashboards)
8. [Troubleshooting](#troubleshooting)

---

## Monitoring Overview

### Monitoring Strategy

**Four Golden Signals:**
1. **Latency** - How long requests take
2. **Traffic** - How many requests
3. **Errors** - Rate of failed requests
4. **Saturation** - How full the service is

### Monitoring Stack

```
┌─────────────────────────────────────────┐
│         Visualization Layer              │
│  ┌──────────┐  ┌──────────┐            │
│  │ Grafana  │  │ Netdata  │            │
│  └──────────┘  └──────────┘            │
└────────────┬────────────────────────────┘
             │
┌────────────┴────────────────────────────┐
│         Metrics Collection               │
│  ┌──────────┐  ┌──────────┐            │
│  │Prometheus│  │ Node Exp │            │
│  └──────────┘  └──────────┘            │
└────────────┬────────────────────────────┘
             │
┌────────────┴────────────────────────────┐
│        Application & Logs                │
│  ┌──────────┐  ┌──────────┐            │
│  │  HANSEI  │  │  Nginx   │            │
│  └──────────┘  └──────────┘            │
└─────────────────────────────────────────┘
```

---

## Infrastructure Monitoring

### Netdata (Quick Setup - Recommended)

**Installation:**

```bash
# Install Netdata
bash <(curl -Ss https://my-netdata.io/kickstart.sh)

# Access dashboard
# http://YOUR_SERVER_IP:19999
```

**Features:**
- Real-time metrics (1-second granularity)
- CPU, memory, disk, network monitoring
- Process monitoring
- Web dashboard
- Alert notifications

**Configure alerts:**

```bash
# Edit health configuration
nano /etc/netdata/health.d/hansei.conf
```

Add custom alerts:

```yaml
# CPU usage alert
alarm: cpu_usage
on: system.cpu
lookup: average -1m unaligned of user,system
units: %
every: 1m
warn: $this > 70
crit: $this > 90
info: CPU usage is high

# Memory usage alert
alarm: ram_usage
on: system.ram
lookup: average -1m unaligned of used
units: %
every: 1m
warn: $this > 80
crit: $this > 95
info: RAM usage is high

# Nginx errors
alarm: nginx_errors
on: web_log_nginx.response_statuses
lookup: sum -1m of 5xx
units: requests
every: 1m
warn: $this > 10
crit: $this > 50
info: High rate of 5xx errors
```

**Restart Netdata:**

```bash
systemctl restart netdata
```

### System Metrics

**Monitor key system metrics:**

```bash
#!/bin/bash
# system-metrics.sh - Quick health check

echo "=== HANSEI System Metrics ==="
echo ""

# CPU
echo "CPU Usage:"
top -bn1 | grep "Cpu(s)" | awk '{print "  User: "$2", System: "$4", Idle: "$8}'

# Memory
echo ""
echo "Memory Usage:"
free -h | awk 'NR==2{print "  Total: "$2", Used: "$3" ("$3/$2*100"%)"}'

# Disk
echo ""
echo "Disk Usage:"
df -h / | awk 'NR==2{print "  Total: "$2", Used: "$3" ("$5")"}'

# Network
echo ""
echo "Network Connections:"
ss -s | grep TCP: | awk '{print "  "$0}'

# Nginx Status
echo ""
echo "Nginx Status:"
systemctl is-active nginx && echo "  ✅ Running" || echo "  ❌ Not running"

# Uptime
echo ""
echo "System Uptime:"
uptime -p

# Load Average
echo ""
echo "Load Average:"
cat /proc/loadavg | awk '{print "  1min: "$1", 5min: "$2", 15min: "$3}'

echo ""
echo "=== End Metrics ==="
```

**Schedule regular checks:**

```bash
# Add to crontab
crontab -e

# Run every 5 minutes
*/5 * * * * /root/system-metrics.sh >> /var/log/system-metrics.log
```

### Resource Monitoring

**Disk Space Monitoring:**

```bash
# Create disk monitor script
cat > /root/monitor-disk.sh << 'EOF'
#!/bin/bash

THRESHOLD=80
CURRENT=$(df / | grep / | awk '{print $5}' | sed 's/%//g')

if [ $CURRENT -gt $THRESHOLD ]; then
    echo "Disk usage is ${CURRENT}% (threshold: ${THRESHOLD}%)"
    # Send alert (configure email/slack)
    echo "High disk usage: ${CURRENT}%" | mail -s "Disk Alert" admin@email.com
fi
EOF

chmod +x /root/monitor-disk.sh

# Add to cron
echo "0 * * * * /root/monitor-disk.sh" | crontab -
```

---

## Application Monitoring

### Backend Monitoring (Raindrop)

**View Raindrop logs:**

```bash
# Tail logs in real-time
raindrop logs tail -f

# Query recent logs
raindrop logs query --since 1h

# Filter by severity
raindrop logs query --level error --since 24h

# Search logs
raindrop logs query --grep "error" --since 1h
```

**Check backend status:**

```bash
#!/bin/bash
# check-backend.sh

BACKEND_URL="https://svc-01ka9za29rb1k3xhtqxxe8qn20.01ka4j4ktmq3vmg0nfmg652rkw.lmapp.run"

# Health check
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" $BACKEND_URL/health)

if [ $HTTP_CODE -eq 200 ]; then
    echo "✅ Backend healthy (HTTP $HTTP_CODE)"
    exit 0
else
    echo "❌ Backend unhealthy (HTTP $HTTP_CODE)"
    # Send alert
    exit 1
fi
```

**Monitor API endpoints:**

```bash
#!/bin/bash
# monitor-api.sh

BACKEND_URL="https://svc-01ka9za29rb1k3xhtqxxe8qn20.01ka4j4ktmq3vmg0nfmg652rkw.lmapp.run"

# Test /infer endpoint
START=$(date +%s%N)
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
    -X POST $BACKEND_URL/infer \
    -H "Content-Type: application/json" \
    -d '{"content":"test","user_id":"monitor"}')
END=$(date +%s%N)
DURATION=$(( (END - START) / 1000000 ))

echo "API /infer: HTTP $HTTP_CODE, ${DURATION}ms"

if [ $HTTP_CODE -ne 200 ] || [ $DURATION -gt 5000 ]; then
    echo "⚠️ API performance issue detected"
fi
```

### Frontend Monitoring

**Nginx access log analysis:**

```bash
# Requests per minute
tail -1000 /var/log/nginx/hansei-access.log | \
    awk '{print $4}' | uniq -c

# Top IP addresses
awk '{print $1}' /var/log/nginx/hansei-access.log | \
    sort | uniq -c | sort -rn | head -10

# Response codes distribution
awk '{print $9}' /var/log/nginx/hansei-access.log | \
    sort | uniq -c | sort -rn

# Average response time
awk '{print $NF}' /var/log/nginx/hansei-access.log | \
    awk '{s+=$1; n++} END {print s/n}'

# Most requested URLs
awk '{print $7}' /var/log/nginx/hansei-access.log | \
    sort | uniq -c | sort -rn | head -10
```

**Create monitoring dashboard script:**

```bash
#!/bin/bash
# nginx-stats.sh

LOG="/var/log/nginx/hansei-access.log"

echo "=== Nginx Statistics (last 1000 requests) ==="
echo ""

# Total requests
TOTAL=$(tail -1000 $LOG | wc -l)
echo "Total Requests: $TOTAL"

# Status codes
echo ""
echo "Status Codes:"
tail -1000 $LOG | awk '{print $9}' | sort | uniq -c | sort -rn | \
    awk '{print "  "$2": "$1" ("$1*100/'"$TOTAL"'"%)"}'

# Top pages
echo ""
echo "Top Pages:"
tail -1000 $LOG | awk '{print $7}' | sort | uniq -c | sort -rn | head -5 | \
    awk '{print "  "$2": "$1" requests"}'

# Error rate
ERRORS=$(tail -1000 $LOG | awk '$9 >= 400' | wc -l)
ERROR_RATE=$(echo "scale=2; $ERRORS * 100 / $TOTAL" | bc)
echo ""
echo "Error Rate: ${ERROR_RATE}%"
```

**Real-time monitoring:**

```bash
# Watch access log live
tail -f /var/log/nginx/hansei-access.log | \
    awk '{print $1, $9, $7, $NF}'

# Monitor errors only
tail -f /var/log/nginx/hansei-error.log
```

---

## Log Management

### Log Configuration

**Nginx log format:**

```nginx
# /etc/nginx/nginx.conf

http {
    log_format hansei_detailed '$remote_addr - $remote_user [$time_local] '
                              '"$request" $status $body_bytes_sent '
                              '"$http_referer" "$http_user_agent" '
                              'rt=$request_time uct="$upstream_connect_time" '
                              'uht="$upstream_header_time" urt="$upstream_response_time"';

    access_log /var/log/nginx/hansei-access.log hansei_detailed;
}
```

### Log Rotation

**Configure logrotate:**

```bash
# /etc/logrotate.d/hansei

/var/log/nginx/hansei-*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 www-data adm
    sharedscripts
    postrotate
        if [ -f /var/run/nginx.pid ]; then
            kill -USR1 `cat /var/run/nginx.pid`
        fi
    endscript
}

/var/log/hansei/*.log {
    daily
    rotate 7
    compress
    missingok
    notifempty
}
```

**Test rotation:**

```bash
logrotate -f /etc/logrotate.d/hansei
```

### Centralized Logging (Optional)

**Forward logs to external service:**

```bash
# Install rsyslog
apt-get install -y rsyslog

# Configure remote logging
cat > /etc/rsyslog.d/50-hansei.conf << 'EOF'
# Forward all logs to remote server
*.* @log-server.example.com:514

# Or use TCP (more reliable)
*.* @@log-server.example.com:514
EOF

systemctl restart rsyslog
```

---

## Alerting

### Email Alerts

**Configure email notifications:**

```bash
# Install mailutils
apt-get install -y mailutils

# Test email
echo "Test alert" | mail -s "HANSEI Alert" admin@email.com

# Create alert script
cat > /root/send-alert.sh << 'EOF'
#!/bin/bash

SUBJECT="$1"
MESSAGE="$2"
EMAIL="admin@email.com"

echo "$MESSAGE" | mail -s "$SUBJECT" "$EMAIL"
EOF

chmod +x /root/send-alert.sh
```

### Uptime Monitoring

**Use external monitoring service:**

Services to consider:
- UptimeRobot (free for 50 monitors)
- Pingdom
- StatusCake
- Better Uptime

**Configure UptimeRobot:**
1. Go to https://uptimerobot.com
2. Add monitor: `http://155.138.196.189/health`
3. Set interval: 5 minutes
4. Configure alerts: email/SMS/webhook

### Custom Alerts

**CPU alert:**

```bash
# /root/alert-cpu.sh
#!/bin/bash

CPU_THRESHOLD=80
CPU_USAGE=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1)

if (( $(echo "$CPU_USAGE > $CPU_THRESHOLD" | bc -l) )); then
    /root/send-alert.sh \
        "High CPU Usage" \
        "CPU usage is ${CPU_USAGE}% (threshold: ${CPU_THRESHOLD}%)"
fi
```

**Memory alert:**

```bash
# /root/alert-memory.sh
#!/bin/bash

MEM_THRESHOLD=90
MEM_USAGE=$(free | grep Mem | awk '{print ($3/$2) * 100.0}')

if (( $(echo "$MEM_USAGE > $MEM_THRESHOLD" | bc -l) )); then
    /root/send-alert.sh \
        "High Memory Usage" \
        "Memory usage is ${MEM_USAGE}% (threshold: ${MEM_THRESHOLD}%)"
fi
```

**Schedule alerts:**

```bash
# Add to crontab
crontab -e

# Check every 5 minutes
*/5 * * * * /root/alert-cpu.sh
*/5 * * * * /root/alert-memory.sh
*/5 * * * * /root/check-backend.sh || /root/send-alert.sh "Backend Down" "Backend health check failed"
```

---

## Performance Metrics

### Response Time Monitoring

**Measure API response times:**

```bash
#!/bin/bash
# measure-response-times.sh

BACKEND_URL="https://svc-01ka9za29rb1k3xhtqxxe8qn20.01ka4j4ktmq3vmg0nfmg652rkw.lmapp.run"

echo "=== API Response Times ==="

# Health endpoint
curl -w "\nHealth: %{time_total}s\n" -o /dev/null -s $BACKEND_URL/health

# Infer endpoint
curl -w "\nInfer: %{time_total}s\n" -o /dev/null -s \
    -X POST $BACKEND_URL/infer \
    -H "Content-Type: application/json" \
    -d '{"content":"test","user_id":"monitor"}'

# Graph endpoint
curl -w "\nGraph: %{time_total}s\n" -o /dev/null -s \
    "$BACKEND_URL/api/graph?query=test&limit=10"
```

### Frontend Performance

**Measure page load times:**

```bash
# Install lighthouse CLI
npm install -g lighthouse

# Run performance audit
lighthouse http://155.138.196.189/ \
    --output html \
    --output-path ./lighthouse-report.html

# Or use curl
curl -w "\nTotal Time: %{time_total}s\nDNS: %{time_namelookup}s\nConnect: %{time_connect}s\nStart Transfer: %{time_starttransfer}s\n" \
    -o /dev/null -s http://155.138.196.189/
```

### Key Performance Indicators

**Track these metrics:**

| Metric | Target | Alert Threshold |
|--------|--------|-----------------|
| Page Load Time | < 2s | > 3s |
| API Response Time | < 500ms | > 1s |
| Error Rate | < 1% | > 5% |
| Uptime | > 99.5% | < 99% |
| CPU Usage | < 60% | > 80% |
| Memory Usage | < 70% | > 90% |
| Disk Usage | < 75% | > 85% |

---

## Dashboards

### Create Simple Dashboard

**HTML dashboard for basic metrics:**

```html
<!-- /var/www/hansei/status.html -->
<!DOCTYPE html>
<html>
<head>
    <title>HANSEI Status</title>
    <meta http-equiv="refresh" content="60">
    <style>
        body { font-family: sans-serif; margin: 20px; }
        .metric { padding: 10px; margin: 10px 0; border-radius: 5px; }
        .ok { background: #d4edda; }
        .warning { background: #fff3cd; }
        .error { background: #f8d7da; }
    </style>
</head>
<body>
    <h1>HANSEI System Status</h1>
    <div id="status"></div>

    <script>
        async function loadStatus() {
            const backend = 'https://svc-01ka9za29rb1k3xhtqxxe8qn20.01ka4j4ktmq3vmg0nfmg652rkw.lmapp.run';

            try {
                const start = Date.now();
                const res = await fetch(backend + '/health');
                const latency = Date.now() - start;

                const statusDiv = document.getElementById('status');
                statusDiv.innerHTML = `
                    <div class="metric ok">
                        <strong>Backend:</strong> ✅ Healthy (${latency}ms)
                    </div>
                    <div class="metric ok">
                        <strong>Last Check:</strong> ${new Date().toLocaleString()}
                    </div>
                `;
            } catch (err) {
                document.getElementById('status').innerHTML = `
                    <div class="metric error">
                        <strong>Backend:</strong> ❌ Down
                    </div>
                `;
            }
        }

        loadStatus();
        setInterval(loadStatus, 60000);
    </script>
</body>
</html>
```

Access at: `http://155.138.196.189/status.html`

---

## Troubleshooting

### Common Issues

**High CPU Usage:**

```bash
# Find CPU-heavy processes
top -bn1 | head -20

# Or use htop
htop

# Check Nginx workers
ps aux | grep nginx
```

**High Memory Usage:**

```bash
# Check memory hogs
ps aux --sort=-%mem | head -10

# Clear cache if needed (safe)
sync; echo 3 > /proc/sys/vm/drop_caches
```

**Disk Full:**

```bash
# Find large files
du -h / | sort -rh | head -20

# Clean old logs
find /var/log -name "*.log.*" -mtime +7 -delete

# Clean package cache
apt-get clean
```

### Diagnostic Commands

```bash
# System overview
htop

# Network connections
netstat -tulpn
ss -tulpn

# Disk I/O
iotop

# Network I/O
iftop

# Process tree
pstree -p

# Check open files
lsof | wc -l
```

---

## Monitoring Checklist

### Daily

- [ ] Check error logs
- [ ] Review system metrics
- [ ] Verify backup completion
- [ ] Check disk usage

### Weekly

- [ ] Review performance trends
- [ ] Analyze traffic patterns
- [ ] Update dashboards
- [ ] Test alerting system

### Monthly

- [ ] Capacity planning review
- [ ] Security audit logs
- [ ] Update monitoring rules
- [ ] Performance optimization

---

**Monitoring is continuous. Review and adapt as needed.**
