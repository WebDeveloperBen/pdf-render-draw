# Support Page

## Overview

The support page provides users with help resources, documentation, and contact options for assistance.

## Route

`/dashboard/support`

## Features

### Help Center

- **Search Bar**
  - Search across all help articles
  - Auto-suggest as user types
  - Recent searches

- **FAQ Section**
  - Expandable accordion items
  - Categories: Getting Started, Projects, Editor, Account, Billing
  - Most viewed articles highlighted

### Documentation Links

- User Guide
- Video Tutorials
- API Documentation (for developers)
- Release Notes

### Contact Support

- **Support Ticket Form**
  - Subject line
  - Category dropdown
  - Description textarea
  - File attachment (screenshots)
  - Priority level
  - Submit button

- **Live Chat** (if available)
  - Chat widget integration
  - Operating hours display
  - Queue position indicator

- **Email Support**
  - Direct email link
  - Expected response time

### System Status

- Service status indicator
- Recent incidents (if any)
- Scheduled maintenance notices
- Link to status page

### Community

- Link to community forum
- Feature request board
- User feedback submission

## UI Components

- Search bar with suggestions
- Accordion FAQ list
- Contact form with validation
- Status badges
- Card-based layout for sections

## API Endpoints

- `GET /api/support/faq` - FAQ articles
- `GET /api/support/search` - Search help articles
- `POST /api/support/ticket` - Create support ticket
- `GET /api/system/status` - System status

## Acceptance Criteria

- [ ] FAQ search works correctly
- [ ] Support ticket submission works
- [ ] File attachments upload successfully
- [ ] System status displays accurately
- [ ] Links to external resources work
- [ ] Live chat integrates properly (if enabled)
