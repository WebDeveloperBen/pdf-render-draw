# Migration Report: Old (MetreMate) → New (PDF Render Draw)

## Scope

Migrate **everything except annotations**. Annotations are excluded due to the complexity of coordinate system differences (DPR normalization), JSONB content reshaping, and the Konva → SVG rendering paradigm shift. Annotation migration details are preserved in Appendix A for future reference.

The annotation analysis remains valuable context — if we decide to tackle it later, the plan is documented.

---

## Entity Mapping Overview

| Old Table | New Table | Action |
|-----------|-----------|--------|
| `users` | `user` + `account` | Migrate (reshape for Better Auth) |
| `projects` | `project` | Migrate (field renames + restructure) |
| `project_documents` | `project_file` | Migrate (field renames) |
| `clients` | Embedded in `project` | Merge client data into project fields |
| `project_clients` | N/A | Used to resolve client → project mapping |
| `project_users` | `member` (via org) | Migrate as org membership |
| `project_users_roles` | `member.role` | Merge into member records |
| `roles` | N/A | Hardcoded in new system |
| `project_tags` | `project.tags` (jsonb) | Flatten into project jsonb array |
| `annotations` | `annotation` | **EXCLUDED** |
| `audit_logs` | `admin_audit_log` | Skip (start fresh) |
| `support` | N/A | Skip (no equivalent) |
| `testimonials` | N/A | Skip (not needed) |
| `faq_articles` | N/A | Skip (not needed) |
| `feature_flags` | N/A | Skip (not needed) |
| `system_settings` | N/A | Skip (not needed) |

---

## Migration Details by Entity

### 1. Users → `user` + `account`

The new system uses [Better Auth](https://better-auth.com) which expects a `user` table and an `account` table for credential storage.

**Old `users` columns → New `user` columns:**

| Old | New | Notes |
|-----|-----|-------|
| `user_id` (uuid) | `id` (text) | Cast uuid to text |
| `name` | `name` | Direct copy |
| `email` | `email` | Direct copy |
| — | `emailVerified` | Default `true` (existing users are verified) |
| — | `image` | Default `null` |
| `created_at` | `createdAt` | Direct copy |
| `updated_at` | `updatedAt` | Direct copy |
| `role` | `role` | Direct copy |
| — | `banned` | Default `false` |
| — | `isGuest` | Default `false` |

**Dropped old columns** (no equivalent in new system):
- `stripe_customer_id` — billing not migrated yet
- `gender`, `profession`, `bio`, `profile_url` — not in new schema
- `active`, `subscription_ends`, `subscription_status` — billing
- `accepted_terms` — re-accept on new platform
- `company`, `phone` — not in new user schema
- `default_unit`, `default_scale`, `date_format` — user preferences (can be added later)
- `country`, `country_code`, `signup_ip` — analytics data

**`account` table** (one per user for credential login):

Each migrated user needs an `account` record so they can log in. Since we don't have password hashes from the old system (Supabase Auth managed those separately), users will need to **reset their password** on the new platform, or we use a magic-link/OAuth flow initially.

| Field | Value |
|-------|-------|
| `id` | Generated (nanoid) |
| `accountId` | Same as `user.id` |
| `providerId` | `'credential'` |
| `userId` | FK to migrated `user.id` |
| `password` | `null` (force password reset) |
| `createdAt` | Same as user's `created_at` |

### 2. Projects → `project`

| Old | New | Notes |
|-----|-----|-------|
| `project_id` (uuid) | `id` (text) | Cast uuid to text |
| `project_name` | `name` | Direct copy |
| `project_description` | `description` | Direct copy |
| — | `reference` | Default `null` |
| — | `category` | Default `null` |
| `client_name` | `clientName` | Direct copy |
| — | `clientEmail` | Populated from `clients` join |
| — | `clientPhone` | Populated from `clients` join |
| `project_image` | — | Dropped (thumbnails generated differently) |
| `owner_id` | `createdBy` | Cast uuid to text |
| `created_at` | `createdAt` | Direct copy |
| `updated_at` | `updatedAt` | Direct copy |
| — | `organizationId` | Set after org creation |
| — | `priority` | Default `'normal'` |
| — | `tags` | Default `'[]'::jsonb` |
| — | `annotationCount` | Default `0` |
| — | `pageCount` | Default `0` (deprecated field) |

**Client data merge:** The old system has a separate `clients` table joined via `project_clients`. We need to resolve the client for each project and embed `clientEmail` and `clientPhone` into the project record.

### 3. Project Documents → `project_file`

| Old | New | Notes |
|-----|-----|-------|
| `document_id` (uuid) | `id` (text) | Cast uuid to text |
| `project_id` | `projectId` | Cast uuid to text |
| `document_url` | `pdfUrl` | Direct copy |
| `name` | `pdfFileName` | Direct copy |
| `size` | `pdfFileSize` | Direct copy (bigint → integer, check overflow) |
| `num_pages` | `pageCount` | Direct copy |
| `owner_id` | `uploadedBy` | Cast uuid to text |
| `created_at` | `createdAt` | Direct copy |
| `updated_at` | `updatedAt` | Direct copy |
| — | `annotationCount` | Default `0` |

### 4. Organizations & Membership

The new system uses organizations for multi-tenancy. The old system has no org concept, so we need to **create one org per user** (or one shared org if that's the business model).

**Strategy: One org per project owner.**

1. For each distinct `owner_id` in `projects`, create an `organization` record
2. Create a `member` record with `role: 'owner'` for that user
3. For each `project_users` record, create a `member` record with appropriate role
4. Map old roles: look up `project_users_roles.role` → new role string

| Old `roles` | New `member.role` |
|-------------|-------------------|
| Admin (1?) | `'admin'` |
| Editor (2?) | `'member'` |
| Viewer (3?) | `'member'` |

*(Adjust based on actual role IDs in old data)*

### 5. Project Tags

Old system has a separate `project_tags` table with `id`, `content`, `color`. New system stores tags as a jsonb array on the project: `["tag1", "tag2"]`.

**Issue:** There's no `project_project_tags` join table in the old schema, so it's unclear how tags were linked to projects. If tags were stored as a relationship, we need the join table. If they were global/unused, skip this.

---

## SQL Migration Scripts

### Step 0: Export from old Supabase

```bash
# Pull data from old Supabase as CSV or use pg_dump
pg_dump --data-only --table=users --table=projects --table=project_documents \
  --table=clients --table=project_clients --table=project_users \
  --table=project_users_roles --table=roles \
  -f old_data_dump.sql "postgresql://..."
```

Or export individual tables as CSV from Supabase dashboard.

### Step 1: Create staging tables

Load old data into staging tables in the new database so we can transform in SQL.

```sql
-- Staging schema to hold old data without conflicting with new tables
CREATE SCHEMA IF NOT EXISTS staging;

CREATE TABLE staging.users (
  user_id uuid PRIMARY KEY,
  name text,
  email text,
  created_at timestamptz,
  updated_at timestamptz,
  role text DEFAULT 'user',
  company text,
  phone text,
  active boolean DEFAULT false,
  default_unit text,
  default_scale text,
  date_format text
);

CREATE TABLE staging.projects (
  project_id uuid PRIMARY KEY,
  project_name text NOT NULL,
  project_description text,
  project_image text,
  client_name text,
  owner_id uuid,
  created_at timestamptz,
  updated_at timestamptz
);

CREATE TABLE staging.clients (
  client_id uuid PRIMARY KEY,
  name text,
  phone varchar,
  email varchar,
  created_at timestamptz,
  updated_at timestamptz
);

CREATE TABLE staging.project_clients (
  project_clients_id uuid PRIMARY KEY,
  project_id uuid NOT NULL,
  client_id uuid NOT NULL,
  created_at timestamptz,
  updated_at timestamptz
);

CREATE TABLE staging.project_documents (
  document_id uuid PRIMARY KEY,
  document_url text,
  created_at timestamptz,
  updated_at timestamptz,
  owner_id uuid NOT NULL,
  name text,
  type text,
  size bigint,
  num_pages smallint,
  project_id uuid
);

CREATE TABLE staging.project_users (
  project_users_id uuid PRIMARY KEY,
  project_id uuid NOT NULL,
  user_id uuid NOT NULL,
  created_at timestamptz,
  updated_at timestamptz
);

CREATE TABLE staging.project_users_roles (
  project_users_roles_id uuid PRIMARY KEY,
  project_id uuid NOT NULL,
  user_id uuid NOT NULL,
  role integer NOT NULL,
  created_at timestamptz,
  updated_at timestamptz
);

CREATE TABLE staging.roles (
  role_id integer PRIMARY KEY,
  name text NOT NULL
);
```

### Step 2: Migrate users

```sql
-- Generate nanoid-style IDs for accounts
-- (In practice, use your app's ID generation. Here we use the uuid cast as text.)

INSERT INTO "user" (id, name, email, "emailVerified", image, "createdAt", "updatedAt", role, banned, "isGuest")
SELECT
  s.user_id::text                     AS id,
  COALESCE(s.name, 'Unknown')         AS name,
  s.email                             AS email,
  true                                AS "emailVerified",
  null                                AS image,
  COALESCE(s.created_at, now())       AS "createdAt",
  COALESCE(s.updated_at, now())       AS "updatedAt",
  COALESCE(s.role, 'user')            AS role,
  false                               AS banned,
  false                               AS "isGuest"
FROM staging.users s
WHERE s.email IS NOT NULL
ON CONFLICT (id) DO NOTHING;

-- Create account records (credential provider, no password — forces reset)
INSERT INTO account (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text             AS id,
  s.user_id::text                     AS "accountId",
  'credential'                        AS "providerId",
  s.user_id::text                     AS "userId",
  null                                AS password,
  COALESCE(s.created_at, now())       AS "createdAt",
  COALESCE(s.updated_at, now())       AS "updatedAt"
FROM staging.users s
WHERE s.email IS NOT NULL
ON CONFLICT DO NOTHING;
```

### Step 3: Create organizations (one per project owner)

```sql
-- Create one organization per distinct project owner
INSERT INTO organization (id, name, slug, logo, metadata, "createdAt")
SELECT DISTINCT
  'org_' || s.owner_id::text         AS id,
  COALESCE(u.name, u.email, 'Org')
    || '''s Organization'             AS name,
  'org-' || LEFT(s.owner_id::text, 8) AS slug,
  null                                AS logo,
  null                                AS metadata,
  COALESCE(MIN(s.created_at), now())  AS "createdAt"
FROM staging.projects s
JOIN staging.users u ON u.user_id = s.owner_id
WHERE s.owner_id IS NOT NULL
GROUP BY s.owner_id, u.name, u.email
ON CONFLICT (id) DO NOTHING;

-- Make each owner a member of their org
INSERT INTO member (id, "userId", "organizationId", role, "createdAt")
SELECT DISTINCT
  gen_random_uuid()::text             AS id,
  s.owner_id::text                    AS "userId",
  'org_' || s.owner_id::text         AS "organizationId",
  'owner'                             AS role,
  now()                               AS "createdAt"
FROM staging.projects s
WHERE s.owner_id IS NOT NULL
ON CONFLICT DO NOTHING;
```

### Step 4: Migrate projects

```sql
INSERT INTO project (
  id, name, description, reference, category,
  "clientName", "clientEmail", "clientPhone",
  priority, tags, notes,
  "annotationCount", "createdBy", "organizationId",
  "createdAt", "updatedAt"
)
SELECT
  p.project_id::text                  AS id,
  p.project_name                      AS name,
  p.project_description               AS description,
  null                                AS reference,
  null                                AS category,
  COALESCE(p.client_name, c.name)     AS "clientName",
  c.email                             AS "clientEmail",
  c.phone                             AS "clientPhone",
  'normal'                            AS priority,
  '[]'::jsonb                         AS tags,
  null                                AS notes,
  0                                   AS "annotationCount",
  p.owner_id::text                    AS "createdBy",
  'org_' || p.owner_id::text         AS "organizationId",
  COALESCE(p.created_at, now())       AS "createdAt",
  COALESCE(p.updated_at, now())       AS "updatedAt"
FROM staging.projects p
-- Join to get client details (take first client if multiple)
LEFT JOIN LATERAL (
  SELECT c2.name, c2.email, c2.phone
  FROM staging.project_clients pc
  JOIN staging.clients c2 ON c2.client_id = pc.client_id
  WHERE pc.project_id = p.project_id
  LIMIT 1
) c ON true
WHERE p.owner_id IS NOT NULL
ON CONFLICT (id) DO NOTHING;
```

### Step 5: Migrate project documents → project_file

```sql
INSERT INTO project_file (
  id, "projectId", "pdfUrl", "pdfFileName", "pdfFileSize",
  "pageCount", "annotationCount", "uploadedBy",
  "createdAt", "updatedAt"
)
SELECT
  d.document_id::text                 AS id,
  d.project_id::text                  AS "projectId",
  d.document_url                      AS "pdfUrl",
  COALESCE(d.name, 'Untitled.pdf')    AS "pdfFileName",
  COALESCE(d.size::integer, 0)        AS "pdfFileSize",
  COALESCE(d.num_pages::integer, 0)   AS "pageCount",
  0                                   AS "annotationCount",
  d.owner_id::text                    AS "uploadedBy",
  COALESCE(d.created_at, now())       AS "createdAt",
  COALESCE(d.updated_at, now())       AS "updatedAt"
FROM staging.project_documents d
WHERE d.project_id IS NOT NULL
  AND d.owner_id IS NOT NULL
ON CONFLICT (id) DO NOTHING;
```

### Step 6: Migrate project members (collaborators)

```sql
-- Add project collaborators as org members
INSERT INTO member (id, "userId", "organizationId", role, "createdAt")
SELECT DISTINCT
  gen_random_uuid()::text             AS id,
  pu.user_id::text                    AS "userId",
  'org_' || p.owner_id::text         AS "organizationId",
  CASE
    WHEN r.name ILIKE '%admin%' THEN 'admin'
    ELSE 'member'
  END                                 AS role,
  COALESCE(pu.created_at, now())      AS "createdAt"
FROM staging.project_users pu
JOIN staging.projects p ON p.project_id = pu.project_id
LEFT JOIN staging.project_users_roles pur
  ON pur.project_id = pu.project_id AND pur.user_id = pu.user_id
LEFT JOIN staging.roles r ON r.role_id = pur.role
WHERE p.owner_id IS NOT NULL
  AND pu.user_id != p.owner_id  -- Skip owners, already added
ON CONFLICT DO NOTHING;
```

### Step 7: Validation queries

```sql
-- Compare counts
SELECT 'users' AS entity,
  (SELECT count(*) FROM staging.users WHERE email IS NOT NULL) AS old_count,
  (SELECT count(*) FROM "user" WHERE id IN (SELECT user_id::text FROM staging.users)) AS new_count;

SELECT 'projects' AS entity,
  (SELECT count(*) FROM staging.projects WHERE owner_id IS NOT NULL) AS old_count,
  (SELECT count(*) FROM project WHERE id IN (SELECT project_id::text FROM staging.projects)) AS new_count;

SELECT 'files' AS entity,
  (SELECT count(*) FROM staging.project_documents WHERE project_id IS NOT NULL AND owner_id IS NOT NULL) AS old_count,
  (SELECT count(*) FROM project_file WHERE id IN (SELECT document_id::text FROM staging.project_documents)) AS new_count;

SELECT 'members' AS entity,
  (SELECT count(DISTINCT (user_id, project_id)) FROM staging.project_users) AS old_count,
  (SELECT count(*) FROM member WHERE "organizationId" LIKE 'org_%') AS new_count;

-- Check for orphaned references
SELECT 'orphaned_project_files' AS check_name,
  count(*) AS count
FROM project_file pf
WHERE NOT EXISTS (SELECT 1 FROM project p WHERE p.id = pf."projectId");

SELECT 'orphaned_members' AS check_name,
  count(*) AS count
FROM member m
WHERE NOT EXISTS (SELECT 1 FROM "user" u WHERE u.id = m."userId");
```

### Step 8: Cleanup

```sql
-- Once validated, drop staging schema
DROP SCHEMA staging CASCADE;
```

---

## Migration Execution Plan

### Phase 1: Prepare
1. Export old Supabase data (`pg_dump` or CSV export from dashboard)
2. Run Step 0-1 to create staging tables and load data into local new DB
3. Eyeball the staging data — check for nulls, bad emails, orphaned records

### Phase 2: Execute (locally first)
1. Run Steps 2-6 in order (they have FK dependencies)
2. Run Step 7 validation queries
3. Fix any count mismatches or orphan issues
4. Test the app locally — log in as a migrated user, check projects appear, files load

### Phase 3: PDF File Storage
**Important:** The old system stores PDFs in Supabase Storage. The new system likely uses a different storage backend.
- If same bucket/storage: `pdfUrl` values work as-is
- If different storage: need to copy files and update URLs in `project_file.pdfUrl`
- This is independent of the database migration

### Phase 4: Production
1. Put old app in maintenance mode
2. Run fresh export from Supabase
3. Execute migration on new production DB
4. Run validation queries
5. Test critical paths
6. Switch DNS / go live

---

## Known Limitations

1. **No password migration** — Supabase Auth manages passwords separately. Users will need to reset passwords or use OAuth/magic-link on the new platform.
2. **Annotations excluded** — Users start with empty annotation state on migrated documents. Old annotations remain in old DB if needed later.
3. **Project tags** — Unclear how they were linked to projects in old schema (no join table found). Skipped for now.
4. **Billing data** — Stripe customer IDs and subscription status not migrated. Handle separately if needed.
5. **PDF storage** — File URLs may need updating depending on storage backend changes.

---

## Appendix A: Annotation Migration (Deferred)

Annotations are **not migrated** in this phase. The full analysis of what would be required is below for future reference.

### Why Deferred

1. **DPR coordinate mismatch** — Old system stores coordinates divided by `devicePixelRatio`. New system stores raw PDF coordinates. Without knowing which DPR each annotation was created at, coordinates may render incorrectly.
2. **Konva → SVG paradigm shift** — Old system stores Konva-specific rendering data (flat point arrays, line configs). New system stores clean geometry. Each type needs custom transformation logic.
3. **Count annotation model change** — Old stores one record per page with all markers. New stores one record per marker. Requires 1→N explosion.
4. **Risk vs reward** — Getting annotations wrong means data looks broken in the editor. Better to start fresh and handle migration as a separate, well-tested effort.

### Type-by-Type Transform Summary (if needed later)

| Old Type | New Type | Difficulty | Key Transform |
|----------|----------|-----------|---------------|
| `measureTool` | `measure` | Medium | Drop `lines`, flatten `midpoint` to root |
| `areaTool` | `area` | Medium | Drop Konva `lines`, `totalArea` → `area`, `iconLocation` → `center` |
| `perimeterTool` | `perimeter` | Medium-High | Reconstruct `segments` from flat line arrays |
| `lineTool` | `line` | Low | Keep `points`, drop Konva `lines` |
| `fillTool` | `fill` | Low | Add `color`/`opacity` defaults |
| `textTool` | `text` | Low | `fill` → `color`, `text` → `content` |
| `countTool` | `count` | Medium | Explode markers array → individual records |
| `pageMetadata` | — | Skip | No equivalent in new system |

All types would also need coordinate values multiplied by assumed DPR (likely `2` for Retina).
