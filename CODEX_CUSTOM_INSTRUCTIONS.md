# Codex Custom Instructions for Finanzas SD

> **Purpose**: These are the custom instructions for GitHub Copilot/Codex when working on the CVDExInfo/financial-planning-u repository for the Finanzas SD / Prefacturas / Acta platform. Paste these into your Copilot custom instructions box to ensure consistent, production-ready code changes.

---

## 🎯 General Operating Model

You are Copilot working primarily on the repo **CVDExInfo/financial-planning-u** for the **Finanzas SD / Prefacturas / Acta** platform.

**Core Principles:**

1. **Production-Critical Mindset**: Treat this project as production-critical. Favor **stability, safety, and clarity** over cleverness.
2. **Branch Strategy**: Assume `main` must remain stable and deployable at all times. All work happens in feature branches using the pattern: `codex/{feature}`.
3. **Workflow Sequence**: Always think in this sequence for each task:
   - **PLAN** → **IMPLEMENT** → **VERIFY** → **SUMMARIZE**

---

## 📋 Planning & Scope

### Start Every Task with a PLAN Section

Before making any changes, provide a short **PLAN** section that includes:
- Which files you will **read**
- Which files you will **edit**
- What **behavior** you will change

### Respect Explicit Scope

- **Only touch paths** the user mentions (or that are clearly required to complete the task)
- **Don't "helpfully" refactor** unrelated code or workflows
- Prefer **small, focused diffs** over large refactors
- If a refactor seems necessary, **call it out in PLAN** and keep it separate

---

## 🔒 Security & Environment

### Never Expose Secrets

- **Never add or expose** AWS credentials, secrets, tokens, or passwords
- Always use **existing env vars**, **OIDC roles**, and **AWS profiles** already defined in workflows
- **No static AWS keys** in code or YAML. Use **OIDC + IAM roles** and existing GitHub secrets only

### Default Assumptions

- **AWS Region**: `us-east-2` (unless told otherwise)
- **Finanzas API Base**: `https://pyorjw6lbe.execute-api.us-east-2.amazonaws.com/dev` (unless told otherwise)

---

## 📚 Sources of Truth

When making changes, treat these files as **primary specifications**:

1. **Root-level documentation:**
   - `UI_COMPONENT_VALIDATION_MATRIX.md` - for UI behavior and routes
   - `AWS_DIAGNOSTIC_FINDINGS.md` - for infrastructure diagnostics
   - `FINANZAS_AWS_INVESTIGATION_SUMMARY.md` - for AWS investigation details
2. **Backend specifications:**
   - `services/finanzas-api/template.yaml` - for API routes, tables, and environment variables
   - Existing handlers under `services/finanzas-api/src/handlers/**`
3. **API clients:**
   - `src/lib/api.ts` or `src/api/**`

**If these disagree with older docs, prefer current code + these spec files.**

---

## 🧪 Testing & Evidence

For **any change**, always either **run tests** or **clearly specify which tests must be run and how**.

### Testing Priorities

1. **`npm test`** / **`npm run test:unit`** / **`npm run lint`** where applicable
2. **`sam build`** (and `sam deploy` instructions) for API changes
3. Relevant **GitHub workflows** (e.g., deploy, diagnostics, E2E, or UI smoke tests)

### Evidence Pack

In your summary, include an **"Evidence Pack"**: a short list of commands run and whether they passed.

- If you **can't run them**, say **"NOT RUN – should be executed by human"** and list them.

**Example:**
```markdown
### Evidence Pack
- ✅ `npm run lint` - Passed
- ✅ `npm run test:unit` - Passed (12 tests)
- ✅ `sam build` - Successful
- ⚠️ NOT RUN - `sam deploy` (requires AWS credentials)
```

---

## 🔍 Diagnostics & E2E

### Never Remove Diagnostics

- When touching workflows, **never remove diagnostics**
- Prefer **additive observability** (logging, health checks, deep diagnostics)

### Use and Extend Existing Diagnostics

Use and extend existing diagnostics rather than creating one-off scripts:
- **`finanzas-aws-diagnostic.yml`**
- **`/health?deep=true`** endpoint
- **UI smoke tests**

### Authenticated E2E Tests

For authenticated E2E tests:
- Assume a **Cognito test user** exists with `USERNAME` / `PASSWORD` secrets and required groups
- Use these via **existing helper scripts or workflows**, not new secrets

---

## 💻 Coding Style & UX

### Match the Existing Stack

**Frontend:**
- React + TypeScript + Vite
- Tailwind CSS
- shadcn/ui components

**Backend:**
- TypeScript Lambda handlers
- AWS SAM

### Design and UX

- **Maintain current design and UX**; only change visuals when explicitly requested or when fixing a clear bug
- Keep functions **type-safe** and **self-documenting**
- Prefer **small helpers** and **clear naming** over nested logic

---

## 🚨 Error Handling

### Do Not Swallow Errors Silently

If you add or change error handling, ensure:

1. **API returns meaningful HTTP status codes**:
   - `401`/`403` for authentication/authorization issues
   - `503` for infrastructure issues
   - `400` for bad requests
   - `500` for server errors

2. **Logs contain enough context** (endpoint, table, operation, IDs) **without leaking secrets**

3. **For frontend**, surface errors in a **user-friendly way** and **preserve existing patterns**

---

## 📝 Communication & Summaries

At the end of each task, provide:

### 1. Brief Executive Summary
What changed and why (2-3 sentences)

### 2. File-by-File CHANGELOG
List each file modified with a one-line description of changes

**Example:**
```markdown
### CHANGELOG
- `services/finanzas-api/template.yaml` - Added JWT authorizer configuration
- `src/modules/finanzas/RubrosCatalog.tsx` - Fixed API client call to use env var
- `docs/API_ENDPOINTS_STATUS.md` - Updated endpoint documentation
```

### 3. Follow-up Items or Risks
If something is ambiguous or risky:
- **Stop and describe options and trade-offs** instead of guessing
- List any follow-up items or risks

**Example:**
```markdown
### Follow-up Items
- ⚠️ Docs table missing in dev environment - needs manual creation
- ⚠️ CI user needs to be added to FIN group for E2E tests
```

---

## 🎯 Your Purpose

Your purpose is to help maintain and evolve **Finanzas SD** as a:
- **Stable** platform with minimal surprises in production
- **Observable** system with comprehensive diagnostics
- **Test-driven** codebase with evidence-based verification

---

## 📖 Quick Reference

### Common Commands

```bash
# Frontend
npm install              # Install dependencies
npm run dev             # Start dev server
npm run build           # Build for production
npm run preview         # Preview production build
npm run lint            # Run ESLint
npm test                # Run tests

# Backend (SAM)
sam build               # Build Lambda functions
sam deploy              # Deploy to AWS (requires credentials)
sam local start-api     # Start local API

# Testing
npm run test:unit       # Run unit tests
npm run test:e2e        # Run E2E tests
npm run qa:finanzas:auth # Run Finanzas QA guardrails
```

### Key Files to Know

```
financial-planning-u/
├── .github/
│   ├── workflows/              # CI/CD workflows
│   └── COPILOT_AGENT_INSTRUCTIONS.md
├── docs/
│   ├── COPILOT_OPERATING_INSTRUCTIONS.md
│   └── (various project documentation)
├── services/
│   └── finanzas-api/
│       ├── template.yaml       # SAM template (API definition)
│       └── src/handlers/       # Lambda handlers
├── src/
│   ├── api/                    # API clients
│   ├── modules/finanzas/       # Finanzas UI modules
│   └── lib/                    # Shared utilities
├── openapi/
│   └── finanzas.yaml          # OpenAPI specification
├── scripts/
│   └── ts-seeds/              # Database seeding scripts
├── UI_COMPONENT_VALIDATION_MATRIX.md  # Root-level spec files
├── AWS_DIAGNOSTIC_FINDINGS.md
├── FINANZAS_AWS_INVESTIGATION_SUMMARY.md
└── CODEX_CUSTOM_INSTRUCTIONS.md       # This file
```

---

## ✅ Checklist: Before Completing Any Task

- [ ] Followed the **PLAN → IMPLEMENT → VERIFY → SUMMARIZE** workflow
- [ ] Only modified files within **explicit scope**
- [ ] **No secrets or AWS keys** added to code
- [ ] Checked against **sources of truth** documents
- [ ] Ran (or specified) **appropriate tests**
- [ ] Included **Evidence Pack** in summary
- [ ] Never removed **diagnostics or observability**
- [ ] **Error handling** is meaningful and doesn't leak secrets
- [ ] Provided **executive summary**, **file-by-file changelog**, and **follow-up items**
- [ ] Maintained existing **design/UX** patterns (unless explicitly asked to change)

---

**Status:** Active  
**Version:** 1.0  
**Last Updated:** December 2024  
**Maintained by:** Finanzas SD Team
