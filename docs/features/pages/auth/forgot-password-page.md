# Forgot Password Page

## Overview

The forgot password page allows users to request a password reset link via email.

## Route

`/auth/forgot-password`

## Features

### Reset Request Form

- **Email Input**
  - Required field
  - Email format validation
  - Auto-focus on page load

- **Submit Button**
  - Disabled until email is valid
  - Loading state during submission

### Flow

1. User enters email address
2. Client-side email validation
3. Submit to password reset API
4. Display success message (regardless of email existence for security)
5. If email exists: Send reset link to user's email

### Security Considerations

- Always show success message to prevent email enumeration
- Rate limit reset requests per email
- Reset tokens expire after 1 hour
- Single-use tokens (invalidated after use)

### Navigation Links

- "Back to Login" - Links to `/auth/login`
- "Create Account" - Links to `/auth/register`

## UI Components

- Form container with centered layout
- Application logo/branding
- Email input with validation
- Success message display
- Instructions text

## API Endpoints

- `POST /api/auth/forgot-password` - Request password reset

## Email Template

Reset email should include:
- User's name
- Reset link with secure token
- Expiration notice (1 hour)
- Instructions
- Security notice (ignore if not requested)

## Acceptance Criteria

- [ ] User can submit email for reset
- [ ] Success message shown after submission
- [ ] Email validation works
- [ ] Rate limiting prevents abuse
- [ ] Reset email is sent for valid accounts
- [ ] Reset link expires after 1 hour
