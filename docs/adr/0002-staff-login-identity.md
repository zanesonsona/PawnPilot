# ADR 0002: Staff Login Identity and Account Lifecycle

- **Status:** Accepted; implemented in Phase 2
- **Date:** 2026-10-28
- **Phase:** 2 — Authentication and tenancy

## Context

PawnPilot needs a staff identity model for the pilot and for the multi-tenant SaaS. The initial
proposal was email login for all staff. The owner revised that proposal because company-issued
email mailboxes are an unnecessary recurring cost for branch users.

The owner also clarified that the tenant-level "super admin" is the **Head Office Administrator**:
the person who manages branch access and deactivates resigned branch employees. This is a tenant
role, not a PawnPilot platform administrator.

The revised model is a hybrid:

- **Email login** for Platform Administrators, Company Owners, and Head Office Administrators.
- **Username login** for branch-level users who do not need a company email mailbox.

Email or username is only a login identifier. Access is controlled by the PawnPilot account status
and server-side sessions. A terminated employee must be blocked by deactivating the PawnPilot
account and revoking sessions, not by relying on an email provider.

Phase 1 contains no authentication code. This ADR records the identity decision before Phase 2 is
approved.

## Decision

1. **Use two login identifier classes.**
   - Platform Administrators, Company Owners, and Head Office Administrators sign in with an email
     address.
   - Branch-level users sign in with a username. Branch users do not need an email address.

2. **Use precise role names.**
   - "Super admin" means the tenant-level **Head Office Administrator**, not the Platform
     Administrator. The implemented technical role is `HEAD_OFFICE_ADMIN`.
   - The Platform Administrator is PawnPilot staff and remains a separate principal.
   - The Company Owner is the highest tenant role and remains responsible for tenant continuity.

3. **Define tenant access authority.**
   - A Head Office Administrator can create, deactivate, and reset branch-user accounts, assign
     branch access, and remove a resigned branch employee immediately.
   - A Company Owner can manage all tenant users, including Head Office Administrators.
   - A Head Office Administrator cannot modify the Company Owner or another Head Office
     Administrator.
   - A Platform Administrator does not perform routine tenant user administration. An emergency
     security disable must use an audited support/security procedure.
   - At least one active Company Owner must remain. The number of Head Office Administrators per
     tenant is still to be confirmed.

4. **Email login does not require a company-issued mailbox.** Owners, Head Office Administrators,
   and Platform Administrators may use an existing email address. A company-issued address remains
   optional and can be adopted later.

5. **Proposed default: usernames are unique within a company, not globally.** The login flow must
   resolve the company before authenticating a username. On a branch device, the company context
   can be preconfigured so staff only enter their username and password. A central login would need
   a company code or another tenant selector. This avoids collisions and impersonation across
   tenants. Confirm before implementation.

6. **Normalize identifiers.**
   - Trim and case-fold email addresses and usernames for comparison.
   - Email addresses must be unique across all email-login accounts.
   - Usernames must be unique within their company and must not contain `@`, so the login form can
     distinguish an email from a username.
   - Use a restricted username character set and reject visually confusing or reserved names.

7. **Use one login field that accepts either identifier.** If the value contains `@`, treat it as an
   email; otherwise treat it as a username and apply the company context. The final login UX
   remains subject to confirmation.

8. **Provision branch accounts without email.** An owner or Head Office Administrator creates the
   branch account, assigns a unique username, and delivers a temporary password or one-time setup
   code in person or through an approved secure channel. The user must change the password at first
   login. Shared staff accounts are prohibited.

9. **Password resets differ by account type.**
   - Email accounts use self-service password reset through a verified email address.
   - Username accounts are reset by an owner or Head Office Administrator, who issues a new
     temporary password or one-time setup code. The reset must be rate-limited and audited.
   - A branch user may optionally add a verified recovery email later, but it is not required for
     the pilot.

10. **Deactivation is the access-control action for both account types.** Disabling an account must
    immediately:
    - block new logins;
    - revoke all active server-side sessions and refresh tokens;
    - invalidate outstanding invitations, setup codes, and password-reset tokens;
    - remove branch assignments as required; and
    - write an audit event.
    The block must apply on the next request, not when a token would otherwise expire.

11. **Do not reuse a username for a different person.** Usernames are assigned to one person and
    retained with the deactivated account for audit history. Renaming a username requires an
    authorized action and an audit event. A new employee receives a new account.

12. **Keep MFA in the Phase 2 security design.** D-005 proposes TOTP MFA. The recommended default is
    to require it for Platform Administrators, Company Owners, and Head Office Administrators;
    branch-user requirements remain a Phase 2 decision.

13. **Defer SSO.** Google Workspace or Microsoft 365 single sign-on can be added later for email
    accounts. It is not required for branch usernames.

14. **Do not rely on an email provider for offboarding.** The PawnPilot offboarding procedure must
    deactivate the account and revoke sessions for both email and username accounts.

## Open policy questions

- How many Head Office Administrators should a tenant have? More than one reduces the risk of a
  single point of failure, but each additional account is another privileged identity.
- Who becomes the backup administrator if the Company Owner is unavailable? The owner continuity
  and account-recovery process still needs to be defined.
- Should usernames be company-scoped with a company code/tenant selector, or globally unique for
  simplicity? The proposed default is company-scoped.
- Should branch password resets be owner/Head Office Administrator-initiated, or should the system
  issue one-time recovery codes? The proposed default is administrator-initiated.
- Should usernames be based on employee IDs, names, or another convention? Who may change them?
- Should the Head Office Administrator see branch or consolidated financial reports? The current
  role matrix gives this role no financial access by default; any reporting access must be
  confirmed separately.
- Are branch devices shared? If yes, use a short idle timeout and do not offer persistent
  "remember me" sessions on shared devices.
- Which branch roles require MFA?
- Do branch users need an optional recovery email or phone number for account recovery?

## Consequences

- Branch onboarding does not require a company email mailbox, reducing cost and administrative
  overhead.
- The tenant needs a clear owner continuity plan because only the Company Owner can manage Head
  Office Administrators.
- The system needs a tenant-resolution step for username login and safe company-scoped username
  generation.
- Username accounts create more password-reset work for owners and Head Office Administrators.
- Email delivery is still required for owner and Head Office Administrator invitations and password
  resets.
- Immediate deactivation and session revocation remain mandatory for every account type.
- The Head Office Administrator cannot perform platform-wide actions or access another tenant.
- A suspended company mailbox does not by itself revoke a PawnPilot session.

## Implementation record

Implemented in Phase 2 on 2026-10-29:

- Separate platform and tenant login endpoints and authorization realms.
- Email login for Platform Administrators, Company Owners, and Head Office Administrators.
- Company-scoped usernames plus a company slug for branch operators.
- Argon2id passwords, opaque database sessions, CSRF/Origin checks, login throttling, and audit
  events.
- Immediate session revocation on deactivation and password reset.
- Owner and Head Office Administrator invitations; administrator-initiated branch password resets;
  forced password change for temporary branch credentials.
- TOTP MFA with hashed, one-time recovery codes. Platform-administrator MFA is mandatory; tenant MFA
  is optional and recommended for owners.

Implementation defaults still requiring policy confirmation: final username convention, shared
branch-device rules, number of Head Office Administrators, owner continuity/backup, and optional
recovery contact for branch users.
