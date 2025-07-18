# CampaignHarvest Deployment Checklist

## Pre-Deployment Checklist

- [ ] **DigitalOcean Droplet Created**
  - Ubuntu 22.04 LTS
  - At least 1GB RAM
  - SSH access configured

- [ ] **Domain Name (Optional)**
  - Domain purchased
  - DNS A records pointing to server IP

- [ ] **Local Preparation**
  - All changes committed (if using git)
  - Database has latest data
  - No sensitive information in code

## Deployment Steps

### 1. Server Setup (First Time Only)
- [ ] SSH into server as root
- [ ] Update system packages
- [ ] Create non-root user (campaignharvest)
- [ ] Configure firewall (ports 22, 80, 443)
- [ ] Install Node.js v18
- [ ] Install PM2
- [ ] Install Nginx
- [ ] Install SQLite3

### 2. Application Deployment
- [ ] Create app directory: `/home/campaignharvest/app`
- [ ] Upload all files including database using:
  - Option A: Use the `deploy.sh` script (recommended)
  - Option B: Manual SCP/rsync

### 3. Application Configuration
- [ ] Run `npm install` in app directory
- [ ] Create ecosystem.config.js (already included)
- [ ] Start app with PM2: `pm2 start ecosystem.config.js`
- [ ] Save PM2 configuration: `pm2 save`
- [ ] Set PM2 to start on boot: `pm2 startup`

### 4. Nginx Configuration
- [ ] Create Nginx config file
- [ ] Enable the site
- [ ] Test Nginx configuration
- [ ] Restart Nginx

### 5. SSL Setup (Recommended)
- [ ] Install Certbot
- [ ] Obtain SSL certificate
- [ ] Auto-renewal configured

### 6. Post-Deployment
- [ ] Test website access via IP/domain
- [ ] Check all pages load correctly
- [ ] Test project creation/editing
- [ ] Test milestone management
- [ ] Verify audit logs are working
- [ ] Set up database backups

## Quick Deployment Commands

For subsequent updates after initial deployment:

```bash
# From your local machine
cd "/Users/prashanthsirsi/Documents/CampaginHarvest Project Management"

# Option 1: Use deployment script
./deploy.sh
# Then select option 2 (Update application code)

# Option 2: Manual update
rsync -avz --exclude 'node_modules' --exclude '.git' \
      --exclude 'logs' --exclude 'backups' \
      ./ campaignharvest@your_server_ip:/home/campaignharvest/app/

# Then restart the app
ssh campaignharvest@your_server_ip "pm2 restart campaignharvest"
```

## Important Files on Server

- **Application**: `/home/campaignharvest/app/`
- **Database**: `/home/campaignharvest/app/campaign_harvest.db`
- **Logs**: `/home/campaignharvest/app/logs/`
- **Backups**: `/home/campaignharvest/backups/`
- **Nginx Config**: `/etc/nginx/sites-available/campaignharvest`

## Monitoring Commands

```bash
# Check app status
pm2 status

# View logs
pm2 logs campaignharvest

# Monitor resources
pm2 monit

# Check Nginx
sudo systemctl status nginx

# Database size
ls -lh campaign_harvest.db
```

## Troubleshooting

If site is not accessible:
1. Check PM2: `pm2 status`
2. Check logs: `pm2 logs`
3. Check Nginx: `sudo nginx -t`
4. Check firewall: `sudo ufw status`
5. Test locally: `curl http://localhost:3000`

## Security Notes

- Database permissions: `chmod 600 campaign_harvest.db`
- Regular backups are essential
- Keep system updated: `apt update && apt upgrade`
- Monitor logs for suspicious activity