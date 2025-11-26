# View Projects Page

## Overview

The projects page displays all projects the user has access to, with search, filter, and management capabilities.

## Route

`/dashboard/projects`

## Features

### Project Display

- **Grid View**
  - Project cards with thumbnails
  - 3-4 columns responsive
  - Visual preview of first page

- **List View**
  - Table format
  - More details visible
  - Compact display

- **View Toggle**
  - Switch between grid/list
  - Preference saved

### Project Card/Row Information

- Project thumbnail/preview
- Project name
- Description (truncated)
- Document count
- Last modified date
- Owner/creator
- Status badge (Active, Archived)
- Quick actions menu

### Search & Filter

- **Search Bar**
  - Search by name, description
  - Real-time filtering

- **Filters**
  - Status: Active, Archived, All
  - Category/Type
  - Tags (multi-select)
  - Date range
  - Owner/Creator

- **Sort Options**
  - Name (A-Z, Z-A)
  - Date created
  - Date modified
  - Document count

### Project Actions

- **Open** - Navigate to project/editor
- **Edit Details** - Modify project info
- **Duplicate** - Create copy
- **Archive/Unarchive** - Change status
- **Delete** - Remove project
- **Share** - Manage access

### Bulk Actions

- Select multiple projects
- Bulk archive
- Bulk delete
- Bulk tag assignment

### Empty State

- Shown when no projects exist
- "Create Your First Project" CTA
- Quick start guide link

### Pagination

- Page size options
- Page navigation
- Total count display

## UI Components

- Grid/list toggle
- Project cards
- Data table
- Search with filters
- Sort dropdown
- Pagination controls
- Empty state illustration

## API Endpoints

- `GET /api/projects` - List projects with pagination/filters
- `GET /api/projects/:id` - Get project details
- `PUT /api/projects/:id` - Update project
- `DELETE /api/projects/:id` - Delete project
- `POST /api/projects/:id/duplicate` - Duplicate project
- `PUT /api/projects/:id/archive` - Archive/unarchive

## Acceptance Criteria

- [ ] Projects display in grid and list views
- [ ] Search filters projects correctly
- [ ] Filters work independently and combined
- [ ] Sorting works on all options
- [ ] Pagination functions properly
- [ ] Quick actions work correctly
- [ ] Bulk actions apply to selected items
- [ ] Empty state shows for new users
- [ ] View preference is remembered
