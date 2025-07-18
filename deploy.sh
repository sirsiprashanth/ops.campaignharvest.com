#!/bin/bash

# CampaignHarvest Deployment Script
# This script helps automate the deployment process

echo "🚀 CampaignHarvest Deployment Script"
echo "===================================="

# Configuration
SERVER_USER="campaignharvest"
SERVER_IP="your_server_ip"  # Replace with your actual server IP
APP_DIR="/home/campaignharvest/app"
LOCAL_DIR="."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}!${NC} $1"
}

# Check if server IP is configured
if [ "$SERVER_IP" = "your_server_ip" ]; then
    print_error "Please configure SERVER_IP in this script with your actual server IP"
    exit 1
fi

# Menu
echo ""
echo "What would you like to do?"
echo "1) Initial deployment (first time)"
echo "2) Update application code"
echo "3) View application logs"
echo "4) Restart application"
echo "5) Backup database"
echo "6) Exit"
echo ""
read -p "Enter your choice (1-6): " choice

case $choice in
    1)
        echo ""
        print_status "Starting initial deployment..."
        
        # Create logs directory locally
        mkdir -p logs
        
        # Upload files (including database for initial deployment)
        print_status "Uploading files to server..."
        rsync -avz --exclude 'node_modules' --exclude '.git' \
              --exclude 'logs' --exclude 'backups' \
              $LOCAL_DIR/ $SERVER_USER@$SERVER_IP:$APP_DIR/
        
        # Run server commands
        print_status "Installing dependencies and starting application..."
        ssh $SERVER_USER@$SERVER_IP << 'ENDSSH'
            cd /home/campaignharvest/app
            npm install
            mkdir -p logs
            pm2 start ecosystem.config.js
            pm2 save
            pm2 startup systemd -u campaignharvest --hp /home/campaignharvest
            echo "✓ Application deployed and started!"
ENDSSH
        ;;
        
    2)
        echo ""
        print_status "Updating application code..."
        
        # Upload files (excluding node_modules and database)
        rsync -avz --exclude 'node_modules' --exclude '*.db' --exclude '.git' \
              --exclude 'logs' --exclude 'backups' \
              $LOCAL_DIR/ $SERVER_USER@$SERVER_IP:$APP_DIR/
        
        # Restart application
        ssh $SERVER_USER@$SERVER_IP "cd $APP_DIR && pm2 restart campaignharvest"
        print_status "Application updated and restarted!"
        ;;
        
    3)
        echo ""
        print_status "Viewing application logs..."
        ssh $SERVER_USER@$SERVER_IP "pm2 logs campaignharvest --lines 50"
        ;;
        
    4)
        echo ""
        print_status "Restarting application..."
        ssh $SERVER_USER@$SERVER_IP "pm2 restart campaignharvest"
        print_status "Application restarted!"
        ;;
        
    5)
        echo ""
        print_status "Creating database backup..."
        TIMESTAMP=$(date +%Y%m%d_%H%M%S)
        ssh $SERVER_USER@$SERVER_IP << ENDSSH
            mkdir -p /home/campaignharvest/backups
            cd /home/campaignharvest/app
            sqlite3 campaign_harvest.db ".backup /home/campaignharvest/backups/campaign_harvest_$TIMESTAMP.db"
            echo "✓ Backup created: campaign_harvest_$TIMESTAMP.db"
ENDSSH
        ;;
        
    6)
        echo ""
        print_status "Exiting..."
        exit 0
        ;;
        
    *)
        print_error "Invalid choice. Please run the script again."
        exit 1
        ;;
esac

echo ""
print_status "Done!"