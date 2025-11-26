# Dashboard Main Page

## Overview

The main dashboard page serves as the home screen after login, providing an overview of recent activity and quick access to key features.

## Route

`/dashboard`

## Features

### Welcome Section

- Personalized greeting with user's name
- Current date/time
- Quick stats summary

### Recent Projects

- List of recently accessed projects (5-10 items)
- Project thumbnail preview
- Last modified date
- Quick actions: Open, Edit, Delete
- "View All Projects" link

### Quick Actions

- Create New Project button
- Upload Document button
- Recent Templates (if applicable)

### Activity Feed

- Recent annotations and edits
- Team activity (if collaborative)
- System notifications

### Statistics Overview

- Total projects count
- Documents processed this month
- Storage usage
- Annotations created

### Navigation Sidebar

- Dashboard (active)
- Projects
- Templates
- Team/Users (admin only)
- Settings
- Support

## UI Components

- Dashboard layout with sidebar
- Stats cards with icons
- Project list/grid view toggle
- Activity timeline
- Quick action buttons

## API Endpoints

- `GET /api/dashboard/stats` - Dashboard statistics
- `GET /api/projects/recent` - Recent projects
- `GET /api/activity/feed` - Activity feed

## Acceptance Criteria

- [ ] Dashboard loads with user's data
- [ ] Recent projects displayed correctly
- [ ] Quick actions are functional
- [ ] Stats update in real-time
- [ ] Navigation to all sections works
- [ ] Responsive layout for mobile
