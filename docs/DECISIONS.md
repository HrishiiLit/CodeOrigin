# CodeOrigin AI — Architecture & Design Decisions (ADR)

> **Document Type:** Architecture Decision Record (ADR)  
> **Status:** Active Baseline

---

## Decision 001: Identifier Strategy across Monolith
- **Date:** 2026-10-30
- **Context:** MongoDB defaults to 12-byte BSON `ObjectId`, whereas REST APIs and frontend clients benefit from standard RFC 4122 UUIDv4 strings.
- **Decision:** Use UUIDv4 strings stored directly in MongoDB's `_id` field (and all foreign reference fields such as `project_id`, `submission_id`).
- **Rationale:** Ensures uniform serialization across Python/Pydantic, JSON over HTTP, Next.js TypeScript types, and prevents conversion ambiguity between string and BSON ObjectId.
- **Alternatives Considered:** BSON ObjectId (rejected due to tedious custom json encoders in FastAPI and lack of natural compatibility with external client generators).

---

## Decision 002: Storage Layer Architecture
- **Date:** 2026-10-30
- **Context:** Storing large source files or multi-version code trees directly in MongoDB documents bloats BSON document limits (16MB max) and makes indexing less efficient.
- **Decision:** Dual-layer storage:
  1. Private local filesystem directory (`storage/uploads/`) mounted as a volume in Docker.
  2. MongoDB stores structured metadata, checksum (`SHA-256`), opaque storage key, and normalized analysis findings.
- **Rationale:** High efficiency, clear separation between blob storage and metadata, easy migration to S3/Cloud Storage in future phases if needed without changing API contracts.

---

## Decision 003: Monolith vs Microservices
- **Date:** 2026-10-30
- **Context:** Determining system topology for MVP.
- **Decision:** Modular Monolith: one Next.js frontend application and one FastAPI backend service with clean internal module boundaries (`core`, `services`, `repositories`, `analyzers`).
- **Rationale:** Minimizes deployment complexity, eliminates distributed transaction overhead, and avoids premature microservice decomposition.

---

## Decision 004: Upload Safety and Code Execution Policy
- **Date:** 2026-10-30
- **Context:** Handling untrusted code submissions from users.
- **Decision:**
  1. Only `.py` extension is allowed for MVP.
  2. Strict server-side file size limit enforced (default 5 MB).
  3. Safe server-generated filenames (`<uuid4>.py`); original filename preserved only as display metadata.
  4. Path traversal protection: canonical resolved paths strictly verified to reside within `UPLOAD_DIR`.
  5. Uploaded code is strictly treated as untrusted text. It **MUST NEVER** be executed directly by Python `eval`, `exec`, or subprocess runner. All analysis is read-only static analysis (Python AST, Ruff, Radon, Bandit).

---

## Decision 005: Authentication Strategy for MVP
- **Date:** 2026-10-30
- **Context:** Balancing fast initial iteration and user journey verification with robust access control.
- **Decision:** Use header-based identity context (`X-User-ID`, `X-User-Role`) injected via a FastAPI dependency. Default fallbacks are provided for local development. Full OAuth/JWT can be swapped into this dependency layer later with zero change to business services.
