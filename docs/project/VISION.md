# Parakh — Vision and Goals

## The idea

> Most civic platforms digitise the complaint. **Parakh is designed to digitise the proof.**

Parakh is an evidence-first civic reporting and resolution project for Punjab, Pakistan. A resident reports a public-service problem by **speaking** — in Urdu, Punjabi, English or a natural mix — and by capturing **live** evidence. The system preserves that evidence, produces an Urdu-script rendering that the reporter checks and confirms, and routes the report through accountable human review: verification, acceptance, assignment, completion, independent verification, the reporter's confirmation or dispute, and closure.

Its operating sequence is **evidence first → AI assisted → human reviewed**. AI helps with transcription and rendering. **A named human makes every civic decision.**

## Goals

| Goal | How Parakh pursues it | How it would be shown |
|---|---|---|
| A report carries checkable evidence, not just an assertion | Live capture only, hashed at capture, write-once storage | Integrity tests; tamper detection |
| A person with limited literacy can report | Voice-first path; icon-led screens; Urdu/English interface; no typing required | Usability testing with real adults (not yet performed) |
| The reporter approves the exact text that is submitted | Versioned rendering bound by content hash | Stale-confirmation tests |
| Every consequential decision is human and attributable | No automated accept, reject, verify, assign, resolve or close | Audit reconstruction |
| Reporters are protected by access restriction | No operational role ever sees a citizen's number; contractors never hear the audio | Response-layer privacy tests |
| One developer can build and maintain it | Modular monolith, one mobile codebase, documented decisions | This repository |

## The five civic portals

**Citizen · Street Representative · UC Officer · Contractor · Mayor & Operations** — all in one React Native app (DR-25). Shared staff screens support them; they are not a sixth portal. Infrastructure administration sits outside civic authority.

## What Parakh is not — today

Parakh is a **prototype in planning and early construction**.

- It is **not** an official Government of Punjab application.
- **No** government or NGO partnership has been signed.
- **No** deployment, users, adoption, endorsement or social impact exists or is claimed.
- Citizens are **not anonymous**: they hold OTP-verified accounts, and the protection is access restriction (CR-61 §18).

## Origin

Hassan Jalal founded Parakh and is its sole human developer and designer. Earlier planning material describes his connection to rural Punjab, where knowledge of civic failures existed but lacked a traceable path to becoming evidence (S-21, slide 4). That material is a historical source, not a claim of outcomes.
