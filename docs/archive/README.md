# Documentation Archive

This directory contains historical implementation and deployment documentation from the Finanzas R1 development and launch period.

## Purpose

These documents were created during active development sprints and deployment cycles to track progress, verify implementations, and guide operations. They represent point-in-time snapshots of the system state and are preserved for:

- Historical reference
- Audit trail
- Learning from past decisions
- Understanding evolution of the system

## Contents

### API Documentation
- `API_*.md` - API testing reports, coverage verification, and wiring validation
- Documents the progressive integration and testing of API endpoints

### Authentication & Authorization
- `AUTH_*.md` - Analysis of authentication conflicts, implementation guides, and decision records
- `COGNITO_*.md` - Cognito configuration fixes and quick references
- Covers the migration from simple auth to AWS Cognito with multi-role support

### Deployment Records
- `DEPLOYMENT_*.md` - Deployment completion reports, diagnostics, and summaries
- `CLOUDFRONT_*.md` - CloudFront-specific deployment documentation
- `FINANZAS_*.md` - Finanzas module deployment verification and testing
- Chronicles the deployment pipeline setup and verification steps

### Implementation Progress
- `IMPLEMENTATION_*.md` - Implementation status tracking and completion reports
- `PHASE1_*.md` - Phase 1 milestone documentation
- Tracks feature completion and readiness checkpoints

### Quality Assurance
- `QA_*.md` - QA review summaries, evidence packs, and test execution reports
- Documents testing procedures and results

### Operational Guides
- `OPS_*.md` - Operational deployment references
- `MULTI_ROLE_*.md` - Multi-role access configuration and verification
- `QUICK_*.md` - Quick start and reference guides

### Project Management
- `DELIVERABLE_*.md` - Deliverable summaries and tracking
- `PR_*.md` - Pull request checklists and merge procedures
- `INSTRUCTIONS.md` - Development instructions

### Other
- `GITHUB_*.md` - GitHub Actions and CI/CD fixes
- `GUIDE_*.md` - Various implementation guides
- `NEXT_STEPS.md` - Future work planning
- `PDF-DOWNLOAD-REPORT.md` - PDF generation feature report
- `DYNAMIC_SWITCHING_SUMMARY.md` - Module switching documentation

## Usage

These documents are **read-only archives**. For current documentation, see:

- **Root README.md** - Current project overview and setup
- **docs/** (parent directory) - Active documentation
- **docs/tree.structure.md** - Current architecture and structure
- **docs/architecture/** - System architecture
- **docs/ops/** - Current operational guides
- **docs/runbooks/** - Active runbooks

## Note

If you're looking for current information about the system:
1. **Start with the root README.md** for project overview
2. **Check docs/tree.structure.md** for architecture
3. **Refer to docs/** for active documentation
4. **Only consult this archive** for historical context or audit purposes

---

**Archive Date**: November 9, 2025  
**Reason**: Consolidation of documentation after R1 cleanup  
**Preserved By**: Copilot cleanup agent
