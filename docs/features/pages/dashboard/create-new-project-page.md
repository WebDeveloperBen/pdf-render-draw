# Create New Project Page

## Overview

The create project page/modal allows users to set up a new project with documents for annotation.

## Route

`/dashboard/projects/new` or Modal on `/dashboard`

## Features

### Project Details Form

- **Project Name**
  - Required field
  - Max 100 characters
  - Unique within organization

- **Description**
  - Optional textarea
  - Max 500 characters
  - Supports basic formatting

- **Project Type/Category**
  - Dropdown selection
  - Options: Construction, Architecture, Engineering, Survey, Other
  - Custom categories if enabled

- **Tags**
  - Multi-select tag input
  - Create new tags inline
  - Suggestions from existing tags

### Document Upload

- **Drag & Drop Zone**
  - Visual drop area
  - Accepts PDF files
  - Multiple file upload

- **File Browser**
  - "Browse Files" button
  - File type filter (PDF only)
  - Multiple selection

- **Upload Progress**
  - Individual file progress bars
  - Overall upload progress
  - Cancel upload option
  - Error handling per file

- **File Validation**
  - Max file size (e.g., 100MB)
  - PDF format only
  - Page count limits (if any)

### Project Settings

- **Default Scale**
  - Scale preset selection
  - Custom scale option

- **Measurement Units**
  - Metric (mm, cm, m)
  - Imperial (in, ft)

- **Collaboration Settings**
  - Private (owner only)
  - Team (organization members)
  - Shared (specific users)

### Actions

- **Create Project** - Submit and create
- **Create & Open** - Create and navigate to editor
- **Cancel** - Discard and return

## UI Components

- Multi-step form or single page
- Drag & drop upload zone
- File list with progress
- Tag input component
- Settings toggles
- Action buttons

## API Endpoints

- `POST /api/projects` - Create project
- `POST /api/projects/:id/documents` - Upload documents
- `GET /api/tags` - Get available tags
- `POST /api/tags` - Create new tag

## Validation

- Project name required and unique
- At least one document required
- Valid PDF files only
- File size within limits

## Acceptance Criteria

- [ ] Project can be created with valid data
- [ ] Drag & drop upload works
- [ ] File browser upload works
- [ ] Multiple files can be uploaded
- [ ] Upload progress displays correctly
- [ ] Invalid files are rejected with message
- [ ] Tags can be added/created
- [ ] Settings are saved correctly
- [ ] Redirects to project/editor on success
