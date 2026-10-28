# ADR 0002: Staff Email Login and Account Lifecycle

- **Status:** Accepted; policy details open
- **Date:** 2026-10-28
- **Phase:** 2 — Authentication and tenancy (decision only; not implemented)

## Context

PawnPilot needs a staff identity model for the pilot and for the multi-tenant SaaS. The owner
proposed email login so staff can use company-issued email addresses and so a terminated employee
can be blocked immediately.

Email login is a reasonable login identifier, but the email address itself does not control access.
Access is controlled by the PawnPilot account status and server-side sessions. Suspending a company
mailbox is a separate control and must not be relied on to block PawnPilot access.

Phase 1 contains no authentication code. This ADR records the identity decision before Phase 2 is
approved.

## Decision

1. **Email is the login identifier.** Tenant users and platform users sign in with an email address
   and password. Username and phone-number login are not required for the pilot.
2. **Every person has a separate account.** Shared staff accounts are prohibited, even when branch
   devices are shared. Each staff member signs in individually.
3. **Use verified email addresses.** Invitations and password resets require email delivery.
   Verification and reset tokens must be single-use, short-lived, stored hashed, and rate-limited.
   Password-reset responses must not reveal whether an account exists.
4. **Normalize and uniquely index login emails.** Trim and case-fold addresses before comparison.
   The proposed pilot default is one globally unique login email per account. Supporting one person
   across multiple company tenants through account switching is deferred.
5. **Prefer company-issued email, but do not make it a hard requirement until confirmed.** A
   company-issued address gives the employer an additional mailbox-control layer. Staff without a
   company address may need a personal address during the pilot; this policy remains open.
6. **Deactivation is the access-control action.** Disabling an account must immediately:
   - block new logins;
   - revoke all active server-side sessions and refresh tokens;
   - invalidate outstanding invitations and password-reset tokens;
   - remove branch assignments as required; and
   - write an audit event.
   The block must apply on the next request, not when a token would otherwise expire.
7. **Email changes require re-authentication and verification.** The new address must be verified
   before it becomes the login identifier. Other active sessions should be revoked.
8. **Keep MFA in the Phase 2 security design.** D-005 proposes TOTP MFA. The recommended default
   is to require it for platform administrators and company owners; the requirement for branch
   operators and other roles remains a Phase 2 decision.
9. **Defer SSO.** Google Workspace or Microsoft 365 single sign-on can be added later. The email
   login design must not prevent it.
10. **Do not rely on the email provider for offboarding.** The PawnPilot offboarding procedure must
    deactivate the account and revoke sessions even if the company mailbox is also suspended.

## Open policy questions

- Must staff use a company-issued email address, or may they use a personal address with owner
  approval?
- Do we keep globally unique login emails for the pilot, or support one email linked to multiple
  company tenants?
- Are branch devices shared? If yes, use a short idle timeout and do not offer persistent
  "remember me" sessions on shared devices.
- Which transactional email provider or SMTP service will send invitations and password resets?
- Which non-owner roles require MFA?

## Consequences

- Phase 2 needs transactional email, email verification, password reset, account status, immediate
  session revocation, and audit logging.
- A suspended company mailbox does not by itself revoke an existing PawnPilot session. The
  offboarding runbook must include PawnPilot deactivation.
- Personal email addresses create privacy and lifecycle considerations; company-issued addresses
  are preferred.
- The pilot can start with one company membership per account. Multi-company membership can be
  added later without changing the email identifier.

## Verification

Not implemented. No authentication, session, invitation, or email-delivery code exists yet. This
ADR is a decision record only.
