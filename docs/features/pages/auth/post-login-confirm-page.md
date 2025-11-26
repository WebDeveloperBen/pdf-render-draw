# Post-Login Confirmation Page

## Overview

The post-login confirmation page handles additional verification steps after initial login, such as two-factor authentication or device confirmation.

## Route

`/auth/confirm`

## Features

### Two-Factor Authentication (2FA)

- **Code Input**
  - 6-digit verification code
  - Auto-submit on complete entry
  - Auto-focus on first input

- **Delivery Method Display**
  - Shows where code was sent (email/SMS/authenticator)
  - Partial masking of contact info

- **Resend Code**
  - Button to request new code
  - Cooldown timer between requests (60 seconds)

### Trust This Device

- Checkbox option to remember device
- Skips 2FA for trusted devices
- Can be managed in account settings

### Recovery Options

- "Use recovery code" link
- Links to support if locked out

### Flow

1. User completes initial login
2. Redirect to confirmation page
3. System sends verification code
4. User enters code
5. On success: Complete login, redirect to dashboard
6. On failure: Show error, allow retry

## UI Components

- Code input with individual digit boxes
- Timer for code expiration
- Resend button with cooldown
- Trust device checkbox
- Recovery options link

## API Endpoints

- `POST /api/auth/verify-2fa` - Verify 2FA code
- `POST /api/auth/resend-2fa` - Resend 2FA code
- `POST /api/auth/verify-recovery` - Use recovery code

## Security Features

- Codes expire after 5 minutes
- Limited retry attempts (5)
- Account lockout after max failures
- Secure code transmission

## Acceptance Criteria

- [ ] 2FA code input works correctly
- [ ] Auto-submit on complete code
- [ ] Resend code with cooldown
- [ ] Trust device option works
- [ ] Recovery code option available
- [ ] Proper error handling for invalid codes
- [ ] Redirects to dashboard on success
