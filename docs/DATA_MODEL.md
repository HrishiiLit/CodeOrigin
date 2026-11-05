# CodeOrigin AI — Data Model & Persistence Specification

> **Version:** 1.1 (Phase 2 — Repository Ingestion)  
> **Status:** Active  
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
    ├── storage/uploads/<uuid4>.py          ← single .py file
    └── storage/uploads/repo_<uuid_hex>/    ← extracted archive or GitHub zipball
        ├── src/
        │   └── main.py
        └── tests/
            └── test_main.py
```

### Storage Safety Rules:
1. **Never store files in the web server public root.** Files are kept inside `storage/uploads/` behind private server-side file access endpoints.
2. **Never name files with user-supplied filenames on disk.** Use a cryptographically generated UUIDv4 opaque key: `<uuid4>.py` for single files, `repo_<uuid_hex>/` for archives.
3. **Verify path containment.** All resolved paths are strictly verified to remain children of `UPLOAD_DIR` to prevent path traversal attacks.
4. **Zip Slip prevention.** Archive extraction validates every member path to ensure it cannot escape the target directory.
5. **Never execute uploaded code.** Uploaded files are strictly treated as untrusted text for static analysis AST parsers and linters.

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
  "original_filename": "my-project.zip",
  "language": "python",
  "submission_type": "archive",
  "storage_key": "repo_f47ac10b58cc4372a5670e02b2c3d479",
  "source_sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  "size_bytes": 20480,
  "total_files": 12,
  "source_files_count": 5,
  "source_files": ["src/main.py", "src/utils.py", "tests/test_main.py"],
  "status": "queued",
  "error_details": null,
  "created_at": "2026-10-30T18:30:00Z",
  "updated_at": "2026-10-30T18:30:00Z"
}
```

**`submission_type` enum:**
- `"file"` — Single `.py` source file. `storage_key` = `<uuid>.py` flat file.
- `"archive"` — Extracted `.zip` or `.tar.gz`. `storage_key` = `repo_<uuid_hex>/` directory.
- `"github"` — GitHub zipball downloaded and extracted. Same storage layout as `"archive"`.

**`storage_key` mapping:**
- For `"file"`: path is `UPLOAD_DIR/<storage_key>` (a file)
- For `"archive"` / `"github"`: path is `UPLOAD_DIR/<storage_key>/` (a directory); file access uses `UPLOAD_DIR/<storage_key>/<relative_path>`

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

---

## 3. Version 2 (V2) Collections — Automated Evaluation & Authenticity Bot

### 3.1 `code_fingerprints` (Token Winnowing Inverted Index)
Stores structural k-gram hashes generated via Karp-Rabin winnowing for rapid $O(1)$ inverted index lookup across an entire university cohort.

```json
{
  "_id": "uuid-v4",
  "submission_id": "uuid-submission",
  "project_id": "uuid-project",
  "file_path": "src/engine.py",
  "hash_value": 3849182910,
  "token_span": [42, 67],
  "created_at": "2026-11-06T00:00:00Z"
}
```

**Indexes:**
- `{"hash_value": 1, "project_id": 1}` (High-speed inverted index lookup)
- `{"submission_id": 1}`

---

### 3.2 `cohort_evaluations` (Division Similarity Matrix)
Stores the batch evaluation matrix, pairwise token containment scores, and collusion clusters across an assignment or university division.

```json
{
  "_id": "uuid-v4",
  "project_id": "uuid-project",
  "total_submissions_compared": 48,
  "status": "completed",
  "collusion_clusters": [
    {
      "cluster_id": "cluster-1",
      "members": ["student-alex", "student-bob"],
      "similarity_score": 0.89,
      "matched_blocks": [
        {
          "submission_a": "sub-1",
          "file_a": "engine.py",
          "lines_a": [42, 115],
          "submission_b": "sub-2",
          "file_b": "core_engine.py",
          "lines_b": [38, 111],
          "tokens_shared": 340
        }
      ]
    }
  ],
  "matrix_summary": [
    {"sub_a": "sub-1", "sub_b": "sub-2", "score": 0.89}
  ],
  "evaluated_at": "2026-11-06T00:05:00Z"
}
```

**Indexes:**
- `{"project_id": 1, "evaluated_at": -1}`

---

### 3.3 `authenticity_audits` (Open-Source Clone & Git Forensics)
Stores Software Heritage hash verification, distinctive GitHub code anchor matches, and Git commit graph timeline metrics.

```json
{
  "_id": "uuid-v4",
  "submission_id": "uuid-submission",
  "authenticity_rating": "SUSPICIOUS",
  "confidence_score": 0.88,
  "software_heritage_matches": [
    {
      "file_path": "core/alloc.py",
      "sha1": "356a192b7913b04c54574d18c28d46e6395428ab",
      "first_seen": "2021-04-12T10:00:00Z",
      "upstream_url": "https://github.com/original-author/distributed-cache"
    }
  ],
  "distinctive_anchors_matched": [
    {
      "anchor_literal": "Invalid dimension stride configuration encountered in buffer allocator",
      "github_repo": "https://github.com/original-author/distributed-cache"
    }
  ],
  "git_forensics": {
    "total_commits": 2,
    "lines_added": 4820,
    "lines_deleted": 12,
    "churn_ratio": 0.002,
    "branch_count": 1,
    "has_feature_branches": false,
    "flags": ["ATOMIC_BULK_DUMP", "ZERO_CHURN"]
  },
  "created_at": "2026-11-06T00:00:00Z"
}
```

**Indexes:**
- `{"submission_id": 1}`
- `{"authenticity_rating": 1}`

---

### 3.4 `ai_evaluations` (Multi-Signal Heuristics & RAG Rubric Grading)
Stores stylometry markers, prompt leak indicators, token perplexity stats, and rubric-based evaluation scores from Hugging Face models.

```json
{
  "_id": "uuid-v4",
  "submission_id": "uuid-submission",
  "ai_risk_score": 0.82,
  "risk_level": "HIGH",
  "signals": {
    "stylometry": {
      "pedantic_comment_density": 0.38,
      "over_engineered_docstring_count": 8
    },
    "prompt_artifacts": {
      "leaked_markdown_tokens": 1
    },
    "perplexity": {
      "average_token_entropy": 2.14,
      "burstiness_score": 0.31
    }
  },
  "rubric_grading": {
    "total_score": 88,
    "max_score": 100,
    "model_used": "bigcode/starcoder2-3b-local-rag",
    "breakdown": [
      {
        "criterion": "Architecture & Modularity",
        "awarded": 23,
        "max": 25,
        "feedback": "Clean separation of concerns."
      }
    ]
  },
  "created_at": "2026-11-06T00:10:00Z"
}
```

**Indexes:**
- `{"submission_id": 1}`
- `{"ai_risk_score": -1}`

---

### 3.5 `viva_questions` (Defend-Your-Code Oral Interrogation Cards)
Stores automatically synthesized oral viva questions targeting high-complexity AST hotspots.

```json
{
  "_id": "uuid-v4",
  "submission_id": "uuid-submission",
  "questions": [
    {
      "question_id": "viva-1",
      "target_file": "core/network.py",
      "line_number": 84,
      "category": "Architectural Rationale",
      "question": "In line 84 you pass socket.SO_REUSEADDR. Why is this flag necessary?",
      "expected_concept": "Prevents Address already in use error caused by TIME_WAIT state.",
      "catch_trigger": "Student claims it makes networking faster."
    }
  ],
  "generated_at": "2026-11-06T00:00:00Z"
}
```

**Indexes:**
- `{"submission_id": 1}`
