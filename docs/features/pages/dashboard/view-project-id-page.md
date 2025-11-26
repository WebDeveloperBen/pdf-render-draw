# View Project Details Page

## Overview

The project details page shows comprehensive information about a specific project, its documents, and provides access to the editor.

## Route

`/dashboard/projects/:id`

## Features

### Project Header

- Project name (editable inline)
- Description
- Status badge
- Created/Modified dates
- Owner information
- Action buttons: Edit, Share, Archive, Delete

### Document List

- **Document Cards/List**
  - Thumbnail preview
  - Document name
  - Page count
  - File size
  - Upload date
  - Annotation count

- **Document Actions**
  - Open in Editor
  - Download original
  - Replace document
  - Delete document

- **Add Documents**
  - Upload new documents
  - Drag & drop support

### Project Statistics

- Total documents
- Total pages
- Total annotations by type
- Storage used
- Last activity

### Activity Timeline

- Recent changes
- Who made changes
- Annotation additions/edits
- Document uploads
- Timestamp for each

### Collaboration

- **Team Members**
  - List of users with access
  - Role/permission level
  - Add/remove members

- **Share Settings**
  - Visibility toggle
  - Generate share link
  - Permission levels for shared users

### Project Settings

- Default measurement scale
- Unit preferences
- Category/tags
- Archive status

### Annotations Summary

- Count by type (Measure, Area, Count, etc.)
- Export annotations data
- Clear all annotations option

## UI Components

- Project header with inline edit
- Document grid/list
- Upload dropzone
- Stats cards
- Activity feed
- Team member list
- Settings panel

## API Endpoints

- `GET /api/projects/:id` - Project details
- `PUT /api/projects/:id` - Update project
- `DELETE /api/projects/:id` - Delete project
- `GET /api/projects/:id/documents` - List documents
- `POST /api/projects/:id/documents` - Upload document
- `DELETE /api/projects/:id/documents/:docId` - Delete document
- `GET /api/projects/:id/activity` - Activity feed
- `GET /api/projects/:id/members` - Team members
- `POST /api/projects/:id/members` - Add member
- `GET /api/projects/:id/stats` - Project statistics

## Acceptance Criteria

- [ ] Project details display correctly
- [ ] Inline editing works
- [ ] Documents list with thumbnails
- [ ] Document upload works
- [ ] Document actions function correctly
- [ ] Statistics are accurate
- [ ] Activity timeline shows recent changes
- [ ] Team management works
- [ ] Share link can be generated
- [ ] Settings can be modified
