# Register Page

## Overview

The registration page allows new users to create an account.

## Route

`/auth/register`

## Features

### Registration Form

- **Full Name Input**
  - Required field
  - Minimum 2 characters

- **Email Input**
  - Required field
  - Email format validation
  - Check for existing accounts

- **Password Input**
  - Required field
  - Minimum 8 characters
  - Must contain: uppercase, lowercase, number
  - Password strength indicator

- **Confirm Password Input**
  - Required field
  - Must match password field

- **Terms & Conditions**
  - Required checkbox
  - Link to terms document

- **Submit Button**
  - Disabled until form is valid
  - Loading state during registration

### Navigation Links

- "Already have an account?" - Links to `/auth/login`

### Registration Flow

1. User fills out registration form
2. Client-side validation
3. Submit to registration API
4. On success: Send verification email, redirect to confirm page
5. On failure: Display error message

### Validation Rules

- Email must be unique in system
- Password strength requirements enforced
- All required fields must be completed

## UI Components

- Form container with centered layout
- Application logo/branding
- Input fields with validation states
- Password strength meter
- Terms checkbox with link
- Toast notifications for errors

## API Endpoints

- `POST /api/auth/register` - Create new user account
- `GET /api/auth/check-email` - Check if email exists

## Acceptance Criteria

- [ ] User can register with valid information
- [ ] Email uniqueness is validated
- [ ] Password strength indicator works
- [ ] Passwords must match
- [ ] Terms must be accepted
- [ ] Verification email is sent
- [ ] Redirects to confirmation page on success
