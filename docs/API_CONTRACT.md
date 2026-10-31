# CodeOrigin AI — API Contract

> **Version:** 1.1 (Phase 2 — Repository Ingestion)  
> **Status:** Active  
> **Base Path:** `/api/v1` (except `/health`)

---

## 1. Global Conventions

### 1.1 Content Types & Encoding
- All JSON requests and responses **MUST** use `application/json; charset=utf-8`.
- File upload requests **MUST** use `multipart/form-data`.
- Source code downloads use `text/plain; charset=utf-8`.

### 1.2 Identifiers & Timestamps
- All entity identifiers (`submission_id`, `project_id`, `analysis_id`, `comparison_id`, `review_id`, `finding_id`, `request_id`) **MUST** be RFC 4122 compliant UUIDv4 strings.
- All timestamps **MUST** be ISO 8601 strings in UTC formatted as `YYYY-MM-DDTHH:MM:SSZ` or with timezone offset.

### 1.3 Authentication & Authorization (MVP)
- For the MVP baseline, requests pass identity via headers:
  - `X-User-ID`: e.g. `demo-student-1` (default fallback: `demo-user`)
  - `X-User-Role`: `student` | `faculty` | `admin` (default fallback: `student`)
- Full JWT authentication will plug into this dependency layer in future phases without breaking route contracts.

### 1.4 Standard Error Response Envelope
Every 4xx/5xx error returned by the API **MUST** conform to the following JSON structure:

```json
{
  "error": {
    "code": "INVALID_FILE_TYPE",
    "message": "Only Python source files (.py) are supported.",
    "details": null,
    "request_id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d"
  }
}
```

Standard Error Codes:
- `VALIDATION_ERROR`: Input payload or parameters failed schema validation.
- `INVALID_FILE_TYPE`: Uploaded file does not have an allowed extension (`.py`, `.zip`, `.tar.gz`).
- `FILE_TOO_LARGE`: Uploaded file exceeds the configured maximum size (e.g. 50 MB).
- `EMPTY_FILE`: Uploaded file has a content length of 0 bytes.
- `INVALID_ENCODING`: Uploaded file cannot be decoded as valid text (UTF-8).
- `RESOURCE_NOT_FOUND`: The requested entity does not exist.
- `GITHUB_FETCH_ERROR`: GitHub repository could not be fetched (bad URL, auth failure, network error).
- `UNAUTHORIZED` / `FORBIDDEN`: Access is denied for the given identity/role.
- `PERSISTENCE_ERROR`: Database or storage operation failed.
- `INTERNAL_SERVER_ERROR`: An unexpected internal server error occurred.

---

## 2. Endpoints Specification

### 2.1 System Health

#### `GET /health`
Returns the operational health of the FastAPI service and its connected dependencies (MongoDB).

- **Request Headers:** None
- **Response 200 OK:**
```json
{
  "status": "healthy",
  "version": "0.1.0",
  "timestamp": "2026-10-30T18:30:00Z",
  "services": {
    "api": "up",
    "database": "up"
  }
}
```
- **Response 503 Service Unavailable** (if MongoDB is disconnected/unreachable):
```json
{
  "status": "degraded",
  "version": "0.1.0",
  "timestamp": "2026-10-30T18:30:00Z",
  "services": {
    "api": "up",
    "database": "down"
  }
}
```

---

### 2.2 Submissions API (`/api/v1/submissions`)

#### `POST /api/v1/submissions`
Upload and register a new code submission — a single `.py` file, a `.zip`/`.tar.gz` archive, or a GitHub repository URL.

- **Content-Type:** `multipart/form-data`
- **Form Fields:**
  - `file` (File, **Required** for file/archive upload): The source file (`.py`, `.zip`, `.tar.gz`, `.tgz`, `.tar`). Max 50 MB.
  - `project_id` (String UUID, *Optional*): Target project ID. If omitted, the server creates a new default project.
  - `parent_submission_id` (String UUID, *Optional*): ID of the previous submission if this is a revision.
  - `display_name` (String, *Optional*): User-friendly project or revision title.
- **Request Headers:**
  - `X-User-ID`: (Optional) User identifier.
  - `X-User-Role`: (Optional) User role.
- **Response 201 Created:**
```json
{
  "submission_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "project_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "owner_id": "demo-user",
  "parent_submission_id": null,
  "original_filename": "my-project.zip",
  "language": "python",
  "submission_type": "archive",
  "source_sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  "size_bytes": 20480,
  "total_files": 12,
  "source_files_count": 5,
  "source_files": ["src/main.py", "src/utils.py", "tests/test_main.py"],
  "status": "queued",
  "created_at": "2026-10-30T18:30:00Z",
  "updated_at": "2026-10-30T18:30:00Z"
}
```
- **`submission_type` values:** `"file"` (single .py), `"archive"` (zip/tar), `"github"` (GitHub ingestion)
- **Error Responses:**
  - `400 Bad Request`: `INVALID_FILE_TYPE`, `EMPTY_FILE`, `INVALID_ENCODING`
  - `413 Payload Too Large`: `FILE_TOO_LARGE`
  - `404 Not Found`: `RESOURCE_NOT_FOUND` (if invalid `parent_submission_id`)
  - `500 Internal Server Error`: `PERSISTENCE_ERROR`

---

#### `POST /api/v1/submissions/github`
Ingest a GitHub repository directly from its URL without requiring a local file upload.

- **Content-Type:** `application/json`
- **Request Body:**
```json
{
  "repo_url": "https://github.com/owner/repo",
  "ref": "main",
  "project_id": null,
  "display_name": "My GitHub Repo"
}
```
  - `repo_url` (String, **Required**): Full GitHub repository URL. Supports branch and commit variants (e.g., `/tree/branch`, `/commit/sha`).
  - `ref` (String, *Optional*): Branch name, tag, or full commit SHA. Defaults to the repository's default branch.
  - `project_id` (String UUID, *Optional*): Target project. A new project is created if omitted.
  - `display_name` (String, *Optional*): Friendly label for the ingested repo.
- **Request Headers:**
  - `X-User-ID`: (Optional) User identifier.
- **Response 201 Created:** Same `SubmissionResponse` shape as `POST /api/v1/submissions` with `submission_type: "github"`.
- **Error Responses:**
  - `400 Bad Request`: `VALIDATION_ERROR` (malformed URL)
  - `502 Bad Gateway`: `GITHUB_FETCH_ERROR` (GitHub API unreachable, rate-limited, or repo not found)
  - `500 Internal Server Error`: `PERSISTENCE_ERROR`

---

#### `GET /api/v1/submissions`
List accessible submissions, ordered by creation date descending.

- **Query Parameters:**
  - `project_id` (String UUID, *Optional*): Filter by project.
  - `status` (String, *Optional*): Filter by status (`queued`, `processing`, `completed`, `failed`).
  - `limit` (Integer, *Optional*, Default: `50`, Max: `100`): Maximum records to return.
  - `offset` (Integer, *Optional*, Default: `0`): Pagination offset.
- **Response 200 OK:**
```json
{
  "total": 1,
  "items": [
    {
      "submission_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
      "project_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "owner_id": "demo-user",
      "parent_submission_id": null,
      "original_filename": "solution.py",
      "language": "python",
      "source_sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      "size_bytes": 1024,
      "status": "queued",
      "created_at": "2026-10-30T18:30:00Z",
      "updated_at": "2026-10-30T18:30:00Z"
    }
  ]
}
```

---

#### `GET /api/v1/submissions/{id}`
Retrieve complete metadata and status for a single submission.

- **Path Parameters:**
  - `id` (String UUID, **Required**): The submission ID.
- **Response 200 OK:** Returns single submission object (same as item above).
- **Error Responses:**
  - `404 Not Found`: `RESOURCE_NOT_FOUND`

---

#### `GET /api/v1/submissions/{id}/source`
Retrieve the original source code text of the submission for safe preview in the frontend.

- **Path Parameters:**
  - `id` (String UUID, **Required**): The submission ID.
- **Query Parameters:**
  - `path` (String, *Optional*): Relative file path within a repository submission (e.g., `src/main.py`). Required for `archive` and `github` submission types.
- **Response 200 OK:**
  - `Content-Type: text/plain; charset=utf-8`
  - Body: Plain text Python source code.
- **Error Responses:**
  - `404 Not Found`: `RESOURCE_NOT_FOUND`

---

#### `GET /api/v1/submissions/{id}/tree`
Return the repository file tree for an archive or GitHub submission.

- **Path Parameters:**
  - `id` (String UUID, **Required**): The submission ID.
- **Response 200 OK:**
```json
{
  "submission_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "total_files": 12,
  "source_files_count": 5,
  "tree": [
    {
      "name": "src",
      "path": "src",
      "type": "directory",
      "children": [
        {
          "name": "main.py",
          "path": "src/main.py",
          "type": "file",
          "size_bytes": 1234,
          "children": []
        }
      ]
    }
  ]
}
```
- **Error Responses:**
  - `404 Not Found`: `RESOURCE_NOT_FOUND`

---

### 2.3 Future Endpoints Reserved for Phases 3–7

| Method | Endpoint | Phase | Purpose |
|---|---|---|---|
| `POST` | `/api/v1/submissions/{id}/analyze` | 3 | Trigger or re-run static analysis pipeline |
| `GET` | `/api/v1/submissions/{id}/analysis` | 3 | Retrieve normalised static analysis findings |
| `POST` | `/api/v1/comparisons` | 4 | Generate revision diff between base and target |
| `GET` | `/api/v1/comparisons/{id}` | 4 | Retrieve revision comparison details & diff |
| `POST` | `/api/v1/reviews` | 5 | Save reviewer feedback note |
| `GET` | `/api/v1/submissions/{id}/reviews` | 5 | List reviewer feedback notes for submission |
| `POST` | `/api/v1/integrations/github/issues/draft` | 7 | Prepare GitHub issue draft |
| `POST` | `/api/v1/integrations/github/issues` | 7 | Submit GitHub issue upon explicit faculty approval |
