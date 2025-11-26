# Confirm Email Page

## Overview

The email confirmation page handles email verification after registration or email change.

## Route

`/auth/confirm-email?token={token}`

## Features

### Confirmation States

- **Loading State**
  - Shown while verifying token
  - Spinner with "Verifying your email..." message

- **Success State**
  - Email verified successfully
  - "Your email has been confirmed" message
  - Auto-redirect to login after 3 seconds
  - Manual "Continue to Login" button

- **Error States**
  - Invalid token: "This verification link is invalid"
  - Expired token: "This verification link has expired"
  - Already verified: "This email has already been verified"
  - Resend option for expired tokens

### Token Validation

1. Extract token from URL query parameter
2. Send token to verification API
3. Display appropriate state based on response

### Resend Verification

- Available when token is expired
- Email input (pre-filled if known)
- Rate limited to prevent abuse

## UI Components

- Centered status display
- State-specific icons (checkmark, error, loading)
- Progress indicator for auto-redirect
- Action buttons based on state

## API Endpoints

- `POST /api/auth/verify-email` - Verify email token
- `POST /api/auth/resend-verification` - Resend verification email

## Acceptance Criteria

- [ ] Valid token confirms email
- [ ] Success redirects to login
- [ ] Invalid token shows error
- [ ] Expired token offers resend option
- [ ] Already verified shows appropriate message
- [ ] Loading state shown during verification
