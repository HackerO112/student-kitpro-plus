# Production readiness assessment

Status: **not yet production-ready** (source review, not a runtime certification).

## Verified from the current default branch
- React + TypeScript + Vite browser-first toolkit.
- README claims local file processing, optional account-based sync, and a broad set of PDF/image/student tools.
- The source has local storage, PDF parsing/rendering, file export, and optional sync modules.
- The hardening branch now includes a committed npm lockfile, CI, and a security policy. Automated tests and a license file are still absent.

## Release blockers
1. The first real build exposed unresolved imports for the shared UI component modules (button, input, textarea, select, switch, label, tabs, dialogs, progress, date-picker, and others). Restore the missing components or correct the imports before release.
2. Maintain the committed package lockfile and use frozen installs; verify dependency audit results before release.
3. Add tests for malformed PDFs, password-protected documents, large files, ZIP path/name collisions, image decoding, and storage quota failures.
4. Audit every sync endpoint and verify that local files are never uploaded unless the user explicitly requests it.
5. Validate import/export schemas and sizes; handle corrupt or hostile files without crashing the app.
6. Review watermark-removal and document-editing claims for lawful-use boundaries and avoid implying guaranteed removal.
7. Add accessibility, browser compatibility, privacy, dependency-license, and deployment checks.

## Release gate
Require lockfile-based CI, automated file-processing tests, privacy/security review, and a clean production build plus manual browser smoke test. This assessment is not a release approval.
