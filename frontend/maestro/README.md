# Maestro E2E Strategy (Production)

This folder contains production-focused Maestro flows for core CRM workflows.

## Scope Covered

- Leads: create/edit/delete validations
- Clients: create/edit/delete + lead-to-client conversion path
- Shoots: client linkage + delete guard behavior
- Payments: invoice creation + relational delete behavior
- Expenses: create + delete guard handling
- Portfolio: image upload path + gallery verification
- Filters/reset behavior on list pages
- Multi-device sync checks (hybrid: automated + operator-assisted)
- Network failure checks (hybrid)

## Prerequisites

- Install Maestro CLI: https://maestro.mobile.dev/getting-started/installing-maestro
- Build and install Android debug/release app (`com.visyracrm.app`) on emulator/device.
- Seed test users/data in Supabase for deterministic execution.

## Run

```bash
cd frontend
maestro test maestro/flows
```

Run an individual flow:

```bash
cd frontend
maestro test maestro/flows/10_leads_crud.yaml
```

## Recommended test accounts

- `admin_qa_1` (primary test actor)
- `admin_qa_2` (secondary device for sync verification)

## Data management

Use isolated prefixes in test entities (example: `QA_LEAD_20260317_...`) and clean up after execution.

## CI/CD integration pattern

1. Build signed APK/AAB in CI.
2. Install app on emulator.
3. Run `maestro test maestro/flows`.
4. Publish reports + videos.
5. Fail pipeline on any broken critical flow.

See `.github/workflows/maestro-e2e.yml` for an example pipeline skeleton.

