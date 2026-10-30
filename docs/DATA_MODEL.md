# CodeOrigin AI — Data Model & Persistence Specification

> **Version:** 1.0 (Phase 0 Design Freeze)  
> **Status:** Approved Baseline  
> **Primary Storage:** MongoDB (`codeorigin_ai`)  
> **Blob Storage:** Private filesystem (`storage/uploads/`)

---

## 1. Storage Architecture

```
CodeOrigin Storage
├── MongoDB (Metadata, Findings, Audit Events)
│   ├── projects
│   ├── submissions
│   ├── analysis_runs
│   ├── comparisons
│   ├── reviews
│   └── audit_events
└── Filesystem Blob Storage (Private / Non-executable)
    └── storage/uploads/{opaque_storage_key}.py
```

### Storage Safety Rules:
1. **Never store files in the web server public root.** Files are kept inside `storage/uploads/` behind private server-side file access endpoints.
2. **Never name files with user-supplied filenames on disk.** Use a cryptographically generated UUIDv4 opaque key: `<uuid4>.py`.
3. **Verify path containment.** All resolved paths are strictly verified to remain children of `UPLOAD_DIR` to prevent path traversal attacks.
4. **Never execute uploaded code.** Uploaded files are strictly treated as untrusted text for static analysis AST parsers and linters.

---

## 2. Collections and Document Schemas

### 2.1 `projects`
Groups submissions across revisions for a given assignment or student project.

```json
{
  "_id": "uuid-string-v4",
  "title": "Data Structures Assignment 1",
  "description": "Binary search tree implementation",
  "owner_id": "demo-user",
  "created_at": "2026-10-30T18:00:00Z",
  "updated_at": "2026-10-30T18:00:00Z"
}
```

**Indexes:**
- `{"_id": 1}` (Primary key)
- `{"owner_id": 1}`
- `{"created_at": -1}`

---

### 2.2 `submissions`
Core record representing an uploaded code revision.

```json
{
  "_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "project_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "owner_id": "demo-user",
  "parent_submission_id": null,
  "original_filename": "solution.py",
  "language": "python",
  "storage_key": "f47ac10b-58cc-4372-a567-0e02b2c3d479.py",
  "source_sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  "size_bytes": 1024,
  "status": "queued",
  "error_details": null,
  "created_at": "2026-10-30T18:30:00Z",
  "updated_at": "2026-10-30T18:30:00Z"
}
```

**Submission Status Machine:**
- `queued`: File safely saved, queued for analysis.
- `processing`: Analysis pipeline currently running.
- `completed`: Analysis finished; findings persisted.
- `failed`: Analysis or storage step encountered a fatal error.

**Indexes:**
- `{"_id": 1}` (Primary)
- `{"project_id": 1, "created_at": -1}`
- `{"owner_id": 1, "created_at": -1}`
- `{"parent_submission_id": 1}`
- `{"source_sha256": 1}`

---

### 2.3 `analysis_runs` (Phase 3)
Static analysis results and normalised tool findings.

```json
{
  "_id": "uuid-string-v4",
  "submission_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "status": "completed",
  "tool_versions": {
    "ast": "3.12.7",
    "ruff": "0.4.0",
    "radon": "6.0.1",
    "bandit": "1.7.8"
  },
  "summary": {
    "finding_count": 2,
    "error_count": 0,
    "warning_count": 1,
    "info_count": 1
  },
  "findings": [
    {
      "finding_id": "uuid-string-v4",
      "tool": "ruff",
      "rule_id": "F401",
      "category": "maintainability",
      "severity": "warning",
      "message": "'os' imported but unused",
      "file": "solution.py",
      "line": 3,
      "column": 1,
      "end_line": 3,
      "end_column": 10,
      "suggestion": "Remove unused import: `import os`"
    }
  ],
  "duration_ms": 320,
  "created_at": "2026-10-30T18:30:05Z"
}
```

**Indexes:**
- `{"_id": 1}`
- `{"submission_id": 1}`
- `{"status": 1}`

---

### 2.4 `comparisons` (Phase 4)
Tracks line diffs and evolution metrics between revisions.

```json
{
  "_id": "uuid-string-v4",
  "base_submission_id": "uuid-base",
  "target_submission_id": "uuid-target",
  "summary": {
    "added_lines": 14,
    "removed_lines": 3,
    "changed_files": 1
  },
  "diff": "--- v1.py\n+++ v2.py\n@@ ... @@",
  "created_at": "2026-10-30T18:35:00Z"
}
```

**Indexes:**
- `{"_id": 1}`
- `{"base_submission_id": 1, "target_submission_id": 1}`

---

### 2.5 `reviews` (Phase 5)
Faculty feedback notes linked to a submission.

```json
{
  "_id": "uuid-string-v4",
  "submission_id": "uuid-submission",
  "author_id": "faculty-prof-jones",
  "notes": "Good separation of concerns; consider addressing the unused imports.",
  "created_at": "2026-10-30T18:40:00Z"
}
```

---

### 2.6 `audit_events`
Tracks critical security actions and integrations.

```json
{
  "_id": "uuid-string-v4",
  "action": "GITHUB_ISSUE_CREATED",
  "actor_id": "faculty-prof-jones",
  "details": {
    "submission_id": "uuid-submission",
    "issue_url": "https://github.com/..."
  },
  "created_at": "2026-10-30T18:45:00Z"
}
```
