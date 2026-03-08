-- Initial Platform Owner Setup Script
--
-- This script creates the initial platform owner from an existing user.
-- The user must already be registered in the system.
--
-- Usage with psql:
--   psql $DATABASE_URL -v owner_email="$PLATFORM_OWNER_EMAIL" -f scripts/initial_setup_db.sql
--
-- Or interactively:
--   psql $DATABASE_URL -f scripts/initial_setup_db.sql
--   Then enter the email when prompted
--
-- Note: If using -v, the email must be quoted: -v owner_email="'user@example.com'"

-- Check if owner_email variable is set, if not prompt for it
\if :{?owner_email}
  -- Variable is set, use it
\else
  \prompt 'Enter platform owner email: ' owner_email
\endif

-- Display the email being used
\echo 'Setting up platform owner for:' :owner_email

-- First check if user exists
DO $$
DECLARE
  v_user_id TEXT;
  v_user_name TEXT;
  v_existing_tier TEXT;
  v_owner_email TEXT := :'owner_email';
BEGIN
  -- Remove any surrounding quotes from the email
  v_owner_email := TRIM(BOTH '''' FROM v_owner_email);
  v_owner_email := TRIM(BOTH '"' FROM v_owner_email);

  -- Find the user
  SELECT id, name INTO v_user_id, v_user_name
  FROM "user"
  WHERE email = v_owner_email;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User with email "%" not found. Please ensure the user has registered first.', v_owner_email;
  END IF;

  RAISE NOTICE 'Found user: % (%)', v_user_name, v_user_id;

  -- Check if user is already a platform admin
  SELECT tier INTO v_existing_tier
  FROM platform_admin
  WHERE user_id = v_user_id;

  IF v_existing_tier IS NOT NULL THEN
    IF v_existing_tier = 'owner' THEN
      -- Ensure user.role is set even if already owner (in case of previous incomplete setup)
      UPDATE "user" SET role = 'platform_admin' WHERE id = v_user_id AND (role IS NULL OR role != 'platform_admin');
      RAISE NOTICE 'User is already the platform owner - no changes needed';
      RETURN;
    ELSE
      RAISE NOTICE 'User is already a platform admin with tier: %. Upgrading to owner...', v_existing_tier;
      UPDATE platform_admin
      SET tier = 'owner', notes = 'Upgraded to owner via SQL script', updated_at = NOW()
      WHERE user_id = v_user_id;
      -- Ensure user.role is set for better-auth compatibility
      UPDATE "user" SET role = 'platform_admin' WHERE id = v_user_id;
      RAISE NOTICE 'Successfully upgraded to platform owner!';
      RETURN;
    END IF;
  END IF;

  -- Check if there's already an owner
  IF EXISTS (SELECT 1 FROM platform_admin WHERE tier = 'owner') THEN
    RAISE EXCEPTION 'A platform owner already exists. There can only be one owner.';
  END IF;

  -- Create the platform admin record
  INSERT INTO platform_admin (id, user_id, tier, granted_by, granted_at, notes, created_at, updated_at)
  VALUES (
    gen_random_uuid()::text,
    v_user_id,
    'owner',
    NULL,
    NOW(),
    'Initial platform owner - created via SQL script',
    NOW(),
    NOW()
  );

  -- Also set user.role for better-auth admin plugin compatibility
  -- This enables impersonation, ban/unban, and other admin features
  -- See docs/architecture/role-systems.md for details
  UPDATE "user" SET role = 'platform_admin' WHERE id = v_user_id;

  RAISE NOTICE 'Successfully created platform owner!';
  RAISE NOTICE '  User: %', v_user_name;
  RAISE NOTICE '  Tier: owner';
END $$;
