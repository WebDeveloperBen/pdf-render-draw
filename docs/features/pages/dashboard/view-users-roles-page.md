# View User Roles Page

## Overview

The roles management page allows administrators to view, create, and configure user roles and their associated permissions.

## Route

`/dashboard/users/roles`

## Access

- Admin role required
- Organization owner access

## Features

### Roles List

- **Default Roles** (non-deletable)
  - Owner - Full access
  - Admin - Administrative access
  - Editor - Create and edit access
  - Viewer - Read-only access

- **Custom Roles**
  - User-created roles
  - Can be edited or deleted

- **Role Display**
  - Role name
  - Description
  - User count
  - Permission summary
  - Actions

### Role Details

- **Permissions Categories**
  - Projects: Create, Read, Update, Delete
  - Documents: Upload, View, Export, Delete
  - Annotations: Create, Edit, Delete, View Others
  - Users: View, Invite, Edit, Delete
  - Settings: View, Edit
  - Billing: View, Manage

- **Permission Matrix**
  - Checkbox grid for each permission
  - Category-level toggle (all/none)

### Role Actions

- **View** - See role details and permissions
- **Edit** - Modify role permissions (custom roles only)
- **Duplicate** - Create new role from existing
- **Delete** - Remove custom role

### Create New Role

- "Create Role" button
- Role name input
- Description textarea
- Permission selection
- Save/Cancel buttons

### Assign Role

- View users with each role
- Quick assign role to user
- Bulk role assignment

## UI Components

- Role cards or table
- Permission matrix grid
- Toggle switches for permissions
- Modal for create/edit
- User list within role

## API Endpoints

- `GET /api/roles` - List all roles
- `GET /api/roles/:id` - Get role details
- `POST /api/roles` - Create new role
- `PUT /api/roles/:id` - Update role
- `DELETE /api/roles/:id` - Delete role
- `GET /api/roles/:id/users` - Users with role

## Acceptance Criteria

- [ ] Default roles display correctly
- [ ] Custom roles can be created
- [ ] Permissions can be toggled
- [ ] Role changes affect user access immediately
- [ ] Cannot delete default roles
- [ ] Cannot delete role with assigned users
- [ ] Duplicate role creates new copy
- [ ] Permission matrix is clear and usable
