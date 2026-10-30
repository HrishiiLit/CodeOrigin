# CodeOrigin AI --- Detailed Implementation Plan

> **Document type:** Engineering implementation guide\
> **Version:** 1.0\
> **Last updated:** 30 October 2026\
> **Companion:** CodeOrigin AI Master Project Plan

## 1. Purpose and usage

This document converts the project definition into an executable
engineering plan: implementation order, module boundaries, API/data
contracts, ownership, tests, integration checkpoints and release
criteria. The Master Project Plan explains what the system is; this
document explains how to build it.

Use **MUST** for required MVP work, **SHOULD** for recommended work and
**MAY** for optional work. Record unresolved choices in
`docs/DECISIONS.md`; do not silently change shared contracts.

## 2. Product baseline and MVP

CodeOrigin AI is an educational code-review and code-evolution support
platform. It accepts source submissions, runs static analysis, compares
revisions and presents evidence for students and reviewers. An optional
authorship-pattern model is experimental and is never proof of
authorship or misconduct.

### Core user journeys

1.  **Submit and analyse:** student uploads a supported source file; API
    validates and stores it; analysis runs; results are persisted and
    displayed.
2.  **Revise and compare:** student submits a later version; it is
    linked to the project/revision chain; the comparison service returns
    a diff and change summary.
3.  **Faculty review:** reviewer inspects source, findings and history,
    adds a review note, and may prepare a GitHub issue draft. External
    issue creation requires explicit approval.

### MVP scope

  -----------------------------------------------------------------------
  Area                                Baseline
  ----------------------------------- -----------------------------------
  Frontend                            Next.js: dashboard, upload,
                                      results, comparison, review

  Backend                             FastAPI REST API and Python
                                      services

  Database                            MongoDB with PyMongo for structured
                                      metadata/results

  Source storage                      Private mounted uploads directory

  Language                            Python first

  Analysis                            Python AST, Ruff, Radon, Bandit

  Comparison                          Python `difflib` or equivalent

  ML                                  Conditional experimental component
                                      using scikit-learn, only with valid
                                      data/evaluation

  Integration                         Optional GitHub REST API;
                                      approval-gated writes

  Runtime                             Docker Compose
  -----------------------------------------------------------------------

**Out of scope for MVP:** executing uploaded code; automatic misconduct
decisions; automatic GitHub issue creation; microservices, Kubernetes,
Redis/Celery or another database without measured need; broad
multi-language support before Python works reliably.

## 3. Architecture and engineering rules

Use a **modular monolith**: one Next.js application and one FastAPI
service, with separated backend modules. Do not split services
pre-emptively.

``` text
Next.js Client
  Dashboard | Submit | Results | Compare | Review
                  │ HTTPS / JSON / multipart
                  ▼
FastAPI API
  Routes → Schemas → Services → Repositories
      │                         │
      ▼                         ▼
Analysis Pipeline             MongoDB
  AST / Ruff / Radon /         Projects, submissions,
  Bandit / optional ML         analysis, comparisons,
  normalisation                reviews, audit events
      │
      ▼
Private mounted source storage

Optional: FastAPI GitHub service → GitHub REST API
          (explicit reviewer approval required)
```

### Request lifecycle

1.  Receive and validate request, file type, size and metadata.
2.  Authenticate caller and check role/ownership.
3.  Generate internal IDs and safe storage key.
4.  Store source and compute SHA-256.
5.  Create submission record with `queued`/`processing` status.
6.  Run bounded analysis; normalise tool output.
7.  Persist results and update status.
8.  Return stable response; frontend retrieves/polls status.

For small files, synchronous processing is acceptable initially if
limits/timeouts are enforced. Add a background worker only if measured
latency requires it.

### Non-negotiable rules

-   Route handlers remain thin; business logic belongs in services.
-   Database access belongs in repositories.
-   Analysis tools are wrapped by adapters and normalised before API
    exposure.
-   Uploaded source is untrusted data and MUST NOT be executed.
-   Source files are never stored in a public frontend directory.
-   ML output is separate from static-analysis findings and labelled
    experimental.
-   GitHub write operations require explicit reviewer approval.

## 4. Repository structure

``` text
codeorigin-ai/
├── frontend/
│   ├── app/{dashboard,submissions,compare,review}/
│   ├── components/  hooks/  lib/  types/  public/
│   └── Dockerfile
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── api/routes/
│   │   ├── core/ schemas/ models/ repositories/
│   │   ├── services/{submissions,analysis,comparison,reports,integrations}/
│   │   ├── analyzers/{base,ast_analyzer,ruff_analyzer,radon_analyzer,bandit_analyzer}.py
│   │   └── utils/
│   ├── tests/  requirements.txt  Dockerfile
├── storage/uploads/
├── docs/{IMPLEMENTATION_PLAN,API_CONTRACT,DATA_MODEL,DECISIONS}.md
├── scripts/  docker-compose.yml  .env.example  .gitignore  README.md
```

Add modules when responsibilities are implemented; avoid empty
abstractions. Use feature branches, small commits, pull-request review,
and tests with each feature. Never commit `.env`, tokens, uploaded
student code, private datasets or local database volumes.

## 5. Environment setup

Prerequisites: Git, a team-agreed pinned Python version, Node.js LTS,
npm (or selected package manager), Docker and Docker Compose. Record
exact versions in README.

``` bash
cd backend
python -m venv .venv
# Windows PowerShell: .venv\\Scripts\\Activate.ps1
# Linux/macOS: source .venv/bin/activate
pip install -r requirements.txt
```

``` bash
cd frontend
npm install
npm run dev
```

Suggested `.env.example`:

``` dotenv
APP_ENV=development
API_HOST=0.0.0.0
API_PORT=8000
FRONTEND_ORIGIN=http://localhost:3000
MONGODB_URI=mongodb://mongo:27017
MONGODB_DATABASE=codeorigin_ai
UPLOAD_DIR=/app/storage/uploads
MAX_UPLOAD_SIZE_MB=5
ALLOWED_EXTENSIONS=.py
ANALYSIS_TIMEOUT_SECONDS=20
GITHUB_TOKEN=
GITHUB_DEFAULT_REPOSITORY=
```

These are proposed defaults; confirm them with the team. Load
configuration centrally, fail clearly when required settings are
missing, and never hardcode credentials or deployment URLs.

## 6. Team ownership

  -----------------------------------------------------------------------
  Member                  Primary ownership       Deliverables
  ----------------------- ----------------------- -----------------------
  1                       Frontend / Next.js      Pages, components,
                                                  forms, API client,
                                                  results and comparison
                                                  UI

  2                       FastAPI / MongoDB       API, schemas,
                                                  repositories,
                                                  submission lifecycle,
                                                  validation,
                                                  orchestration

  3                       Analysis and ML         AST/tool adapters,
                          experiment              finding normalisation,
                                                  dataset and model
                                                  evaluation

  4                       Comparison, reports,    Diff engine,
                          GitHub                  review/report support,
                                                  approval-gated GitHub
                                                  integration
  -----------------------------------------------------------------------

All members share responsibility for contracts, integration tests,
reviews, documentation and demo. Member 2 owns canonical API schemas and
identifiers. Member 3 returns normalised analysis results through a
service interface and does not write directly to MongoDB. Member 4
consumes the agreed submission representation. Member 1 may use mock
JSON until the API is ready, then must integrate with the real API.

## 7. Phased implementation plan

### Phase 0 --- Alignment and design freeze

-   Confirm owners, supported Python version, upload formats/limits and
    authentication approach.
-   Agree submission states, common finding schema, collection names and
    identifier strategy.
-   Approve API examples and record decisions.
-   Deliver `API_CONTRACT.md`, `DATA_MODEL.md`, `.env.example` and task
    board.
-   **Exit gate:** every member can explain the request lifecycle and
    shared data fields.

### Phase 1 --- Runnable skeleton

-   Create repository, frontend and backend skeletons.
-   Add minimal Next.js page and FastAPI `/health` endpoint.
-   Configure MongoDB connection, Dockerfiles and Compose.
-   Document clean setup and verify it on every teammate's machine.
-   **Exit gate:** clean clone starts using documented commands; backend
    and DB health checks pass.

### Phase 2 --- First vertical slice: Python upload

-   Build submission form and client-side usability validation.
-   Implement multipart endpoint and repeat all validation server-side.
-   Generate UUID; save using server-generated storage name; compute
    SHA-256.
-   Insert MongoDB submission record; return ID/status; display it in
    UI.
-   Handle partial failure (e.g. remove file if DB insert fails).
-   **Exit gate:** browser → API → filesystem + MongoDB works
    end-to-end.

### Phase 3 --- Analysis pipeline

-   Define analyzer interface and implement AST checks.
-   Add Ruff, Radon and Bandit adapters one at a time.
-   Define common finding schema and tool-specific severity mapping.
-   Add orchestration, timeout/error handling and tool-version capture.
-   Persist runs/findings; build retrieval endpoint and findings UI.
-   **Exit gate:** known fixture yields repeatable, correctly displayed
    findings; tool failure is visible and does not corrupt records.

### Phase 4 --- Revision comparison

-   Define project/revision-chain rules and parent submission
    relationship.
-   Validate both submissions exist, are accessible and belong to the
    permitted project.
-   Read source versions, compute unified diff and added/removed line
    counts.
-   Persist comparison; implement API and diff UI.
-   **Exit gate:** controlled pair of revisions yields expected diff and
    summary.

### Phase 5 --- Review and reporting

-   Define review-note schema and create/retrieve endpoints.
-   Build reviewer view with submission, analysis and comparison
    context.
-   Add report generation only if required; include tool versions and
    limitations.
-   Audit important review actions.
-   **Exit gate:** reviewer can inspect and save feedback without
    altering source.

### Phase 6 --- Experimental authorship-pattern module (conditional)

-   Define prediction target; do not conflate style similarity with
    proof of authorship.
-   Use lawful, consented, representative data; document provenance and
    permissions.
-   Prevent author/project leakage between train and test sets.
-   Establish simple baselines; evaluate precision, recall, F1 and
    confusion matrix where applicable.
-   Analyse false positives/negatives and limitations; version
    model/features/evaluation.
-   Integrate only after documented acceptance criteria pass. Otherwise
    show "unavailable" and omit from demo.
-   **Safeguards:** neutral wording, explicitly experimental, no
    misconduct verdicts, no disciplinary automation, separate from
    static findings.

### Phase 7 --- Optional GitHub integration

-   Confirm use case and minimum repository permissions.
-   Keep token server-side; implement read-only connection check first.
-   Prepare issue draft from reviewer-selected findings and display
    exact title/body/repository.
-   Require explicit approval before POST; record approver, timestamp,
    issue URL and status.
-   Handle rate limits, permission failures and network errors.
-   **Exit gate:** no issue can be created without deliberate reviewer
    approval.

### Phase 8 --- Hardening and demo

-   Run tests; test malformed/oversized/unsupported uploads and path
    traversal.
-   Check access control, timeouts, tool failures, secret handling and
    UI states.
-   Prepare demo fixtures, deployment config, rollback steps and
    rehearse from clean environment.
-   **Exit gate:** all MVP acceptance criteria pass.

## 8. API contract

Prefix application routes with `/api/v1`.

  --------------------------------------------------------------------------------------------
  Method                  Endpoint                                     Purpose
  ----------------------- -------------------------------------------- -----------------------
  GET                     `/health`                                    Service health

  POST                    `/api/v1/submissions`                        Upload/create
                                                                       submission

  GET                     `/api/v1/submissions`                        List accessible
                                                                       submissions

  GET                     `/api/v1/submissions/{id}`                   Submission
                                                                       metadata/status

  GET                     `/api/v1/submissions/{id}/source`            Authorised source
                                                                       retrieval, if enabled

  POST                    `/api/v1/submissions/{id}/analyze`           Start/retry analysis if
                                                                       not automatic

  GET                     `/api/v1/submissions/{id}/analysis`          Analysis result

  POST                    `/api/v1/comparisons`                        Compare two revisions

  GET                     `/api/v1/comparisons/{id}`                   Retrieve comparison

  POST                    `/api/v1/reviews`                            Create review note

  GET                     `/api/v1/submissions/{id}/reviews`           List review notes

  POST                    `/api/v1/integrations/github/issues/draft`   Prepare issue draft

  POST                    `/api/v1/integrations/github/issues`         Create issue after
                                                                       approval
  --------------------------------------------------------------------------------------------

### Upload request

`multipart/form-data`: `file` (required), `project_id` (optional for
first submission), `parent_submission_id` (optional), `display_name`
(optional). Server generates IDs and storage keys; supplied filename is
display metadata only.

Illustrative response:

``` json
{
  "submission_id": "uuid",
  "project_id": "uuid",
  "status": "queued",
  "filename": "solution.py",
  "created_at": "2026-10-30T16:00:00Z"
}
```

### Analysis response

``` json
{
  "analysis_id": "uuid",
  "submission_id": "uuid",
  "status": "completed",
  "summary": {
    "finding_count": 1,
    "error_count": 0,
    "warning_count": 1,
    "info_count": 0
  },
  "findings": [
    {
      "finding_id": "uuid",
      "tool": "ruff",
      "rule_id": "F401",
      "category": "maintainability",
      "severity": "warning",
      "message": "Imported name is unused",
      "file": "solution.py",
      "line": 4,
      "column": 1,
      "suggestion": null
    }
  ],
  "tool_versions": {"ruff": "version"},
  "completed_at": "2026-10-30T16:00:05Z"
}
```

### Comparison contract

Request: `{"base_submission_id":"uuid","target_submission_id":"uuid"}`.
Response includes `comparison_id`, both submission IDs, `summary`
(`added_lines`, `removed_lines`, `changed_files`), unified `diff` and
timestamp. A diff indicates change, not quality improvement.

### Standard error

``` json
{
  "error": {
    "code": "INVALID_FILE_TYPE",
    "message": "Only Python source files are supported.",
    "details": null,
    "request_id": "uuid"
  }
}
```

Use stable machine-readable error codes. Never expose stack traces,
internal paths or secrets.

### Submission states

``` text
queued → processing → completed
                   ↘ failed
```

Decide whether retry creates a new analysis run or reuses a record;
preserve history and use the same state machine throughout.

## 9. Data model and persistence

### Storage split

**MongoDB:** project metadata, submission metadata/ownership, storage
key and hash, analysis runs, normalised findings, comparisons, reviews,
audit events and GitHub action references.

**Private filesystem:** original source files and optional generated
artefacts unsuitable for MongoDB documents. Never expose uploads through
the public web root. A future move to private object storage should not
require changing the API contract.

### Collections

  -----------------------------------------------------------------------
  Collection                          Contents
  ----------------------------------- -----------------------------------
  `projects`                          Project metadata and owner

  `submissions`                       IDs, ownership, revision link,
                                      source reference, hash, status

  `analysis_runs`                     Status, tool versions, findings and
                                      summary

  `comparisons`                       Base/target IDs, diff and summary

  `reviews`                           Reviewer notes and timestamps

  `audit_events`                      Important user/integration actions
  -----------------------------------------------------------------------

Example submission document:

``` json
{
  "_id": "uuid",
  "project_id": "uuid",
  "owner_id": "user-or-demo-id",
  "parent_submission_id": null,
  "original_filename": "solution.py",
  "language": "python",
  "storage_key": "opaque-generated-name.py",
  "source_sha256": "hex-digest",
  "size_bytes": 2048,
  "status": "queued",
  "created_at": "ISODate",
  "updated_at": "ISODate"
}
```

Create indexes for `submissions.project_id`, `submissions.owner_id`,
`submissions.created_at`, `analysis_runs.submission_id`, comparison
base/target IDs, `reviews.submission_id` and `audit_events.created_at`.
Decide whether IDs are UUID strings or ObjectIds and use one strategy
consistently. Store UTC timestamps, tool versions and hashes.
Re-analysis should remain traceable; never silently overwrite historical
evidence.

## 10. Backend implementation details

### Module responsibilities

-   `main.py`: app creation, routers, middleware and startup checks.
-   `core/config.py`: central settings.
-   `core/database.py`: Mongo client/database lifecycle.
-   `core/errors.py`: application exceptions and error mapping.
-   `core/logging.py`: structured logs and request IDs.
-   `api/routes`: HTTP validation and service invocation.
-   `services`: business workflows/orchestration.
-   `repositories`: database operations.
-   `analyzers`: tool adapters and result normalisation.

### Submission service sequence

1.  Validate extension, size and encoding.
2.  Validate project and parent relationship.
3.  Generate IDs and opaque storage key.
4.  Save source and compute SHA-256.
5.  Insert submission metadata.
6.  Start/schedule analysis.
7.  Clean up file if DB persistence fails.
8.  Return typed response.

### File safety

-   Allow `.py` initially; enforce configurable server-side size limit.
-   Do not trust MIME type or filename.
-   Generate storage name; resolve path beneath configured upload root
    and verify containment.
-   Reject unusable empty/invalid-encoding files with a clear error.
-   Never execute uploaded code.
-   Invoke tools with fixed argument arrays, not shell-concatenated user
    input.
-   Apply timeout and resource limits; capture tool output safely.

### Analyzer interface sketch

``` python
from typing import Protocol

class Analyzer(Protocol):
    name: str

    def analyze(self, source_path: str) -> list[dict]:
        ...
```

Use typed domain/Pydantic models in the real implementation. Each
adapter records its version, applies a timeout, returns normalised
findings or a structured error, and avoids leaking host paths.

## 11. Static-analysis findings

Common finding fields: `finding_id`, `tool`, `rule_id`, `category`,
`severity`, `message`, `file`, `line`, `column`, `end_line`,
`end_column`, `suggestion`, optional `documentation_url`.

Suggested categories: correctness/syntax, maintainability, complexity,
security-oriented static finding, style/formatting. Map each tool's
severity explicitly; do not imply severities from different tools are
identical. The UI shows status, counts, grouped findings, tool
attribution, source location, explanation, remediation and failed
checks. "No findings" must be distinct from "analysis did not run".

## 12. Revision comparison

Before comparing, verify existence, access, compatible language/type,
project/revision relationship and source integrity. Read both versions
as text, normalise line endings without changing meaningful content,
compute unified diff, count additions/deletions excluding diff metadata,
persist result and return it.

The UI labels base/target revisions, shows additions/deletions
accessibly, preserves indentation, supports long diffs, and handles
no-change state. Never label additions as improvements automatically.

## 13. Frontend implementation

### Page plan

  -----------------------------------------------------------------------
  Page                    Components              API dependency
  ----------------------- ----------------------- -----------------------
  Dashboard               Recent submissions,     List submissions
                          projects, status        
                          summary                 

  New submission          File picker, project    Create submission
                          selector, submit        

  Submission detail       Metadata, status,       Get submission/analysis
                          analysis summary        

  Findings                Filters and finding     Get analysis
                          details                 

  Compare                 Revision selectors and  Create/get comparison
                          diff panel              

  Review                  Context, notes,         Review/integration
                          optional issue draft    endpoints
  -----------------------------------------------------------------------

Suggested component groups: `layout` (AppShell, Sidebar, Header),
`submissions` (SubmissionForm, SubmissionCard, SubmissionStatus),
`analysis` (AnalysisSummary, FindingList, FindingCard, ToolStatus),
`comparison` (RevisionSelector, DiffViewer, DiffSummary), `review`
(ReviewForm, ReviewHistory).

Create one typed API client module. Read base URL from environment,
parse standard errors, centralise endpoint functions and avoid
duplicated fetch logic. When using browser `FormData`, do not manually
set multipart `Content-Type`; let the browser set its boundary.

Every data-driven screen handles loading, empty, success, validation
error, network error, pending, failed, partial analysis and
permission/not-found states. Never ship a GitHub token or other secret
to the browser.

## 14. ML authorship-pattern experiment

Treat this as a conditional research experiment, not the platform's
source of truth. First define the prediction target. Style similarity,
known-author classification and proof of authorship are different
claims.

Potential features (only after validation): identifier patterns,
function/class structure, function length, formatting, AST statistics,
comments/docstrings, operator/expression distributions and complexity
metrics. Document confounders and rationale.

Dataset must have appropriate permission/licence, accurate labels,
provenance, and author/project-aware splits to prevent leakage. Do not
train on private student submissions without explicit consent and
institutional approval. Establish baselines; report dataset size/class
distribution, split method, precision/recall/F1, confusion matrix and
error analysis. Accuracy alone is insufficient for imbalanced classes.

Only integrate with a reproducible evaluation report. Use neutral
wording, explain limitations, permit "not enough
evidence"/"unavailable", and never trigger disciplinary action.

## 15. GitHub integration

``` text
Reviewer selects findings
        ↓
Backend prepares draft
        ↓
UI shows exact title/body/repository
        ↓
Reviewer explicitly approves
        ↓
Backend checks permission and calls GitHub
        ↓
Persist issue URL, status and audit event
```

Keep token server-side, request minimum permissions, validate target
repository, avoid including private source unless explicitly selected,
handle rate limits/errors and guard against accidental duplicate issue
creation where feasible. Record approver and timestamp.

## 16. Security, privacy and reliability checklist

-   [ ] Backend enforces extension and size allowlists.
-   [ ] Storage names are server-generated; path traversal is prevented.
-   [ ] Upload directory is private; submitted code is never executed.
-   [ ] Tool calls use fixed arguments and bounded time/resources.
-   [ ] Temporary files are cleaned up.
-   [ ] Every resource access checks ownership/role.
-   [ ] Secrets are outside source control; CORS is restricted.
-   [ ] Deployed environment uses HTTPS.
-   [ ] Logs avoid secrets and unnecessary source contents.
-   [ ] Retention/deletion policy is defined before real student data is
    used.
-   [ ] ML is experimental, evaluated and not used for automated
    accusations.
-   [ ] Partial tool failure and retries are represented accurately.

## 17. Testing strategy

### Backend unit tests

Cover file validation, storage-key generation, hashing, state
transitions, AST parsing, finding normalisation, severity mapping, diff
generation/counts, ownership checks and error conversion.

### Integration tests

Use disposable MongoDB and temporary storage. Test create/retrieve
submission, analysis persistence, comparison, review, unauthorised
access, tool timeout/failure and cleanup after persistence failure.

### Frontend tests

Test form validation, loading/error states, empty/populated findings,
completed/failed analysis, revision selection, diff display and review
validation.

### End-to-end scenario

1.  Start app and database.
2.  Submit known Python file.
3.  Retrieve status and analysis.
4.  Submit a second revision.
5.  Compare versions.
6.  Create a review note.
7.  Refresh and confirm persistence.

Suggested fixtures: `valid_simple.py`, `syntax_error.py`,
`unused_import.py`, `high_complexity.py`, `security_pattern.py`,
`revision_v1.py`, `revision_v2.py`. Fixtures should be intentionally
authored and contain no secrets/personal data.

Before merge: tests pass, lint/format passes, no secrets committed,
contract changes documented, new behaviour tested and relevant docs
updated.

## 18. Docker and local integration

Initial Compose services: `frontend`, `backend`, `mongo`. Persist upload
directory and MongoDB development volume. Frontend reaches backend by
Compose service name; backend reaches MongoDB by service name. Separate
development reload from production configuration and use health checks
where supported.

``` bash
docker compose config
docker compose up --build
docker compose ps
docker compose logs -f backend
```

Document safe stop/reset commands. Never delete volumes containing data
that must be retained.

## 19. Six-week schedule

  -----------------------------------------------------------------------------
  Week                    Focus                   Outcome
  ----------------------- ----------------------- -----------------------------
  1                       Contracts, repo,        Everyone runs project;
                          environment, skeleton   contracts approved

  2                       Upload and submission   Browser-to-storage/database
                          lifecycle               flow works

  3                       Static analysis         Normalised findings displayed

  4                       Comparison and review   Revisions compare; reviewer
                                                  notes work

  5                       Conditional ML and      Evaluation report;
                          optional GitHub         approval-gated integration

  6                       Hardening, testing,     Acceptance criteria pass
                          deployment, demo        
  -----------------------------------------------------------------------------

Weekly review: each member reports completed and demonstrable work,
blockers, contract changes, next integration dependency and next-week
commitment. Code written but not integrated/tested is not complete.

## 20. Integration checkpoints

  -----------------------------------------------------------------------
  Checkpoint              Demonstration           Blocker if failed
  ----------------------- ----------------------- -----------------------
  I1                      Frontend reaches        Pause independent
                          FastAPI health endpoint integration

  I2                      Upload creates DB       Do not build on
                          record and source file  unstable submission
                                                  model

  I3                      Analysis stored and     Do not finalise
                          retrieved               findings UI against
                                                  mocks only

  I4                      Two submissions compare Do not finalise
                          correctly               revision workflow

  I5                      Review note persists    Do not finalise review
                                                  demo

  I6                      Clean Compose startup   Do not declare MVP
                          and full demo           ready
  -----------------------------------------------------------------------

Maintain `docs/INTEGRATION_LOG.md` with date, PR/commit, issue and
resolution.

## 21. Definition of done

-   [ ] Acceptance criteria written and met.
-   [ ] Change merged into shared branch.
-   [ ] Normal and important failure cases tested.
-   [ ] Backend inputs validated.
-   [ ] Errors handled and clearly presented.
-   [ ] No secrets/private test data committed.
-   [ ] API/data contracts updated.
-   [ ] UI handles loading, empty, success and failure states.
-   [ ] Teammate review completed.
-   [ ] Feature works in integrated environment.

## 22. MVP acceptance criteria

1.  App starts using documented instructions.
2.  User submits valid Python source.
3.  Backend validates and stores source safely.
4.  Submission metadata persists in MongoDB.
5.  Static analysis runs without executing submitted code.
6.  Findings are normalised and displayed with tool/location.
7.  User submits and compares a revision.
8.  Reviewer inspects results and saves a note.
9.  Failed/unavailable optional checks are represented honestly.
10. Access checks prevent unauthorised retrieval.
11. GitHub issue creation, if present, requires explicit approval.
12. ML, if present, has documented evaluation and is not proof of
    authorship.
13. End-to-end workflow passes in demo environment.

## 23. Risks and mitigations

  -----------------------------------------------------------------------
  Risk                                Mitigation
  ----------------------------------- -----------------------------------
  Late API agreement                  Freeze schemas/examples in Week 1

  Isolated parallel work              Build vertical slices; integrate
                                      continuously

  Inconsistent tool output            Adapters and common finding schema

  Slow analysis                       Bound size/time; worker only when
                                      justified

  Unsafe submitted code               Never execute; restrict
                                      tools/storage

  Weak ML dataset                     Make ML conditional; evaluate or
                                      omit

  False authorship attribution        Neutral wording; no disciplinary
                                      automation

  Token exposure                      Server-side secret handling; least
                                      privilege

  Environment mismatch                Pin versions and use Compose

  Scope expansion                     Protect MVP; defer optional
                                      features
  -----------------------------------------------------------------------

## 24. Decisions to confirm

  -----------------------------------------------------------------------
  Decision                Proposed baseline       Owner(s)
  ----------------------- ----------------------- -----------------------
  Python version          Pin one compatible      Backend + analysis
                          version                 

  Node version            Agreed LTS              Frontend

  MongoDB deployment      Compose locally;        Backend
                          deployment TBD          

  Authentication          Real role-based auth vs Whole team
                          controlled demo         
                          identity                

  Roles                   Student and             Whole team
                          faculty/reviewer        

  Upload limit            Proposed 5 MB initially Backend + analysis

  Multi-file projects     Single `.py` first      Whole team

  Analysis execution      Bounded synchronous MVP Backend + analysis

  ML inclusion            Only if                 ML owner + team
                          dataset/evaluation pass 

  GitHub                  Optional; explicit      Integration owner
                          approval                

  Deployment host         TBD                     Whole team

  Retention               Define before real      Whole team/institution
                          student data            
  -----------------------------------------------------------------------

## 25. Task board checklist

### Foundation

-   [ ] Create repository and branch conventions
-   [ ] Pin Python and Node versions
-   [ ] Create `.env.example`
-   [ ] Create FastAPI skeleton and health endpoint
-   [ ] Create Next.js skeleton
-   [ ] Configure MongoDB
-   [ ] Add Docker Compose
-   [ ] Write setup README
-   [ ] Approve API contract and data model

### Submission

-   [ ] Build upload form
-   [ ] Implement server-side validation
-   [ ] Implement safe storage and SHA-256
-   [ ] Implement submission repository/service
-   [ ] Implement upload/detail endpoints
-   [ ] Connect frontend to real API
-   [ ] Add integration tests

### Analysis

-   [ ] Define analyzer interface
-   [ ] Implement AST, Ruff, Radon and Bandit adapters
-   [ ] Define and normalise finding schema
-   [ ] Implement orchestration and timeouts
-   [ ] Persist analysis runs
-   [ ] Implement result endpoint and UI
-   [ ] Test tool failures/timeouts

### Comparison and review

-   [ ] Define revision-chain rules
-   [ ] Implement diff and summary
-   [ ] Implement comparison endpoints/UI
-   [ ] Define review schema and endpoints
-   [ ] Build review UI
-   [ ] Add integration tests

### Optional extensions

-   [ ] Define ML prediction target
-   [ ] Confirm dataset permission/provenance
-   [ ] Build baseline and evaluate leakage/errors
-   [ ] Approve neutral UI wording
-   [ ] Implement GitHub connection check
-   [ ] Implement issue draft and approval flow
-   [ ] Persist integration audit event

### Release

-   [ ] Run backend, frontend and end-to-end tests
-   [ ] Run security checklist
-   [ ] Verify clean Compose startup
-   [ ] Prepare demo fixtures and script
-   [ ] Update README/docs
-   [ ] Review acceptance criteria
-   [ ] Tag release candidate

## 26. Demonstration runbook

1.  Start stack using Compose.
2.  Open dashboard and submit `valid_simple.py`.
3.  Show submission status and persisted metadata.
4.  Open analysis and explain a finding, source tool and location.
5.  Submit `revision_v2.py` linked to prior revision.
6.  Compare versions and explain added/removed lines.
7.  Add a reviewer note.
8.  If GitHub exists, show draft and approval requirement.
9.  If ML exists, explain dataset/evaluation limitations before showing
    output.
10. End with architecture and test evidence.

**Fallback:** if an optional service fails, show it as
unavailable/failed, do not fabricate results, continue with the working
core flow and explain the limitation.

## 27. Change management

Changes to API schemas, status values, identifiers, storage layout,
finding schema/severity mapping, execution model, auth/roles, ML wording
or GitHub permissions require a recorded decision and review by affected
owners.

Record:

``` text
Decision ID:
Date:
Change:
Reason:
Alternatives considered:
Affected modules:
Migration/backward-compatibility impact:
Approved by:
```

## 28. Final implementation principles

1.  Build submit → store → analyse → display first.
2.  Keep the architecture modular without unnecessary infrastructure.
3.  Agree contracts before parallel implementation.
4.  Treat uploaded code as untrusted; never execute it.
5.  Normalise analysis output before exposing it.
6.  Preserve revision history and traceable comparisons.
7.  Separate static-analysis evidence from experimental ML estimates.
8.  Never present an authorship estimate as proof or an automatic
    misconduct decision.
9.  Require explicit approval for external write actions.
10. Prioritise an integrated, tested, demonstrable MVP over unfinished
    scope.

------------------------------------------------------------------------

**End of implementation plan.**
