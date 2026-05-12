# Production Deployment Guide — EmissionsIQ System

**Version:** 1.0  
**Date:** May 1, 2026  
**System:** EmissionsIQ Pollution Monitoring Platform

---

## 🎯 OVERVIEW

This guide provides step-by-step instructions for deploying the EmissionsIQ system to a production environment.

**System Components:**
- Backend API (Node.js + Express)
- Frontend SPA (React + TypeScript + Vite)
- MongoDB Database
- MQTT Broker (Mosquitto)
- IoT Simulator (optional for testing)

---

## 📋 PRE-DEPLOYMENT CHECKLIST

### System Requirements

#### Server Specifications (Minimum)
```
CPU: 4 cores
RAM: 8 GB
Disk: 100 GB SSD
OS: Ubuntu 22.04 LTS or Windows Server 2022
Network: 100 Mbps
```

#### Server Specifications (Recommended)
```
CPU: 8 cores
RAM: 16 GB
Disk: 500 GB SSD (RAID 1)
OS: Ubuntu 22.04 LTS
Network: 1 Gbps
Backup: Separate backup server or cloud storage
```

#### Software Requirements
```
Node.js: v20.x or v22.x
MongoDB: v7.x or v8.x
MQTT Broker: Mosquitto v2.x
nginx: v1.24.x (reverse proxy)
PM2: v5.x (process manager)
Git: v2.x
```

---

## 🔧 INSTALLATION STEPS

### Step 1: Server Setup

#### 1.1 Update System
```bash
# Ubuntu/Debian
sudo apt update && sudo apt upgrade -y

# Install essential tools
sudo apt install -y curl wget git build-essential
```

#### 1.2 Install Node.js
```bash
# Install Node.js 22.x
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs

# Verify installation
node --version  # Should show v22.x.x
npm --version   # Should show v10.x.x
```

#### 1.3 Install MongoDB
```bash
# Import MongoDB GPG key
curl -fsSL https://www.mongodb.org/static/pgp/server-8.0.asc | \
   sudo gpg -o /usr/share/keyrings/mongodb-server-8.0.gpg --dearmor

# Add MongoDB repository
echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-8.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/8.0 multiverse" | \
   sudo tee /etc/apt/sources.list.d/mongodb-org-8.0.list

# Install MongoDB
sudo apt update
sudo apt install -y mongodb-org

# Start MongoDB
sudo systemctl start mongod
sudo systemctl enable mongod

# Verify installation
mongosh --eval "db.adminCommand('ping')"
```

#### 1.4 Install MQTT Broker (Mosquitto)
```bash
# Install Mosquitto
sudo apt install -y mosquitto mosquitto-clients

# Start Mosquitto
sudo systemctl start mosquitto
sudo systemctl enable mosquitto

# Verify installation
mosquitto_sub -h localhost -t test &
mosquitto_pub -h localhost -t test -m "Hello"
```

#### 1.5 Install nginx
```bash
# Install nginx
sudo apt install -y nginx

# Start nginx
sudo systemctl start nginx
sudo systemctl enable nginx

# Verify installation
curl http://localhost
```

#### 1.6 Install PM2
```bash
# Install PM2 globally
sudo npm install -g pm2

# Verify installation
pm2 --version
```

---

### Step 2: Application Deployment

#### 2.1 Clone Repository
```bash
# Create application directory
sudo mkdir -p /var/www/emissionsiq
sudo chown $USER:$USER /var/www/emissionsiq

# Clone repository
cd /var/www/emissionsiq
git clone <repository-url> .

# Or upload files via SCP/SFTP
```

#### 2.2 Backend Setup
```bash
cd /var/www/emissionsiq/backend

# Install dependencies
npm install --production

# Create production .env file
cp .env.example .env.production

# Edit .env.production
nano .env.production
```

**Production .env Configuration:**
```env
# MongoDB
MONGO_URI=mongodb://localhost:27017/pollution_db_prod

# Server
PORT=5000
NODE_ENV=production

# MQTT Broker
MQTT_BROKER=mqtt://localhost:1883

# JWT Secrets (CHANGE THESE!)
JWT_ACCESS_SECRET=<generate-strong-random-secret-64-chars>
JWT_REFRESH_SECRET=<generate-strong-random-secret-64-chars>

# Token Expiry
JWT_ACCESS_EXPIRES=15m
JWT_REFRESH_EXPIRES=7d

# CORS (your production domain)
CORS_ORIGIN=https://emissionsiq.yourdomain.com

# Rate Limiting
RATE_LIMIT_WINDOW=15m
RATE_LIMIT_MAX=100
```

**Generate Strong Secrets:**
```bash
# Generate JWT secrets
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

#### 2.3 Frontend Setup
```bash
cd /var/www/emissionsiq/frontend

# Install dependencies
npm install

# Create production .env file
cp .env.example .env.production

# Edit .env.production
nano .env.production
```

**Production .env Configuration:**
```env
VITE_API_URL=https://api.emissionsiq.yourdomain.com
VITE_WS_URL=wss://api.emissionsiq.yourdomain.com/ws
VITE_ENV=production
```

**Build Frontend:**
```bash
# Build for production
npm run build

# Output will be in /var/www/emissionsiq/frontend/dist
```

---

### Step 3: Database Setup

#### 3.1 Create Production Database
```bash
# Connect to MongoDB
mongosh

# Create database and user
use pollution_db_prod

db.createUser({
  user: "emissionsiq_user",
  pwd: "<strong-password>",
  roles: [
    { role: "readWrite", db: "pollution_db_prod" }
  ]
})

exit
```

#### 3.2 Enable MongoDB Authentication
```bash
# Edit MongoDB config
sudo nano /etc/mongod.conf

# Add security section:
security:
  authorization: enabled

# Restart MongoDB
sudo systemctl restart mongod
```

#### 3.3 Update Backend .env
```env
MONGO_URI=mongodb://emissionsiq_user:<password>@localhost:27017/pollution_db_prod?authSource=pollution_db_prod
```

#### 3.4 Initialize Database
```bash
cd /var/www/emissionsiq/backend

# Run initialization scripts
node init-users.js
node init-thresholds-corrected.js
node init-kpi-config.js

# Verify data
mongosh pollution_db_prod --eval "db.users.countDocuments()"
```

---

### Step 4: Process Management with PM2

#### 4.1 Create PM2 Ecosystem File
```bash
cd /var/www/emissionsiq

# Create ecosystem.config.js
nano ecosystem.config.js
```

**ecosystem.config.js:**
```javascript
module.exports = {
  apps: [
    {
      name: 'emissionsiq-backend',
      cwd: '/var/www/emissionsiq/backend',
      script: 'server.js',
      instances: 2,
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 5000
      },
      error_file: '/var/log/emissionsiq/backend-error.log',
      out_file: '/var/log/emissionsiq/backend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      max_memory_restart: '1G',
      autorestart: true,
      watch: false,
      max_restarts: 10,
      min_uptime: '10s'
    },
    {
      name: 'emissionsiq-iot-simulator',
      cwd: '/var/www/emissionsiq/iot',
      script: 'simulator.js',
      instances: 1,
      env: {
        NODE_ENV: 'production'
      },
      error_file: '/var/log/emissionsiq/iot-error.log',
      out_file: '/var/log/emissionsiq/iot-out.log',
      autorestart: true,
      watch: false
    }
  ]
};
```

#### 4.2 Create Log Directory
```bash
sudo mkdir -p /var/log/emissionsiq
sudo chown $USER:$USER /var/log/emissionsiq
```

#### 4.3 Start Applications
```bash
# Start all applications
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save

# Set up PM2 to start on boot
pm2 startup
# Follow the instructions provided by the command

# Check status
pm2 status
pm2 logs
```

---

### Step 5: nginx Configuration

#### 5.1 Create nginx Configuration
```bash
sudo nano /etc/nginx/sites-available/emissionsiq
```

**nginx Configuration:**
```nginx
# Backend API
server {
    listen 80;
    server_name api.emissionsiq.yourdomain.com;

    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.emissionsiq.yourdomain.com;

    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/api.emissionsiq.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.emissionsiq.yourdomain.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Security Headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Logging
    access_log /var/log/nginx/emissionsiq-api-access.log;
    error_log /var/log/nginx/emissionsiq-api-error.log;

    # API Proxy
    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }

    # WebSocket Proxy
    location /ws {
        proxy_pass http://localhost:5000/ws;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400;
    }
}

# Frontend
server {
    listen 80;
    server_name emissionsiq.yourdomain.com;

    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name emissionsiq.yourdomain.com;

    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/emissionsiq.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/emissionsiq.yourdomain.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Security Headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' wss://api.emissionsiq.yourdomain.com https://api.emissionsiq.yourdomain.com;" always;

    # Logging
    access_log /var/log/nginx/emissionsiq-frontend-access.log;
    error_log /var/log/nginx/emissionsiq-frontend-error.log;

    # Root directory
    root /var/www/emissionsiq/frontend/dist;
    index index.html;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml+rss application/json application/javascript;

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # SPA routing
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

#### 5.2 Enable Site and Restart nginx
```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/emissionsiq /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

# Restart nginx
sudo systemctl restart nginx
```

---

### Step 6: SSL/TLS Certificate (Let's Encrypt)

#### 6.1 Install Certbot
```bash
sudo apt install -y certbot python3-certbot-nginx
```

#### 6.2 Obtain Certificates
```bash
# For API domain
sudo certbot --nginx -d api.emissionsiq.yourdomain.com

# For frontend domain
sudo certbot --nginx -d emissionsiq.yourdomain.com

# Follow the prompts
```

#### 6.3 Auto-Renewal
```bash
# Test renewal
sudo certbot renew --dry-run

# Certbot automatically sets up a cron job for renewal
```

---

### Step 7: Firewall Configuration

#### 7.1 Configure UFW (Ubuntu Firewall)
```bash
# Enable UFW
sudo ufw enable

# Allow SSH
sudo ufw allow 22/tcp

# Allow HTTP and HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Allow MongoDB (only from localhost)
sudo ufw deny 27017/tcp

# Allow MQTT (only from localhost or specific IPs)
sudo ufw deny 1883/tcp
# Or allow from specific IP:
# sudo ufw allow from <iot-device-ip> to any port 1883

# Check status
sudo ufw status
```

---

### Step 8: Monitoring Setup

#### 8.1 PM2 Monitoring
```bash
# Enable PM2 monitoring
pm2 install pm2-logrotate

# Configure log rotation
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 30
pm2 set pm2-logrotate:compress true
```

#### 8.2 MongoDB Monitoring
```bash
# Enable MongoDB monitoring
mongosh pollution_db_prod --eval "db.enableFreeMonitoring()"
```

#### 8.3 System Monitoring
```bash
# Install monitoring tools
sudo apt install -y htop iotop nethogs

# Optional: Install Netdata for real-time monitoring
bash <(curl -Ss https://my-netdata.io/kickstart.sh)
```

---

### Step 9: Backup Configuration

#### 9.1 Create Backup Script
```bash
sudo nano /usr/local/bin/backup-emissionsiq.sh
```

**Backup Script:**
```bash
#!/bin/bash

# Configuration
BACKUP_DIR="/var/backups/emissionsiq"
DATE=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=30

# Create backup directory
mkdir -p $BACKUP_DIR

# Backup MongoDB
mongodump --uri="mongodb://emissionsiq_user:<password>@localhost:27017/pollution_db_prod?authSource=pollution_db_prod" \
  --out="$BACKUP_DIR/mongodb_$DATE"

# Compress backup
tar -czf "$BACKUP_DIR/mongodb_$DATE.tar.gz" -C "$BACKUP_DIR" "mongodb_$DATE"
rm -rf "$BACKUP_DIR/mongodb_$DATE"

# Backup application files
tar -czf "$BACKUP_DIR/app_$DATE.tar.gz" /var/www/emissionsiq

# Remove old backups
find $BACKUP_DIR -name "*.tar.gz" -mtime +$RETENTION_DAYS -delete

echo "Backup completed: $DATE"
```

#### 9.2 Make Script Executable
```bash
sudo chmod +x /usr/local/bin/backup-emissionsiq.sh
```

#### 9.3 Schedule Backups with Cron
```bash
# Edit crontab
sudo crontab -e

# Add daily backup at 2 AM
0 2 * * * /usr/local/bin/backup-emissionsiq.sh >> /var/log/emissionsiq/backup.log 2>&1
```

---

### Step 10: Post-Deployment Verification

#### 10.1 Check Services
```bash
# Check PM2 processes
pm2 status

# Check MongoDB
sudo systemctl status mongod

# Check nginx
sudo systemctl status nginx

# Check Mosquitto
sudo systemctl status mosquitto
```

#### 10.2 Test API Endpoints
```bash
# Test health endpoint
curl https://api.emissionsiq.yourdomain.com/api/health

# Test login
curl -X POST https://api.emissionsiq.yourdomain.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"admin123"}'
```

#### 10.3 Test Frontend
```bash
# Open in browser
https://emissionsiq.yourdomain.com

# Check:
# - Page loads
# - Login works
# - Dashboard displays
# - Real-time updates work
```

#### 10.4 Test WebSocket
```bash
# Check WebSocket connection in browser console
# Should see: "WebSocket connected"
```

---

## 🔒 SECURITY HARDENING

### 1. Change Default Passwords
```bash
# Change all default user passwords
# Update JWT secrets
# Update MongoDB passwords
```

### 2. Disable Root Login
```bash
sudo nano /etc/ssh/sshd_config

# Set:
PermitRootLogin no
PasswordAuthentication no

sudo systemctl restart sshd
```

### 3. Enable Fail2Ban
```bash
sudo apt install -y fail2ban

# Configure
sudo cp /etc/fail2ban/jail.conf /etc/fail2ban/jail.local
sudo nano /etc/fail2ban/jail.local

# Enable for SSH and nginx
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

### 4. Regular Updates
```bash
# Set up automatic security updates
sudo apt install -y unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades
```

---

## 📊 MONITORING AND MAINTENANCE

### Daily Checks
- [ ] Check PM2 process status
- [ ] Check application logs for errors
- [ ] Check disk space
- [ ] Check backup completion

### Weekly Checks
- [ ] Review error logs
- [ ] Check database performance
- [ ] Review security logs
- [ ] Test backup restoration

### Monthly Checks
- [ ] Update system packages
- [ ] Update Node.js dependencies
- [ ] Review and rotate logs
- [ ] Performance optimization

---

## 🚨 TROUBLESHOOTING

### Backend Not Starting
```bash
# Check logs
pm2 logs emissionsiq-backend

# Check MongoDB connection
mongosh pollution_db_prod

# Check environment variables
pm2 env 0
```

### Frontend Not Loading
```bash
# Check nginx logs
sudo tail -f /var/log/nginx/emissionsiq-frontend-error.log

# Check nginx configuration
sudo nginx -t

# Rebuild frontend
cd /var/www/emissionsiq/frontend
npm run build
```

### WebSocket Not Connecting
```bash
# Check nginx WebSocket configuration
# Check firewall rules
# Check backend logs for WebSocket errors
```

---

## 📞 SUPPORT

### Log Locations
```
Backend: /var/log/emissionsiq/backend-*.log
Frontend: /var/log/nginx/emissionsiq-frontend-*.log
MongoDB: /var/log/mongodb/mongod.log
nginx: /var/log/nginx/
PM2: ~/.pm2/logs/
```

### Useful Commands
```bash
# Restart backend
pm2 restart emissionsiq-backend

# View logs
pm2 logs emissionsiq-backend --lines 100

# Check MongoDB status
mongosh --eval "db.serverStatus()"

# Check nginx status
sudo nginx -t && sudo systemctl status nginx
```

---

**Document Version:** 1.0  
**Last Updated:** May 1, 2026  
**Status:** ✅ Production Ready

---

**END OF GUIDE**
