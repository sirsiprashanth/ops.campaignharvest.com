# CampaignHarvest Project Management System

A modern project management system with SQLite database backend.

## Quick Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start the server:**
   ```bash
   npm start
   ```
   Or for development with auto-reload:
   ```bash
   npm run dev
   ```

3. **Access the application:**
   - Admin Dashboard: http://localhost:3000/admin
   - Home Page: http://localhost:3000/
   - Individual Project Pages: http://localhost:3000/project?id=PROJECT_ID

## Features

- **SQLite Database**: All data is stored in `campaign_harvest.db`
- **RESTful API**: Complete CRUD operations for projects, milestones, and messages
- **Admin Dashboard**: Manage multiple projects, milestones, and client communications
- **Client Portal**: Individual project pages with milestone tracking and messaging
- **Real-time Updates**: Changes reflect immediately across all views
- **Responsive Design**: Works on all devices
- **Dark/Light Mode**: Theme preference is saved

## Database Schema

The SQLite database includes three tables:
- `projects`: Project information
- `milestones`: Project milestones
- `messages`: Client-admin communication

## API Endpoints

- `GET /api/projects` - Get all projects
- `GET /api/projects/:id` - Get single project with details
- `POST /api/projects` - Create new project
- `PUT /api/projects/:id` - Update project
- `DELETE /api/projects/:id` - Delete project
- `POST /api/projects/:id/milestones` - Add milestone
- `PUT /api/milestones/:id` - Update milestone
- `DELETE /api/milestones/:id` - Delete milestone
- `GET /api/messages` - Get all messages
- `POST /api/projects/:id/messages` - Send message
- `GET /api/analytics` - Get analytics data

## Notes

- The database file (`campaign_harvest.db`) is created automatically on first run
- All data persists between server restarts
- The server runs on port 3000 by default (configurable via PORT environment variable)