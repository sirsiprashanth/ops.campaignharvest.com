#\!/bin/bash

# CampaignHarvest Deployment Update Script
echo "🚀 Starting CampaignHarvest deployment update..."

# Pull latest changes
echo "📥 Pulling latest changes from GitHub..."
git pull origin main

# Install/update dependencies
echo "📦 Installing dependencies..."
npm install --production

# Restart application with PM2
echo "🔄 Restarting application..."
pm2 restart campaignharvest-app

# Check application status
echo "✅ Checking application status..."
pm2 status campaignharvest-app

# Test application
echo "🧪 Testing application..."
sleep 5
curl -f http://localhost:3000/ > /dev/null && echo "✅ Application is running successfully\!" || echo "❌ Application test failed\!"

echo "🎉 Deployment update completed\!"
