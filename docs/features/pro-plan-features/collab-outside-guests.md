# Guest Collaborator Annotations

**Status:** Proposed
**Priority:** Medium
**Plan Tier:** Pro

---

## Summary

Allow Pro plan users to grant annotation permissions to external guests when sharing plans, enabling clients or external stakeholders to collaborate without requiring an account.

## Problem Statement

Users currently share plans with view-only access. When working with clients or external parties, there's no way to gather their input directly on the document - feedback must be communicated separately and manually added by the plan owner.

## Proposed Solution

Add an optional "Allow annotations" toggle to the share dialog for Pro plan users. This enables a limited number of guest collaborators to annotate shared plans without creating an account.

### Sharing Permission Tiers

| Permission           | Free/Mid | Pro |
| -------------------- | -------- | --- |
| Allow download       | Yes      | Yes |
| Allow notes/comments | Yes      | Yes |
| Allow annotations    | No       | Yes |

### Guest Seat Allocation

- Pro plan includes a set number of "guest seats" (e.g., 3-5)
- Guest seats are separate from paid team member seats
- No additional billing for guest collaborators
- Guests access via share link, no account required

## Use Cases

1. **Client Review** - Share building plans with clients to mark up requested changes
2. **Contractor Collaboration** - External contractors highlight areas of concern
3. **Stakeholder Feedback** - Collect annotations from multiple parties before finalizing

## Differentiation from Mid-Tier

| Mid-Tier               | Pro                    |
| ---------------------- | ---------------------- |
| Pay per seat           | Guest seats included   |
| Internal team members  | External collaborators |
| Full accounts required | No account needed      |

## Acceptance Criteria

- [ ] Pro users see "Allow annotations" toggle in share dialog
- [ ] Toggle disabled/hidden for non-Pro users with upgrade prompt
- [ ] Guest collaborators can use annotation tools on shared plans
- [ ] Guest annotations are visually distinguished (different color/label)
- [ ] Plan owner can revoke guest annotation access at any time
- [ ] Guest seat limit enforced with clear messaging when reached

## Open Questions

- How many guest seats should be included in Pro?
- Should guest annotations require approval before appearing?
- Time-limited access or permanent until revoked?

---

_Created: 2025-12-22_
