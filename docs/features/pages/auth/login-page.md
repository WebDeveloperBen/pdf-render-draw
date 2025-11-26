# Login Page

## Overview

The login page allows existing users to authenticate and access the application.

## Route

`/auth/login`

## Features

### Authentication Form

- **Email Input**
  - Required field
  - Email format validation
  - Auto-focus on page load

- **Password Input**
  - Required field
  - Minimum length validation
  - Show/hide password toggle

- **Remember Me**
  - Checkbox to persist session
  - Extends session duration when checked

- **Submit Button**
  - Disabled until form is valid
  - Loading state during authentication
  - Error handling with user-friendly messages

### Navigation Links

- "Forgot Password?" - Links to `/auth/forgot-password`
- "Create Account" - Links to `/auth/register`

### Authentication Flow

1. User enters credentials
2. Client-side validation
3. Submit to authentication API
4. On success: Redirect to dashboard or intended destination
5. On failure: Display error message (invalid credentials, account locked, etc.)

### Security Features

- Rate limiting on failed attempts
- CSRF protection
- Secure password transmission (HTTPS)
- Session token management

## UI Components

- Form container with centered layout
- Application logo/branding
- Input fields with validation states
- Toast notifications for errors
- Loading spinner/overlay

## API Endpoints

- `POST /api/auth/login` - Authenticate user

## Acceptance Criteria

- [ ] User can log in with valid credentials
- [ ] Invalid credentials show appropriate error
- [ ] Form validates email format
- [ ] Password field has show/hide toggle
- [ ] Remember me extends session
- [ ] Redirects to dashboard on success
- [ ] Loading state prevents double submission
