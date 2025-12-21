# TASKS

## Task List

### General

- [ ] first read, update and then complete the outstanding items from ADMIN_AUDIT_REPORT.md
- [ ] I want to remove organisations from being used within the frontend and instead replace it with "workplace" since this is aimed at trades. think it fits
      their niche much better than organisation. under the hood in the api and database it can stay as organisation

### Platform Admins

- [ ] Fix impersonation users to be able to act, see, load exactly what that user will. with a banner on the top of the page allowing to stop impersonating that
      user and return to the admin account

### Organisation Admins

### Errors

- [ ] ERROR [Better Auth]: BetterAuthError Field createdAt not found in model admin_audit_log

### Developer Experience

- [ ] Enhance the seeds so that we get a fully seeded database to develop the solution with and enable it to run when the server starts in dev mode so its easy
      for my developers to get up and running. Look in the compose.yml file. and then package.json. Seeds should be idempotent and build upon the
      initial_setup_db.sql file but be a different file thats optional and only run during pnpm dev

### Performance

- [ ] Create a <https://www.better-auth.com/docs/concepts/database#secondary-storage> implementation using cloudflare kv to store our rate limiting tokens.
