# CR-59 — Adopt Identity-Free Anonymous Citizen Incident Reporting

| Field | Value |
|---|---|
| **Change Request ID** | **CR-59** — **numbering under review, see below** |
| **Numbering conflict** | **`TBD — Hassan decision required`.** The SRS §37 register contains **CR-01 … CR-55**. **CR-56, CR-57 and CR-58 do not exist.** This record was issued as CR-59 on the mistaken belief that CR-58 was the highest existing identifier — that belief came from a pattern match across scratch files, not the authoritative register, and **it was wrong**. **This record is not renumbered here**, because CR-59 is already cited in the SRS, the database architecture, the authentication architecture, the use cases and the development journal. Hassan must choose: **(a)** accept CR-59/CR-60 and mark 56–58 permanently unused, or **(b)** renumber to CR-56/CR-57 and re-point every citation |
| **Title** | Adopt Identity-Free Anonymous Citizen Incident Reporting |
| **Raised** | 20 August 2026 |
| **Approved by** | **Hassan Jalal — Founder & Project Lead**, in the binding decision of 20 August 2026 |
| **Effective version** | **SRS v1.4.1** *(fully integrated)* · Database Architecture **v2.6** · Auth architecture **v1.1** · API contract **v1.0** |
| **Status** | **Approved and applied to specification.** **Not implemented. Not tested. Not deployed.** |
| **Related** | CR-60 (React Native migration) — independent and separately traceable |

---

## 1. Previous model — verified-participant reporting

SRS v1.3.7 required an attested, activated participant behind every report. This was enforced in **six** places:

| Artefact | Text |
|---|---|
| `C-6` | *"No anonymous reporting; verified identity for every reporter"* |
| `BR-007` | *"No anonymous reporting. Every report shall be linked to a verified participant"* |
| `FR-AUTH-004` (P0) | *"…shall provide no anonymous reporting path"* |
| `FR-CIT-001` (P0) | Server-side eligibility invariant mapped to `BR-007` |
| `TEST-AUTH-004` (P0) | Asserted refusal of unattested submission |
| `TEST-PRV-004` (P0) | *"Attempt API-030 as an unauthenticated caller"* — required refusal |

Identity flowed through `Participant` → `IdentityVaultRecord` → `AttestationRecord`, with citizen authentication by phone OTP (`API-001`/`API-002`) under `DR-9`.

## 2. New model — dual access

| | Anonymous citizen path | Authenticated staff path |
|---|---|---|
| Account · login · OTP | **None** | Invitation-only, MFA mandatory |
| Persistent identity | **None** | `Participant` + vault record |
| Credential | `AnonymousAccessGrant` token | Password/passkey + TOTP |
| Role | **None, ever** | Active `RoleAssignment` |
| Reach | **Exactly one report** | Scoped by geography/organisation |
| Audit attribution | `anonymous_grant` — no person recorded | `staff_role_assignment` |

**Anonymous access is not authentication.** A grant conveys report-scoped entitlement, carries no role, and can never become a session.

## 3. Reason for the change

The reporter of a civic failure is often the person least protected from the authority the report concerns. Requiring a phone number — even one held in an identity vault and unreadable by the application role — leaves a reporter who fears that number identifies them unprotected. **That fear is reasonable in a complaint system aimed at local authorities**, and it was the strongest argument for the change.

## 4. Requirements affected

**Amended:** `C-6` → superseded by **`C-6a`** · `BR-007` → superseded by **`BR-007a`** · `FR-AUTH-004` amended · `FR-CIT-001` remapped · `DR-9` extended by **`DR-9a`**.
**Added:** **`DR-20`** · **`FR-ANON-001`…`FR-ANON-008`** · **`FR-AUTH-004a`** (reporter entitlement, **a counted requirement**) · **`FR-ROLE-001/002`** · **`FR-STAFF-001`** · **`FR-CONF-001`**.
**Reclassified at v1.4.1:** v1.4.0's `FR-ANON-000` is **not a counted requirement**; it is invariant **`INV-ANON-01`**. `INV-ANON-02` (no indirect identity reconstruction) added alongside it.

**No requirement was deleted.** Superseded text is retained and labelled.

## 5. Business rules affected

`BR-007` superseded by `BR-007a` (explicit attribution kind; **no placeholder participant may be created to satisfy a foreign key**). `BR-022` **clarified, not weakened** — see §9.

## 6. APIs affected

| Group | Change |
|---|---|
| `API-115` / `API-116` / `API-117` anonymous upload | **New dedicated public-anonymous endpoints.** `API-020`/`021`/`022` remain the bearer-protected staff/authenticated path — **anonymous and staff semantics are not mixed in one endpoint** |
| `API-030` create report | Accepts unauthenticated submission with **no identity claim**; returns reference + token **once** |
| **New token-bound group** | Status · clarification response · confirm · dispute · **rotate token** |
| `API-001` / `API-002` citizen OTP | **Retained** for any future authenticated citizen path; **not required for reporting** |
| Staff endpoints | **Unchanged** |

**A fifth transport class is added:** public-anonymous, token-bound, public-auth, ticket-bound, bearer-protected.

## 7. Database entities affected

**New:** `AnonymousAccessGrant` (P0A). **Amended:** `CivicReport` gains an attribution kind; `CitizenResolutionDecision` and `Dispute` attribution move to reporter entitlement; `AuditEvent` gains `actor_kind`. **P0A count 37 → 38** (server-persisted frame); **SRS §14 frame 49 → 50 total, 38 → 39 P0**. **Both frames are stated because they count different things** — Database Architecture v2.6 §36.1.

> `participant_id` is **not** made nullable across the model. Attribution is explicit and constrained so an ambiguous record cannot be written.

## 8. Privacy effects

**Improved:** no declared identity is collected, so none can be compelled, leaked or correlated across reports.

**Not improved, and must never be claimed as such:** the report still contains location, category, description and evidence. **Voice is biometric.** Photographs, timestamps, surroundings and precise location may indirectly identify the reporter. The correct terms are **`anonymous reporter identity`** and **`identity-free reporting`** — never *"completely anonymous data"* or *"untraceable."* `FR-ANON-007` requires this be disclosed **before evidence capture**.

## 9. Retention correction

`BR-022` never meant "retain every raw biometric file forever." v1.4.0 separates **immutable audit history** (never deleted) from **immutable evidence provenance** (hash retained after media disposal) from **raw evidence media** (approved retention period, then secure deletion with a tombstone audit event, subject to legal hold).

## 10. Abuse-prevention implications

Anonymity raises abuse risk and the compensating control — human moderation — **does not scale**. Stated honestly rather than papered over.

Abuse identifier is **`HMAC(rotating_server_secret, normalized_IP)`**, short retention, abuse-prevention only, never exposed in staff interfaces, never used to establish identity. **A plain unsalted IP hash is prohibited** — the IPv4 space is small enough to reverse exhaustively. CAPTCHA/proof-of-work is **not** the default barrier. Duplicates are **surfaced to a human, never auto-rejected**.

## 11. Audit-attribution changes

`AuditEvent.actor_kind ∈ {anonymous_grant, authenticated_participant, staff_role_assignment, system}`. For anonymous submissions **no person identity is recorded**. Staff actions continue to record account, `acting_role_assignment_id`, scope, action, timestamp and correlation reference.

## 12. Test changes

**Rewritten:** `TEST-PRV-004` (previously required unauthenticated submission to fail) · `TEST-AUTH-004` (rescoped to authenticated path only).
**Added:** `TEST-ANON-001`…`TEST-ANON-014` — see Testing Plan.

> **Two P0 tests actively asserted the absence of the capability now approved.** They were rewritten, not deleted.

## 13. Migration risks

| Risk | Severity | Mitigation | Residual |
|---|---|---|---|
| Stolen token grants report access | **High** | Rotation, 90-day post-closure expiry, no URL exposure | **Accepted — no identity exists to re-verify against** |
| Spam and abuse increase | **High** | HMAC rate limiting, human moderation | **Real; moderation does not scale** |
| Placeholder-participant anti-pattern reappears in implementation | **High** | `BR-007a` prohibits it; constraint-level enforcement | Mitigated by design |
| Lost token strands a reporter | **Medium** | Disclosure before submission; QR + secure device storage offered | **By design — recovery would be an attack path** |
| Team describes the data as "anonymous" | **Medium** | §8 wording rules | Requires discipline |

## 14. Rollback considerations

Specification rollback is clean: v1.3.7 is preserved byte-identical (`sha256 f698b56e…`). **Data rollback is not clean** — once anonymous reports exist there is no identity to retrofit, and they cannot be converted to attributed reports. **Roll back before collecting real anonymous reports, or not at all.**

## 15. Approval

Approved by **Hassan Jalal**, 20 August 2026, as a binding product decision. Applied to SRS **v1.4.0**. **No independent security or privacy review has been performed. No legal review of lawful basis or retention has been completed.**
