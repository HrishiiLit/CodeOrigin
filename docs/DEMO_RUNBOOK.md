# CodeOrigin AI - Demonstration Runbook (Version 1 / MVP)

This document provides a step-by-step walkthrough for demonstrating the complete CodeOrigin AI Version 1 system to faculty, stakeholders, and academic evaluators. It aligns with **Section 26 (Demonstration runbook)** and validates all **MVP Acceptance Criteria (Section 22)** of the implementation plan.

---

## 1. Quick Demo Options

### Option A: Fully Automated One-Click Seed (Fastest)
If you want to immediately pre-populate the system with complete demo data:
```bash
# Seed all submissions, multi-tool analysis, revision comparison, and faculty reviews
python backend/scripts/seed_demo.py
```
This executes the full pipeline in < 5 seconds and prints clickable URLs for the web interface.

### Option B: Interactive Live Demo (Recommended for Presentations)
Follow the 10-step sequence below through the web UI and live API.

---

## 2. Interactive 10-Step Demonstration Sequence

### Step 1: Start the Application Stack
Ensure backend and frontend are running.

**Backend (FastAPI):**
```bash
cd backend
.venv\Scripts\activate
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```
*Health verification:* Open `http://localhost:8000/health` (returns status `ok`, database mode, storage path).

**Frontend (Next.js):**
```bash
cd frontend
npm run dev
```
*Dashboard access:* Open `http://localhost:3000`.

---

### Step 2: Ingest Initial Student Submission (`valid_simple.py`)
1. In the browser, navigate to **Submissions** (`http://localhost:3000/submissions`).
2. Click **+ New Submission**.
3. Choose the fixture file: `fixtures/demo/valid_simple.py`.
4. Enter Display Name: `v1-Math-Parser-Evaluation`.
5. Click **Upload & Register**.
6. **Narrative to Evaluators:**
   > *"The student (Alex Chen) submits their initial command-line arithmetic parser. The backend immediately computes a cryptographic SHA-256 hash, isolates the file safely in storage, and records persistent metadata."*

---

### Step 3: Inspect Ingested Metadata & Integrity
1. Click **Inspect →** on the newly created submission.
2. Highlight:
   - Unique Submission UUID and Project UUID.
   - Status badge transitions from `queued` to `processing` to `completed`.
   - Immutable SHA-256 fingerprint matching the physical source file.
   - Clean source code viewer displaying syntax-highlighted code.

---

### Step 4: Multi-Tool Static Analysis (Zero Execution Protection)
1. On the submission details page, click **Run Static Analysis** (or inspect existing results).
2. **Narrative to Evaluators:**
   > *"Notice that CodeOrigin AI executes static analysis in strict read-only sandboxing without ever executing the student's code runtime (`os.system` / `eval` are never triggered). Four industry-standard analyzers run concurrently:"*
3. Highlight specific normalized findings:
   - **AST Analyzer:** Flags dynamic execution hazard (`eval()` on line 26) and argument count.
   - **Bandit Analyzer:** Flags security vulnerability `B307` (`Use of possibly insecure function - eval`).
   - **Radon Analyzer:** Flags cyclomatic complexity `RADON_CC_C` (score: 11) in `dispatch_operation`.
   - **Ruff Analyzer:** Flags unused imports (`math`, `os`, `sys`).
4. Filter findings by **Severity** (Errors, Warnings, Info) and **Category** (Security, Complexity, Style).

---

### Step 5: Submit Refactored Revision (`revision_v2.py`)
1. Click **Compare & Revisions** or return to **Submissions**.
2. Upload `fixtures/demo/revision_v2.py`:
   - Set **Parent Submission ID** to the ID of `valid_simple.py`.
   - Set Display Name: `v2-Refactored-Safe-Parser`.
3. Run static analysis on `v2`.
4. **Narrative to Evaluators:**
   > *"The student incorporates pedagogical feedback: they replaced dynamic eval with Python's `ast` parser, eliminated unused imports, and refactored the dispatcher into an operator table."*
5. Total findings drop from 11 down to 7 (Bandit security error is completely resolved).

---

### Step 6: Side-by-Side Revision Comparison
1. Navigate to **Compare** (`http://localhost:3000/compare`).
2. Select Base Revision: `v1-Math-Parser-Evaluation`.
3. Select Target Revision: `v2-Refactored-Safe-Parser`.
4. Click **Compare Revisions**.
5. Explain the diff:
   - Green added lines (`+66`) showing the `SafeCalculator` class and AST node visitor.
   - Red removed lines (`-63`) showing the removal of insecure `eval()` and nested branching.
   - Summary card displaying line delta and changed files count.

---

### Step 7: Faculty Review & Qualitative Feedback
1. Navigate to **Review Hub** (`http://localhost:3000/review`).
2. Switch role to **Faculty Mode** (Prof. Marcus Vance).
3. Select the `v2` submission.
4. Enter Review Note:
   > *"Commendable refactoring effort. The AST arithmetic parser completely eliminates the Bandit B307 vulnerability, and cyclomatic complexity dropped from rank C to rank A."*
5. Click **Submit Review Note**.
6. Click **Generate Comprehensive Report**:
   - Displays combined multi-tool findings, revision delta, reviewer notes, and academic audit record in a unified exportable document.

---

### Step 8: Human-in-the-Loop GitHub Issue Integration
1. On the submission findings view or Review Hub, select the remaining findings (e.g., AST/Ruff warnings).
2. Click **Export to GitHub Issue**.
3. **Draft Mode:**
   - Observe the pre-filled title and Markdown body formatted with code snippets, tool attributions, and remediation suggestions.
   - Emphasize: *No external API request has been sent yet.*
4. **Explicit Approval Gate:**
   - Notice the required **"I explicitly approve creating this issue on GitHub"** confirmation checkbox.
   - Attempting to submit without confirmation is rejected by backend security policy (`EXPLICIT_APPROVAL_REQUIRED`).
5. Confirm and submit (or demonstrate audit log recording in offline mode).

---

### Step 9: Multi-File Student Repository Ingestion
1. Upload `fixtures/demo/sample_project.zip`.
2. Inspect the **Repository Tree Browser**:
   - Browse multi-file structure: `main.py`, `calculator/core.py`, `calculator/operations.py`, `calculator/formatter.py`.
   - Click individual files to load code on-demand.
   - Run static analysis across the entire project repository in parallel.

---

### Step 10: Test Evidence & Verification of Exit Criteria
Demonstrate technical rigor by running the automated test suite:
```bash
# Backend test suite (30+ tests passing)
backend\.venv\Scripts\python -m pytest backend/tests -v

# Live end-to-end workflow verification
backend\.venv\Scripts\python backend/test_live_workflow.py

# Frontend production build verification
npm --prefix frontend run build
```

---

## 3. MVP Acceptance Criteria Validation Matrix

| Criterion | Requirement | Demonstrated In | Verified Status |
|:---:|:---|:---|:---:|
| **1** | App starts using documented instructions | Step 1 (`uvicorn`, `npm run dev`) | **PASS** |
| **2** | User submits valid Python source | Step 2 (`valid_simple.py`) | **PASS** |
| **3** | Backend validates & stores source safely | Step 2 & Hardening Security tests | **PASS** |
| **4** | Submission metadata persists in DB/disk | Step 3 (`PersistentFileStore` / Mongo) | **PASS** |
| **5** | Static analysis runs without executing code | Step 4 (Sandboxed AST/Bandit/Ruff/Radon) | **PASS** |
| **6** | Findings normalised with tool/location | Step 4 (Unified Finding schema) | **PASS** |
| **7** | User submits & compares a revision | Step 5 & 6 (Unified Diff engine) | **PASS** |
| **8** | Reviewer inspects results & saves note | Step 7 (Faculty Review Hub) | **PASS** |
| **9** | Failed/unavailable checks shown honestly | Step 4 & `test_analyzer_failure_gracefully_handled` | **PASS** |
| **10**| Access checks prevent unauthorized retrieval | Hardening tests (`test_hardening_security.py`) | **PASS** |
| **11**| GitHub issue requires explicit approval | Step 8 (`EXPLICIT_APPROVAL_REQUIRED` gate) | **PASS** |
| **12**| Advisory evaluation is not proof of authorship | Oral viva / advisory disclaimer banners | **PASS** |
| **13**| End-to-end workflow passes in demo env | Automated seed script & live tests | **PASS** |

---

## 4. Honest Fallback Strategy

If any optional external dependency (e.g. live MongoDB server or GitHub API token) is unavailable during a live presentation:
- **Database Fallback:** The backend automatically falls back to `PersistentFileStore` under `storage/data/*.json`. Full submission persistence and audit trails continue uninterrupted.
- **GitHub API Fallback:** If internet access is interrupted or token rate limits apply, the draft review modal accurately surfaces the network failure state without fabricating false success.
- **Analyzer Fallback:** If an analyzer encounters a syntax error or parsing limitation in student code, the remaining analyzers continue execution and report honest diagnostic findings.
