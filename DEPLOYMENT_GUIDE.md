# CampaignHarvest Deployment Guide for DigitalOcean

This guide will walk you through deploying the CampaignHarvest application to a DigitalOcean server.

## Prerequisites

1. A DigitalOcean account
2. A domain name (optional, but recommended)
3. Basic knowledge of SSH and Linux commands

## Step 1: Create a DigitalOcean Droplet

1. Log in to your DigitalOcean account
2. Click "Create" → "Droplets"
3. Choose the following configuration:
   - **Image**: Ubuntu 22.04 LTS
   - **Plan**: Basic → Regular Intel → $6/month (1 GB RAM, 1 CPU) minimum
   - **Region**: Choose closest to your users
   - **Authentication**: SSH keys (recommended) or Password
   - **Hostname**: `campaignharvest` or your preferred name

4. Click "Create Droplet" and wait for it to be ready

## Step 2: Initial Server Setup

SSH into your server:
```bash
ssh root@your_server_ip
```

### 2.1 Update the system
```bash
apt update && apt upgrade -y
```

### 2.2 Create a non-root user
```bash
adduser campaignharvest
usermod -aG sudo campaignharvest
```

### 2.3 Set up firewall
```bash
ufw allow OpenSSH
ufw allow 80
ufw allow 443
ufw enable
```

## Step 3: Install Required Software

### 3.1 Install Node.js (v18)
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
apt-get install -y nodejs
```

### 3.2 Install PM2 (Process Manager)
```bash
npm install -g pm2
```

### 3.3 Install Nginx
```bash
apt install nginx -y
```

### 3.4 Install Git
```bash
apt install git -y
```

### 3.5 Install SQLite3
```bash
apt install sqlite3 -y
```

## Step 4: Set Up the Application

### 4.1 Switch to the campaignharvest user
```bash
su - campaignharvest
```

### 4.2 Create application directory
```bash
mkdir -p /home/campaignharvest/app
cd /home/campaignharvest/app
```

### 4.3 Clone or upload your application
Option A: Using Git (if you have a repository)
```bash
git clone your_repository_url .
```

Option B: Upload files manually using SCP (from your local machine)
```bash
# Run this from your local machine (including the database)
scp -r /Users/prashanthsirsi/Documents/CampaginHarvest\ Project\ Management/* campaignharvest@your_server_ip:/home/campaignharvest/app/
```

**Note**: The database file (campaign_harvest.db) will be uploaded with your initial deployment to maintain your existing data.

### 4.4 Install dependencies
```bash
cd /home/campaignharvest/app
npm install
```

### 4.5 Create a production environment file
```bash
nano .env
```

Add the following content:
```
NODE_ENV=production
PORT=3000
```

## Step 5: Set Up PM2

### 5.1 Create PM2 ecosystem file
```bash
nano ecosystem.config.js
```

Add the following content:
```javascript
module.exports = {
  apps: [{
    name: 'campaignharvest',
    script: './server.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    }
  }]
};
```

### 5.2 Start the application with PM2
```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

## Step 6: Configure Nginx

### 6.1 Create Nginx configuration
```bash
sudo nano /etc/nginx/sites-available/campaignharvest
```

Add the following configuration:
```nginx
server {
    listen 80;
    server_name your_domain.com www.your_domain.com;
    
    # If you don't have a domain, use: server_name _;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Increase max body size for file uploads
    client_max_body_size 10M;
}
```

### 6.2 Enable the site
```bash
sudo ln -s /etc/nginx/sites-available/campaignharvest /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

## Step 7: Set Up SSL (HTTPS) - Optional but Recommended

### 7.1 Install Certbot
```bash
sudo apt install certbot python3-certbot-nginx -y
```

### 7.2 Obtain SSL certificate
```bash
sudo certbot --nginx -d your_domain.com -d www.your_domain.com
```

Follow the prompts to complete the SSL setup.

## Step 8: Database Backup Strategy

### 8.1 Create backup directory
```bash
mkdir -p /home/campaignharvest/backups
```

### 8.2 Create backup script
```bash
nano /home/campaignharvest/backup.sh
```

Add the following content:
```bash
#!/bin/bash
BACKUP_DIR="/home/campaignharvest/backups"
DB_FILE="/home/campaignharvest/app/campaign_harvest.db"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Create backup
sqlite3 $DB_FILE ".backup $BACKUP_DIR/campaign_harvest_$TIMESTAMP.db"

# Keep only last 7 days of backups
find $BACKUP_DIR -name "campaign_harvest_*.db" -mtime +7 -delete
```

### 8.3 Make script executable and set up cron job
```bash
chmod +x /home/campaignharvest/backup.sh
crontab -e
```

Add this line to run daily backups at 2 AM:
```
0 2 * * * /home/campaignharvest/backup.sh
```

## Step 9: Security Hardening

### 9.1 Update the server.js file for production
Before deploying, make sure to:
1. Remove any console.log statements used for debugging
2. Add rate limiting
3. Add helmet for security headers

### 9.2 Set proper file permissions
```bash
chmod 600 /home/campaignharvest/app/campaign_harvest.db
chmod 700 /home/campaignharvest/backups
```

## Step 10: Monitoring

### 10.1 View application logs
```bash
pm2 logs campaignharvest
```

### 10.2 Monitor application status
```bash
pm2 status
pm2 monit
```

### 10.3 Set up PM2 web monitoring (optional)
```bash
pm2 install pm2-web
```

## Maintenance Commands

### Restart application
```bash
pm2 restart campaignharvest
```

### Update application
```bash
cd /home/campaignharvest/app
git pull  # if using git
npm install  # if dependencies changed
pm2 restart campaignharvest
```

### View Nginx logs
```bash
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

## Troubleshooting

### If the site is not accessible:
1. Check if the app is running: `pm2 status`
2. Check app logs: `pm2 logs`
3. Check Nginx status: `sudo systemctl status nginx`
4. Check firewall: `sudo ufw status`
5. Test locally: `curl http://localhost:3000`

### If you see 502 Bad Gateway:
1. Make sure the Node.js app is running
2. Check if port 3000 is correct in both server.js and Nginx config
3. Restart both PM2 and Nginx

## Important Notes

1. **Database Location**: The SQLite database file is at `/home/campaignharvest/app/campaign_harvest.db`
2. **Static Files**: All HTML, CSS, and JS files are served by the Node.js application
3. **Updates**: Always backup the database before updating the application
4. **Security**: Consider implementing:
   - API rate limiting
   - Input validation
   - CORS configuration
   - Environment variables for sensitive data

## Cost Estimation

- DigitalOcean Droplet: $6-12/month
- Domain name: $10-15/year (optional)
- SSL Certificate: Free with Let's Encrypt

Total: ~$6-12/month for hosting