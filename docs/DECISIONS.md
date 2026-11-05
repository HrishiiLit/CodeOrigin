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

---

## Decision 006: Asynchronous Cohort Plagiarism Engine via Token Winnowing & Inverted Index
- **Date:** 2026-11-06
- **Context:** Students submit projects over days or weeks. Pairwise plagiarism checking upon every single upload creates $O(N^2)$ write amplification and leaks comparison data before all students submit.
- **Decision:** Dual-phase architecture:
  1. **Upload Time:** Normalize AST tokens (variable & function name stripping) and generate Karp-Rabin winnowing fingerprint hashes stored in `code_fingerprints`.
  2. **Faculty Trigger Time:** An asynchronous batch evaluation endpoint (`POST /api/v1/projects/{id}/cohort-evaluate`) executes pairwise containment comparisons across all submissions in that division/cohort, persisting cluster results to `cohort_evaluations`.
- **Rationale:** Prevents race conditions, protects academic integrity until submission deadlines close, and utilizes MongoDB inverted indexes to keep pairwise comparisons under 2 seconds for a division of 100 students.

---

## Decision 007: Open-Source Repository Theft Detection via Dual Cryptographic Hash (SWH) & Distinctive Anchor Probing
- **Date:** 2026-11-06
- **Context:** Evaluating whole multi-file student repositories against billions of public GitHub repositories is too slow for exhaustive text diffing.
- **Decision:** Combine two sub-second lookup strategies:
  1. **Software Heritage API (SWH):** Hash each file with SHA-1/SHA-256 and query the public SWH archive index in parallel.
  2. **Distinctive Anchor Probing:** Extract high-entropy string literals/custom exception messages from the AST and query GitHub Code Search API with rate-limiting.
- **Rationale:** Yields mathematical proof of open-source repository cloning in < 3 seconds without hosting or indexing a massive web-scale repository database locally.

---

## Decision 008: Multi-Signal AI Code Detection & "Defend Your Code" Oral Defense Strategy
- **Date:** 2026-11-06
- **Context:** Black-box LLM code detectors suffer from false-positive rates on beginners writing boilerplate code. Automated academic misconduct penalties based on AI scores violate institutional guidelines.
- **Decision:** 
  1. Combine 4 advisory heuristic signals (stylometry, pedantic comments, leaked chat artifacts, token perplexity/burstiness, revision velocity) into an advisory risk index.
  2. Synthesize 3 targeted "Defend Your Code" oral viva questions targeting the highest-complexity AST hotspots (Radon CC $\ge 10$) with expected concepts and catch triggers.
- **Rationale:** Shifts evaluation from unreliable automated accusations to a verifiable 60-second oral viva where genuine authorship can be confirmed by human faculty.

---

## Decision 009: On-Premise Hugging Face Open-Weight Models & RAG Architecture for Semantic Rubric Grading
- **Date:** 2026-11-06
- **Context:** Evaluating adherence to specific assignment rubrics, syllabus guidelines, and course architecture standards requires semantic reasoning without leaking student code to external third-party proprietary APIs.
- **Decision:** Deploy an on-premise open-weight model (e.g. `bigcode/starcoder2` or `CodeLlama`) grounded with a local Vector Database (ChromaDB) indexing course assignment rubrics and constraint documents via Retrieval-Augmented Generation (RAG).
- **Rationale:** Ensures student privacy compliance (FERPA/GDPR), zero per-token cloud costs, and repeatable rubric-bounded grading without prompt drift.

---

## Decision 010: Zero-Runtime Execution & Path Traversal Boundary Hardening (MVP Exit Gate)
- **Date:** 2026-11-06
- **Context:** Student submissions can include malicious exploits, zip slip path traversals, or attempted arbitrary code execution (`os.system`, `subprocess`, malicious imports).
- **Decision:**
  1. Submitted code is never executed via python runtime or importlib; analyzers run strictly via static AST token parsing or sandboxed subprocesses with rigid 30s timeouts.
  2. Storage keys and archive members undergo strict boundary checks (`is_relative_to`, stripping leading slashes, blocking `..`, `:`, and tar symlinks) rejecting any attempt to write outside the isolated storage directory.
  3. Corrupted or invalid archives are rejected with HTTP 400 (`MALFORMED_ARCHIVE`) rather than internal 500 server errors.
- **Rationale:** Guarantees absolute host safety and fulfills Phase 8 security exit gate criteria for multi-tenant educational environments.

