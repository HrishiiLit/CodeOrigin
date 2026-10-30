# CodeOrigin AI — API Contract

> **Version:** 1.0 (Phase 0 Design Freeze)  
> **Status:** Approved Baseline  
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
- `INVALID_FILE_TYPE`: Uploaded file does not have an allowed extension (`.py`).
- `FILE_TOO_LARGE`: Uploaded file exceeds the configured maximum size (e.g. 5 MB).
- `EMPTY_FILE`: Uploaded file has a content length of 0 bytes.
- `INVALID_ENCODING`: Uploaded file cannot be decoded as valid text (UTF-8).
- `RESOURCE_NOT_FOUND`: The requested entity does not exist.
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
Upload and register a new Python code submission.

- **Content-Type:** `multipart/form-data`
- **Form Fields:**
  - `file` (File, **Required**): The `.py` source file (max 5 MB).
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
  "original_filename": "solution.py",
  "language": "python",
  "source_sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  "size_bytes": 1024,
  "status": "queued",
  "created_at": "2026-10-30T18:30:00Z",
  "updated_at": "2026-10-30T18:30:00Z"
}
```
- **Error Responses:**
  - `400 Bad Request`: `INVALID_FILE_TYPE`, `EMPTY_FILE`, `INVALID_ENCODING`
  - `413 Payload Too Large`: `FILE_TOO_LARGE`
  - `404 Not Found`: `RESOURCE_NOT_FOUND` (if invalid `parent_submission_id`)
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
- **Response 200 OK:**
  - `Content-Type: text/plain; charset=utf-8`
  - Body: Plain text Python source code.
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
