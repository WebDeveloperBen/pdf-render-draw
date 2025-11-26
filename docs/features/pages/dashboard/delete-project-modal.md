# Delete Project Modal

## Overview

The delete project modal provides a confirmation dialog before permanently removing a project and all its associated data.

## Trigger

- Delete action from project list
- Delete action from project details page
- Keyboard shortcut (if enabled)

## Features

### Confirmation Dialog

- **Warning Icon**
  - Red/danger colored icon
  - Visual emphasis on destructive action

- **Title**
  - "Delete Project"
  - Clear action statement

- **Message**
  - Project name highlighted
  - Warning about permanent deletion
  - List of what will be deleted:
    - All documents
    - All annotations
    - Project settings
    - Shared access links

### Confirmation Input

- **Type Project Name**
  - Required to enable delete button
  - Must match exactly
  - Prevents accidental deletion

### Action Buttons

- **Cancel**
  - Secondary/outline style
  - Closes modal, no action taken
  - Keyboard: Escape key

- **Delete Project**
  - Danger/red style
  - Disabled until confirmation typed
  - Loading state during deletion

### Deletion Process

1. User clicks delete on project
2. Modal opens with warning
3. User types project name to confirm
4. User clicks "Delete Project"
5. API call to delete project
6. On success: Close modal, show toast, redirect/refresh
7. On failure: Show error message

## UI Components

- Modal overlay
- Warning icon
- Confirmation text input
- Action buttons
- Loading spinner

## API Endpoints

- `DELETE /api/projects/:id` - Delete project

## Error Handling

- Network error: "Failed to delete. Please try again."
- Permission error: "You don't have permission to delete this project."
- Already deleted: "This project no longer exists."

## Acceptance Criteria

- [ ] Modal opens on delete action
- [ ] Warning message is clear
- [ ] Project name must be typed exactly
- [ ] Delete button disabled until confirmed
- [ ] Cancel closes without action
- [ ] Escape key closes modal
- [ ] Loading state during deletion
- [ ] Success redirects/refreshes appropriately
- [ ] Error messages display correctly
- [ ] Project is permanently removed
