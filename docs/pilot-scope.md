# Parakh Pilot Scope

> **Status note added 2026-10-03 (original text below is unchanged).** This document predates the adoption of CR-61 rev 1.3 and the Mobile SRS v2.1.0 in this repository.
>
> - **Superseded by CR-61:** its *Moderator / Administrator* role. The current model has five civic portals (Citizen, Street Representative, UC Officer, Contractor, Mayor & Operations), and Moderator responsibilities are mapped to the UC Officer and Mayor & Operations portals.
> - **Historical target:** the *10 October 2026* date came from the 14 August execution roadmap, which assumed an external developer. Hassan Jalal is now the sole developer, and the current target and scope are open decision `DG-04`; see `docs/planning/PROJECT_PLAN.md`.
> - **Still valid:** its AI boundary, pilot boundaries and data-and-testing rules, which agree with the current sources.

## Status

Parakh is currently in active prototype development.

Target: a controlled end-to-end pilot-ready system by 10 October 2026.

This target does not imply government adoption, public deployment, partnership, or demonstrated social impact.

## Pilot Objective

Build and validate a complete civic-reporting workflow in which evidence remains traceable from initial citizen capture through review, assignment, completion, verification, and citizen confirmation.

## Pilot Workflow

Citizen  
→ Moderator / Admin Review  
→ Street Representative Verification  
→ Union Council Officer Routing and Assignment  
→ Contractor Work and Completion Evidence  
→ Operations Oversight  
→ Human Verification  
→ Citizen Confirmation or Dispute

## Roles

- Citizen
- Moderator / Administrator
- Street Representative
- Union Council Officer
- Contractor
- Mayor / Operations

## Core Pilot Requirements

The pilot should demonstrate:

- citizen report creation
- Urdu and English interface foundation
- voice-based reporting
- live evidence capture
- location and timestamp handling
- evidence integrity and preservation
- human moderation
- Street Representative verification
- UC Officer routing and assignment
- Contractor work-order workflow
- before-and-after completion evidence
- Operations monitoring
- citizen confirmation and dispute
- role-based permissions
- traceable audit history
- relevant automated and manual tests

## AI Boundary

AI may assist with tasks such as transcription and annotation.

AI must not independently:

- accept or reject a civic report
- verify evidence
- assign contractors
- determine that work is complete
- resolve or close a case

Consequential decisions remain human-controlled.

## Pilot Boundaries

The pilot does not include:

- province-wide public launch
- government procurement
- automated contractor selection
- payments or financial transactions
- facial recognition
- unrestricted public access to report data
- claims of government approval without written authorization
- claims of impact that have not been measured

## Data and Testing

Development and internal testing should use synthetic data unless the requirements for controlled real-participant testing have been satisfied.

Real-participant testing requires appropriate consent, privacy, safeguarding, and pilot authorization processes.

## Completion Target

By 10 October 2026, the target is a working, documented, testable pilot system with:

- a complete end-to-end workflow
- documented permissions
- evidence-integrity controls
- human-review controls
- relevant tests
- known limitations
- deployment or reproducible demonstration instructions
- a recorded demonstration
- development and testing evidence
- accurate contribution records

## Change Control

Any material change to this pilot scope must be documented before implementation.

If the schedule is at risk, optional functionality should be reduced before testing, privacy, evidence integrity, documentation, or human-review safeguards are weakened.
