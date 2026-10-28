# ADR 0002: Staff Login Identity and Account Lifecycle

- **Status:** Accepted; policy details open
- **Date:** 2026-10-28
- **Phase:** 2 — Authentication and tenancy (decision only; not implemented)

## Context

PawnPilot needs a staff identity model for the pilot and for the multi-tenant SaaS. The initial
proposal was email login for all staff. The owner revised that proposal because company-issued
email mailboxes are an unnecessary recurring cost for branch users.

The revised model is a hybrid:

- **Email login** for owners, platform administrators, and head-office users who need account
  recovery and privileged access.
- **Username login** for branch-level users who do not need a company email mailbox.

Email or username is only a login identifier. Access is controlled by the PawnPilot account status
and server-side sessions. A terminated employee must be blocked by deactivating the PawnPilot
account and revoking sessions, not by relying on an email provider.

Phase 1 contains no authentication code. This ADR records the identity decision before Phase 2 is
approved.

## Decision

1. **Use two login identifier classes.**
   - Platform Administrators, Company Owners, and head-office users sign in with an email address.
   - Branch-level users sign in with a username. Branch users do not need an email address.
   - The exact mapping of head-office and branch roles remains open. "Super admin" is treated as
     the Platform Administrator for this decision.

2. **Email login does not require a company-issued mailbox.** Owners and head-office users may use
   an existing email address. A company-issued address remains optional and can be adopted later.

3. **Proposed default: usernames are unique within a company, not globally.** The login flow must
   resolve the company before authenticating a username. On a branch device, the company context
   can be preconfigured so staff only enter their username and password. A central login would need
   a company code or another tenant selector. This avoids collisions and impersonation across
   tenants. Confirm before implementation.

4. **Normalize identifiers.**
   - Trim and case-fold email addresses and usernames for comparison.
   - Email addresses must be unique across all email-login accounts.
   - Usernames must be unique within their company and must not contain `@`, so the login form can
     distinguish an email from a username.
   - Use a restricted username character set and reject visually confusing or reserved names.

5. **Use one login field that accepts either identifier.** If the value contains `@`, treat it as an
   email; otherwise treat it as a username and apply the company context. The final login UX
   remains subject to confirmation.

6. **Provision branch accounts without email.** An owner or authorized head-office user creates the
   branch account, assigns a unique username, and delivers a temporary password or one-time setup
   code in person or through an approved secure channel. The user must change the password at first
   login. Shared staff accounts are prohibited.

7. **Password resets differ by account type.**
   - Email accounts use self-service password reset through a verified email address.
   - Username accounts are reset by an owner or authorized head-office user, who issues a new
     temporary password or one-time setup code. The reset must be rate-limited and audited.
   - A branch user may optionally add a verified recovery email later, but it is not required for
     the pilot.

8. **Deactivation is the access-control action for both account types.** Disabling an account must
   immediately:
   - block new logins;
   - revoke all active server-side sessions and refresh tokens;
   - invalidate outstanding invitations, setup codes, and password-reset tokens;
   - remove branch assignments as required; and
   - write an audit event.
   The block must apply on the next request, not when a token would otherwise expire.

9. **Do not reuse a username for a different person.** Usernames are assigned to one person and
   retained with the deactivated account for audit history. Renaming a username requires an
   authorized action and an audit event. A new employee receives a new account.

10. **Keep MFA in the Phase 2 security design.** D-005 proposes TOTP MFA. The recommended default
    is to require it for Platform Administrators and Company Owners; head-office and branch-user
    requirements remain a Phase 2 decision.

11. **Defer SSO.** Google Workspace or Microsoft 365 single sign-on can be added later for email
    accounts. It is not required for branch usernames.

12. **Do not rely on an email provider for offboarding.** The PawnPilot offboarding procedure must
    deactivate the account and revoke sessions for both email and username accounts.

## Open policy questions

- Which roles are "head office" and which are "branch"? The current role matrix lists Platform
  Administrator, Company Owner, Branch Operator, and Guard; additional head-office roles need to be
  defined if they exist.
- Should usernames be company-scoped with a company code/tenant selector, or globally unique for
  simplicity? The proposed default is company-scoped.
- Should branch password resets be owner/head-office-initiated, or should the system issue one-time
  recovery codes? The proposed default is owner/head-office-initiated.
- Should usernames be based on employee IDs, names, or another convention? Who may change them?
- Are branch devices shared? If yes, use a short idle timeout and do not offer persistent
  "remember me" sessions on shared devices.
- Which head-office and branch roles require MFA?
- Do branch users need an optional recovery email or phone number for account recovery?

## Consequences

- Branch onboarding does not require a company email mailbox, reducing cost and administrative
  overhead.
- The system needs a tenant-resolution step for username login and safe company-scoped username
  generation.
- Username accounts create more password-reset work for owners and head-office administrators.
- Email delivery is still required for owner/head-office invitations and password resets.
- Immediate deactivation and session revocation remain mandatory for every account type.
- A suspended company mailbox does not by itself revoke a PawnPilot session.

## Verification

Not implemented. No authentication, session, invitation, username, or email-delivery code exists
yet. This ADR is a decision record only.
