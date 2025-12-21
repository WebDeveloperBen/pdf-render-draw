# Platform Initialization

This document covers the initial setup of the platform, including database migrations and platform owner configuration.

## Quick Start

```bash
# 1. Install dependencies
pnpm install

# 2. Set up environment variables
cp .env.example .env
# Edit .env with your DATABASE_URL and other settings

# 3. Run database migrations
pnpm db:migrate

# 4. Start the application and register your owner account
pnpm dev
# Navigate to /register and create your account

# 5. Promote your account to platform owner
PLATFORM_OWNER_EMAIL=your@email.com pnpm db:seed-owner
```

---

## Platform Admin System

The platform uses a tiered platform admin system separate from organization roles.

### Two-Layer Permission Model

| Layer | Storage | Values | Purpose |
|-------|---------|--------|---------|
| **Platform Admin** | `platform_admin` table | owner, admin, support, viewer | Platform staff - platform oversight |
| **Organization Roles** | `member.role` column | owner, admin, member | Per-organization access |

### Platform Admin Tier Hierarchy

```
owner (1)     - Singular, full control, manages platform admins
   ↓
admin (many)  - Full platform access, can delete users/orgs
   ↓
support (many) - Help users, impersonate, ban/unban, view data
   ↓
viewer (many)  - Read-only dashboards and reports
```

### Tier Capabilities Matrix

| Capability | Viewer | Support | Admin | Owner |
|------------|:------:|:-------:|:-----:|:-----:|
| View dashboard stats | ✓ | ✓ | ✓ | ✓ |
| View all users/orgs/projects | ✓ | ✓ | ✓ | ✓ |
| View audit logs | ✓ | ✓ | ✓ | ✓ |
| Ban/unban users | | ✓ | ✓ | ✓ |
| Impersonate users | | ✓ | ✓ | ✓ |
| Delete users/orgs | | | ✓ | ✓ |
| Grant/revoke platform admin | | | | ✓ |
| Change admin tiers | | | | ✓ |

---

## Initial Setup Sequence

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        PLATFORM INITIALIZATION FLOW                          │
└─────────────────────────────────────────────────────────────────────────────┘

┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│ Developer│     │ Database │     │   App    │     │  Seed    │     │  Admin   │
│          │     │          │     │          │     │  Script  │     │  Panel   │
└────┬─────┘     └────┬─────┘     └────┬─────┘     └────┬─────┘     └────┬─────┘
     │                │                │                │                │
     │  1. pnpm db:migrate             │                │                │
     │───────────────>│                │                │                │
     │                │                │                │                │
     │  Creates tables│                │                │                │
     │  - platform_admin               │                │                │
     │  - admin_audit_log              │                │                │
     │<───────────────│                │                │                │
     │                │                │                │                │
     │  2. pnpm dev                    │                │                │
     │────────────────────────────────>│                │                │
     │                │                │                │                │
     │  3. Register account at /register                │                │
     │────────────────────────────────>│                │                │
     │                │                │                │                │
     │                │  Creates user  │                │                │
     │                │<───────────────│                │                │
     │                │                │                │                │
     │  4. PLATFORM_OWNER_EMAIL=x pnpm db:seed-owner   │                │
     │─────────────────────────────────────────────────>│                │
     │                │                │                │                │
     │                │  Find user by email             │                │
     │                │<────────────────────────────────│                │
     │                │                │                │                │
     │                │  Insert platform_admin          │                │
     │                │  tier='owner'                   │                │
     │                │<────────────────────────────────│                │
     │                │                │                │                │
     │  Owner created!│                │                │                │
     │<─────────────────────────────────────────────────│                │
     │                │                │                │                │
     │  5. Navigate to /admin                           │                │
     │─────────────────────────────────────────────────────────────────>│
     │                │                │                │                │
     │                │                │  Check platform_admin table    │
     │                │<────────────────────────────────────────────────│
     │                │                │                │                │
     │  Admin panel access granted     │                │                │
     │<─────────────────────────────────────────────────────────────────│
     │                │                │                │                │
     ▼                ▼                ▼                ▼                ▼
```

---

## Detailed Setup Steps

### Step 1: Database Migration

Run migrations to create the platform admin tables:

```bash
pnpm db:migrate
```

This creates:
- `platform_admin` - Stores platform admin users with their tier
- `admin_audit_log` - Tracks all admin actions for auditing

### Step 2: Register Owner Account

Start the development server and register an account:

```bash
pnpm dev
```

Navigate to `http://localhost:3000/register` and create your account with:
- First Name
- Last Name
- Email (this will be your owner email)
- Password

### Step 3: Promote to Platform Owner

Run the seed script to promote your account:

```bash
PLATFORM_OWNER_EMAIL=your@email.com pnpm db:seed-owner
```

**Output on success:**
```
Seeding platform owner with email: your@email.com
Found user: Your Name (user-id-here)
Successfully created platform owner!
  User: Your Name
  Email: your@email.com
  Tier: owner
```

**Important:** There can only be ONE owner. The script will fail if an owner already exists.

### Step 4: Access Admin Panel

Navigate to `http://localhost:3000/admin` to access the admin panel.

As the owner, you can:
- View all platform statistics
- Manage users and organizations
- View audit logs
- **Promote other users to platform admins** (owner-only)

---

## Promoting Additional Admins

Once logged in as the owner, navigate to `/admin/platform-admins` to:

1. **Grant access**: Add new platform admins with viewer/support/admin tiers
2. **Change tiers**: Upgrade or downgrade existing admins
3. **Revoke access**: Remove platform admin privileges

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      PROMOTING PLATFORM ADMINS (UI)                          │
└─────────────────────────────────────────────────────────────────────────────┘

┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  Owner   │     │  Admin   │     │  API     │     │ Database │
│  (UI)    │     │  Panel   │     │          │     │          │
└────┬─────┘     └────┬─────┘     └────┬─────┘     └────┬─────┘
     │                │                │                │
     │  Select user to promote         │                │
     │───────────────>│                │                │
     │                │                │                │
     │  Choose tier (admin/support/viewer)              │
     │───────────────>│                │                │
     │                │                │                │
     │                │  POST /api/auth/platform-admin/grant
     │                │───────────────>│                │
     │                │                │                │
     │                │                │  Verify owner  │
     │                │                │───────────────>│
     │                │                │                │
     │                │                │  Insert record │
     │                │                │───────────────>│
     │                │                │                │
     │                │                │  Log action    │
     │                │                │───────────────>│
     │                │                │                │
     │  Success!      │                │                │
     │<───────────────│<───────────────│<───────────────│
     │                │                │                │
     ▼                ▼                ▼                ▼
```

---

## API Endpoints

The platform admin plugin exposes these endpoints:

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| GET | `/api/auth/platform-admin/me` | Any user | Get current user's admin status |
| GET | `/api/auth/platform-admin/list` | Viewer+ | List all platform admins |
| POST | `/api/auth/platform-admin/grant` | Owner only | Grant admin access |
| POST | `/api/auth/platform-admin/update-tier` | Owner only | Change admin tier |
| POST | `/api/auth/platform-admin/revoke` | Owner only | Revoke admin access |
| GET | `/api/auth/platform-admin/audit-log` | Viewer+ | View audit log |

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `PLATFORM_OWNER_EMAIL` | For seed | Email of initial platform owner |

---

## Troubleshooting

### "User not found" when running seed script

The user must register first before running the seed script. The script looks up users by email in the database.

### "A platform owner already exists"

There can only be one owner. If you need to change the owner, you must:
1. Manually update the database to remove the existing owner
2. Run the seed script again

```sql
-- Remove existing owner (use with caution!)
DELETE FROM platform_admin WHERE tier = 'owner';
```

### "Platform admin access required" when accessing /admin

Ensure you:
1. Are logged in with the correct account
2. Have run the seed script successfully
3. The `platform_admin` table has your user record

Check your status:
```sql
SELECT pa.*, u.email
FROM platform_admin pa
JOIN "user" u ON pa.user_id = u.id;
```

---

## Database Schema

### platform_admin table

| Column | Type | Description |
|--------|------|-------------|
| id | text | Primary key |
| user_id | text | FK to user.id (unique) |
| tier | text | owner/admin/support/viewer |
| granted_by | text | FK to user.id (who granted) |
| granted_at | timestamp | When access was granted |
| notes | text | Optional notes |
| created_at | timestamp | Record creation time |
| updated_at | timestamp | Last update time |

### admin_audit_log table

| Column | Type | Description |
|--------|------|-------------|
| id | text | Primary key |
| admin_id | text | FK to user.id (who performed action) |
| action_type | text | Type of action performed |
| target_user_id | text | Affected user (if applicable) |
| target_org_id | text | Affected org (if applicable) |
| metadata | text | JSON additional data |
| ip_address | text | Request IP |
| user_agent | text | Request user agent |
| created_at | timestamp | When action occurred |
