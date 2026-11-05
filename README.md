# CodeOrigin AI

CodeOrigin AI is an educational code-review and code-evolution platform. It accepts Python code submissions, runs bounded static analysis, compares revisions, and presents structured findings for students and faculty reviewers.

---

## 1. Architecture Overview

- **Frontend:** Next.js (TypeScript, App Router, Tailwind CSS)
- **Backend:** FastAPI (Python 3.12+, Pydantic v2, PyMongo)
- **Database:** MongoDB
- **File Storage:** Private mounted local directory (`storage/uploads/`)
- **Containerization:** Docker & Docker Compose

---

## 2. Prerequisites

- Python 3.11+ (Python 3.12 recommended)
- Node.js LTS (v20+ or v25) & npm
- Docker & Docker Compose (optional for containerized runtime)
- MongoDB instance (via Docker or local service)

---

## 3. Quick Start (Local Development)

### 3.1 Setup Backend
```bash
cd backend
python -m venv .venv
# On Windows PowerShell:
.\.venv\Scripts\Activate.ps1
# On Linux/macOS:
source .venv/bin/activate

pip install -r requirements.txt
cp ../.env.example .env
uvicorn app.main:app --reload --port 8000
```
Backend API will be accessible at: `http://localhost:8000`  
Interactive OpenAPI documentation: `http://localhost:8000/docs`  
Health check endpoint: `http://localhost:8000/health`

### 3.2 Setup Frontend
```bash
cd frontend
npm install
npm run dev
```
Frontend web application will run at: `http://localhost:3000`

---

## 4. Running with Docker Compose

To start MongoDB, the FastAPI backend, and the Next.js frontend together:

```bash
docker compose up --build
```

Services:
- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:8000`
- MongoDB: `mongodb://localhost:27017`

---

## 5. Live Demonstration & Demo Seeder

To instantly populate the system with standardized student submissions, multi-tool static analysis, revision comparisons, and faculty review notes:

```bash
# Automated one-click demo data seeder
python backend/scripts/seed_demo.py
```

For the comprehensive 10-step evaluator walkthrough and narrative talking points, see the **[Demonstration Runbook](docs/DEMO_RUNBOOK.md)**.

---

## 6. Testing & Quality Verification

```bash
# Run comprehensive backend test suite (unit, integration & security hardening)
backend/.venv/Scripts/python -m pytest backend/tests -v

# Run end-to-end live workflow verification
backend/.venv/Scripts/python backend/test_live_workflow.py

# Verify frontend production build
npm --prefix frontend run build
```

---

## 7. Documentation
- [Implementation Plan](docs/CodeOrigin_AI_Implementation_Plan.md)
- [Demonstration Runbook](docs/DEMO_RUNBOOK.md)
- [Deployment & Rollback Guide](docs/DEPLOYMENT_AND_ROLLBACK.md)
- [Integration Log](docs/INTEGRATION_LOG.md)
- [API Contract](docs/API_CONTRACT.md)
- [Data Model & Persistence](docs/DATA_MODEL.md)
- [Architecture Decision Records](docs/DECISIONS.md)
