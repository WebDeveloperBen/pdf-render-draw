# TASKS

## Task List

### General

- [x] first read, update and then complete the outstanding items from ADMIN_AUDIT_REPORT.md (core complete, remaining items are polish/enhancements)
- [x] I want to remove organisations from being used within the frontend and instead replace it with "workplace" since this is aimed at trades. I think it fits their niche much better than organisation. under the hood in the api and database it can stay as organisation
- [x] I want to move the workplace selector component into the top of the sidebar component so there isn't two, will make it much more polished I feel.

### Features

- [ ] When creating a new project the user must be able to attach the pdf to their project
- [ ] A user should be able to attach more than one file to a project, to allow revisions, changes, multi file projects for example. Currently projects are 1:1 with files this needs to be changed
- [ ] Annotations should persist into the database and be rehydrated on load. (what algorithym should we use to sync them)
- [ ] We need to enable printing of the pdf's with annotations embedded e.g. a download link
- [ ] We need to enable download of the original file without annotations

### Platform Admins

- [x] Fix impersonation users to be able to act, see, load exactly what that user will. with a banner on the top of the page allowing to stop impersonating that user and return to the admin account

### Organisation Admins

### Errors

- [x] ERROR [Better Auth]: BetterAuthError Field createdAt not found in model admin_audit_log (added createdAt to plugin schema)

### BUGS

- [x] Default organisation selection may or may not work for new users (logic verified - ensureActiveOrganization handles correctly)

### Tests to do

- [ ] Write tests & Check password reset flow works as expected
- [ ] Write tests & Check invite flow works as expected
- [ ] Write tests & Check

### Developer Experience

- [x] Enhance the seeds so that we get a fully seeded database to develop the solution with and enable it to run when the server starts in dev mode so its easy for my developers to get up and running. Look in the compose.yml file. and then package.json. Seeds should be idempotent and build upon the initial_setup_db.sql file but be a different file thats optional and only run during pnpm dev

### User Experience

- [ ] It should be less clicks to be able to open a project in their editor

### Performance

- [ ] Create a <https://www.better-auth.com/docs/concepts/database#secondary-storage> implementation using cloudflare kv to store our rate limiting tokens.
