# View Users Page

## Overview

The users management page allows administrators to view, search, and manage user accounts within the organization.

## Route

`/dashboard/users`

## Access

- Admin role required
- Organization owner access

## Features

### User List

- **Table Columns**
  - Avatar/Profile picture
  - Full name
  - Email address
  - Role (Admin, Editor, Viewer)
  - Status (Active, Inactive, Pending)
  - Last active date
  - Actions

- **Sorting**
  - Sort by any column
  - Ascending/descending toggle

- **Pagination**
  - Page size selector (10, 25, 50, 100)
  - Page navigation
  - Total count display

### Search & Filter

- **Search Bar**
  - Search by name or email
  - Real-time filtering

- **Filters**
  - Role filter dropdown
  - Status filter dropdown
  - Date range filter

### User Actions

- **View Profile** - Open user details
- **Edit User** - Modify user settings
- **Change Role** - Update user role
- **Deactivate/Activate** - Toggle user status
- **Delete User** - Remove user (with confirmation)
- **Resend Invitation** - For pending users

### Bulk Actions

- Select multiple users
- Bulk role change
- Bulk deactivate
- Bulk delete

### Invite Users

- "Invite User" button
- Opens invite modal
- Email input with validation
- Role selection
- Send invitation

## UI Components

- Data table with sorting
- Search input with filters
- Action dropdown menu
- Bulk action toolbar
- Pagination controls
- User avatar component

## API Endpoints

- `GET /api/users` - List users with pagination
- `GET /api/users/:id` - Get user details
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete user
- `POST /api/users/invite` - Invite new user
- `POST /api/users/:id/resend-invite` - Resend invitation

## Acceptance Criteria

- [ ] User list displays correctly
- [ ] Search filters users in real-time
- [ ] Sorting works on all columns
- [ ] Pagination functions properly
- [ ] Role changes are saved
- [ ] User deletion requires confirmation
- [ ] Bulk actions work correctly
- [ ] Invite sends email successfully
