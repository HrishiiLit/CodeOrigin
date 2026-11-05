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

### Version 2 (V2) — Automated Student Project Evaluation Bot Scope

V2 extends CodeOrigin AI from a manual review assistant into an automated **Student Project Evaluation Bot**:
1. **Token-Based Winnowing**: Structural AST tokenization, comment/whitespace stripping, k-gram rolling hashing.
2. **University Division Cohort Similarity Matrix**: Asynchronous cohort-wide comparison engine triggered by faculty to evaluate all submissions across a class or division.
3. **Multi-Signal AI-Generated Code Detection**: Stylometry analysis, textbook docstring/comment heuristics, leaked prompt artifact detectors, and token perplexity/burstiness indicators.
4. **"Defend Your Code" Oral Viva Question Generator**: Automatic extraction of high-complexity AST hotspots to synthesize pointed conceptual questions with expected answers.
5. **Rubric-Based LLM Semantic Grading**: Bounded criterion evaluation against structured assignment rubrics (modularity, error handling, edge cases).
6. **Software Heritage Cryptographic Lookup**: Sub-second batch file SHA-1/SHA-256 matching against Software Heritage (250M+ open-source repositories).
7. **Distinctive Anchor Search (Zero-Cost Probing)**: Probing GitHub Code Search using unique error strings, docstring anchors, and specialized domain terms.
8. **Git History & Commit Graph Forensics**: Scoring commit cadence, branch hygiene (feature branches vs single bulk dump), author verification, and deletion churn.
9. **Hugging Face Open-Weight & RAG Evaluation Model**: Local open-weight code evaluation models (e.g. StarCoder/CodeLlama) and RAG indexing course syllabus, guidelines, and reference architectures.

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

### Phase 9 (V2) --- Open-Source Repository Clone Detection & Git Forensics

-   **Software Heritage Cryptographic Lookup**: Parallel async lookup of source file SHA-1/SHA-256 hashes against SWH REST API (`https://archive.softwareheritage.org/api/1/content/`).
-   **Distinctive Anchor Search (Zero-Cost Probing)**: Extract unique AST string literals, exception messages, and config comments; query GitHub Code Search API with strict rate limiting.
-   **Git Commit Graph Forensics**:
    -   Parse `.git` commit graph: commit volume, cadence, churn ratio (`deletions / additions`), author emails vs institutional identity.
    -   Score industry engineering habits: multi-branch workflows (feature branches vs monolithic single commit), PR-like merges, meaningful commit messages.
-   **Production Boilerplate Mismatch Detector**: Flag enterprise deployment infrastructure (Terraform, Helm, Kubernetes manifests, OpenTelemetry/Sentry configs) uncharacteristic of student projects.
-   **Exit gate:** Ingesting a known public repository flag 95%+ identical hashes and surfaces the upstream origin URL in under 3 seconds.

### Phase 10 (V2) --- Token-Based Winnowing & University Division Cohort Similarity Engine

-   **Winnowing Fingerprinting**:
    -   Tokenize Python code via AST/pygments, normalize variable names and function names (`VAR`, `FUNC`), remove comments/docstrings.
    -   Generate k-gram hashes (k=25, window=4) using Karp-Rabin or MD5 rolling hashes.
    -   Store token fingerprints in MongoDB `code_fingerprints` inverted index.
-   **Division Cohort Similarity Matrix**:
    -   Asynchronous batch evaluation triggered by faculty: `POST /api/v1/projects/{project_id}/cohort-evaluate`.
    -   Pairwise containment and Jaccard similarity across all student submissions in the division.
    -   Cluster graph visualization in frontend showing collusion rings and matching line spans.
-   **Exit gate:** Synthesized plagiarism fixtures with renamed variables and swapped loops detect >80% token overlap while keeping false positives below 5% on standard boilerplate.

### Phase 11 (V2) --- Multi-Signal AI Code Detection & Hugging Face RAG Evaluator

-   **Multi-Signal AI Heuristics**:
    -   Stylometry: over-pedantic comments (`# Increment counter by 1`), textbook Sphinx/Google docstrings on trivial helpers, leaked markdown artifacts (`\`\`\`python`).
    -   Entropy/Perplexity: Compute token log-likelihood and burstiness using a lightweight open-weight local model.
    -   Revision Velocity: Flag instant jumps of 500+ lines of production code without incremental intermediate revisions.
-   **Hugging Face Open-Weight / RAG Semantic Evaluator**:
    -   Serve a local open-weight model (e.g. CodeLlama-7B-Instruct / StarCoder2 or quantized via llama.cpp/Ollama).
    -   RAG Architecture: Index course syllabus, assignment problem descriptions, and grading rubrics in a local vector store (ChromaDB / FAISS).
    -   Rubric-Based Evaluation: Grade submissions against structured criteria (Architecture, Modularity, Error Handling, Constraint Adherence) returning numeric points and constructive justifications.
-   **Exit gate:** AI risk scorecard returns transparent heuristic breakdown with clear educational disclaimers; RAG model generates consistent rubric scoring without hallucinated requirements.

### Phase 12 (V2) --- "Defend Your Code" Oral Viva Generator & Evaluation Bot Synthesis

-   **Oral Viva Question Generator**:
    -   Scan AST for highest Cyclomatic Complexity (Radon Rank C-F) and advanced language constructs (`metaclasses`, `threading`, `asyncio`, low-level bitwise operations).
    -   Synthesize 3-5 pointed oral defense questions per submission targeting exact file/line coordinates, with expected conceptual answers and common traps for copied code.
-   **Evaluation Bot Synthesis Report**:
    -   Aggregate Static Findings + Authenticity Audit + Plagiarism Matrix + AI Risk Score + RAG Rubric Grade + Viva Questions into a unified Faculty Evaluation Dashboard.
    -   Exportable evaluation dossier (PDF / Markdown).
-   **Exit gate:** Faculty reviewer receives a 1-page evaluation card that enables a definitive 60-second oral viva verification.

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

-   [x] Acceptance criteria written and met.
-   [x] Change merged into shared branch.
-   [x] Normal and important failure cases tested.
-   [x] Backend inputs validated.
-   [x] Errors handled and clearly presented.
-   [x] No secrets/private test data committed.
-   [x] API/data contracts updated.
-   [x] UI handles loading, empty, success and failure states.
-   [x] Teammate review completed.
-   [x] Feature works in integrated environment.

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

-   [x] Run backend, frontend and end-to-end tests
-   [x] Run security checklist
-   [x] Verify clean Compose startup
-   [x] Prepare demo fixtures and script
-   [x] Update README/docs
-   [x] Review acceptance criteria
-   [x] Tag release candidate

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

## 28. Open-Source Theft Detection & Git Graph Forensics Engine (V2)

### 28.1 Software Heritage (SWH) Cryptographic Verification
- Software Heritage indexes 250M+ public git repositories with exact SHA-1/SHA-256 hashes for all historical files.
- The `AuthenticityService` hashes every extracted `.py` file:
  ```python
  sha1_hash = hashlib.sha1(file_bytes).hexdigest()
  url = f"https://archive.softwareheritage.org/api/1/content/sha1:{sha1_hash}/"
  ```
- Sub-second execution: parallel asynchronous HTTP calls with a 3-second bounded timeout.
- Matches are tagged with upstream origin metadata (first seen date, original repository URL).

### 28.2 Distinctive Anchor Search (Zero-Cost Probing)
- AST parses string literals, custom exception messages, and specialized dictionary keys.
- Filters out generic strings (e.g. `"utf-8"`, `"error"`, `"__main__"`).
- Selects the 3 highest-entropy strings (length > 25, low character repetition) and probes the GitHub Code Search API (`/search/code?q=`).
- Instantly surfaces public repositories from which full files or modules were cloned.

### 28.3 Git Commit Graph & Engineering Hygiene Forensics
- Parses `.git` commit graph when student submits via GitHub ingest or archive containing git history:
  1. **Commit Count & Distribution**: Flags repositories with ≤ 2 commits and > 1,500 lines of code.
  2. **Churn Ratio**: `deletions / max(1, additions)`. Real engineering involves rewriting/debugging; churn < 0.02 on large codebases signals bulk copy-paste.
  3. **Branch Hygiene & Industry Workflow Scoring**: Awards positive authenticity scores for feature branch workflows (`git branch`, PR merges) versus monolithic direct commits to `main`.
  4. **Author Email Integrity**: Validates author emails in commits against the student's registered institutional ID (`X-User-ID`).

---

## 29. Token-Based Winnowing & Division Cohort Similarity Engine (V2)

### 29.1 Tokenization & Normalization Pipeline
1. Lexical tokenization via Python AST/tokenize.
2. Strip comments, docstrings, formatting, and whitespace.
3. Identifier Normalization: All local variable names replaced by `VAR`, function names by `FUNC`, class names by `TYPE`.
4. Converts code into a canonical token string invariant to variable renaming or code reformatting.

### 29.2 Winnowing Algorithm
- Form $k$-grams of tokens (default: $k=25$).
- Compute rolling Karp-Rabin or MD5 hashes for each $k$-gram.
- Select minimum hash value within each sliding window of size $w$ (default: $w=4$) to generate the document fingerprint.
- Persist fingerprints in MongoDB `code_fingerprints` with inverted index on `fingerprint_hash`.

### 29.3 Division Cohort Similarity Matrix Workflow
1. Students submit their projects individually throughout the assignment window.
2. When the faculty or admin initiates cohort evaluation:
   `POST /api/v1/projects/{project_id}/cohort-evaluate`
3. Engine runs an $O(N^2)$ pairwise containment & Jaccard index evaluation across all submissions in that division/project.
4. Outputs:
   - Pairwise similarity matrix (Heatmap data).
   - Collusion clusters: Submissions sharing > 70% structural token overlap.
   - Synchronized line span viewer highlighting copied code regions side-by-side.

---

## 30. Multi-Signal AI Code Detection & Hugging Face RAG Evaluation (V2)

### 30.1 Multi-Signal AI Detection Heuristics
Rather than relying on a single black-box classifier, CodeOrigin aggregates 4 distinct heuristic signals:
1. **Stylometry & Comments**: Flags over-explanatory elementary inline comments (`# initialize x to 0`) and textbook Google/Sphinx docstrings on simple 2-line helpers.
2. **Prompt Leaks & Artifacts**: Regex scans for chat remnants (`\`\`\`python`, `Certainly! Here is the implementation`, `# Note: ensure dependencies are installed`).
3. **Token Perplexity & Burstiness**: Measures likelihood distributions using an open-weight model; human code has high stylistic variance, whereas AI code has flat, low-perplexity token distributions.
4. **Revision Velocity Anomaly**: CodeOrigin Comparison Engine flags 500+ line insertions appearing in < 1 minute without preceding incremental syntax revisions.

### 30.2 Hugging Face Open-Weight & RAG Evaluation Architecture
- **Inference Runtime**: Supports serving open-weight code models (e.g. `bigcode/starcoder2-3b`, `CodeLlama-7b-Instruct`, or quantized GGUF via llama.cpp/Ollama) completely on-premise without sending student code to external third parties.
- **Retrieval-Augmented Generation (RAG)**:
  - Vector database (ChromaDB / FAISS) stores embeddings of course syllabus, project assignment descriptions, and official grading rubrics.
  - Contextual Retriever retrieves relevant rubric constraints and provides them as grounding context.
- **Rubric-Based Semantic Grading**:
  - Scores submissions across bounded categories:
    - Architecture & Separation of Concerns (0–25 pts)
    - Error Handling & Input Validation (0–25 pts)
    - Algorithmic Efficiency & Edge Cases (0–25 pts)
    - Adherence to Assignment Constraints (0–25 pts)
  - Produces structured JSON output with numeric points and line-referenced explanations.

---

## 31. "Defend Your Code" Oral Viva Question Generator & Bot Synthesis (V2)

### 31.1 Oral Viva Question Generation
- Scans AST for high-complexity hotspots:
  - Functions with Radon Cyclomatic Complexity $\ge 10$ (Rank C–F).
  - Advanced Python features: metaclasses (`type`), generators (`yield from`), decorators, concurrent threads/asyncio, `ctypes`, memory buffers.
  - Unusual third-party dependencies imported in source.
- Synthesizes 3 targeted oral questions per project:
  - **Question 1: Architectural Rationale** ("Why did you choose an iterative deepening search over BFS in line 42?")
  - **Question 2: Complexity Bottleneck** ("If the input dataset doubles to $10^6$, which function becomes the bottleneck?")
  - **Question 3: Error & Edge Case Defense** ("What happens in `parse_header` if the packet length header is truncated?")
- Includes private **Expected Concepts & Catch Triggers** for the faculty member to easily spot a student who does not know their own code.

### 31.2 Automated Evaluation Bot Synthesis
- Aggregates all pipelines into an executive **Student Evaluation Card**:
  - Static Code Health (Linting, Security, Complexity).
  - Authenticity Confidence (Clean / Suspicious / High Risk OSS Match).
  - Cohort Collusion Status (Independent vs Matched with Student X).
  - AI Generation Risk Index (0–100% with supporting heuristic breakdown).
  - RAG Rubric Grade (Points breakdown + constructive feedback).
  - 3 Targeted Oral Defense Questions.

---

## 32. Final implementation principles

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
