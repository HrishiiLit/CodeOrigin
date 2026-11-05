# CodeOrigin AI - Deployment and Rollback Guide

This document describes production and staging deployment procedures, container configuration, environment specifications, and emergency rollback runbooks for CodeOrigin AI.

---

## 1. System Architecture Overview

```
                      +-----------------------------+
                      |   Browser / User Agent      |
                      +--------------+--------------+
                                     |
                         HTTP (Port 3000 / 8000)
                                     |
              +----------------------+----------------------+
              |                                             |
+-------------v-------------+                 +-------------v-------------+
|    Frontend (Next.js)     |                 |     Backend (FastAPI)     |
|   App Router / Tailwind   |                 |   Analyzers & Services    |
+---------------------------+                 +-------------+-------------+
                                                            |
                                      +---------------------+---------------------+
                                      |                                           |
                        +-------------v-------------+               +-------------v-------------+
                        |  Storage Volume (Disk)    |               |    Persistent Data Store  |
                        |  /storage/uploads         |               |    MongoDB / FileStore    |
                        |  /storage/processed       |               |    /storage/data/*.json   |
                        |  /storage/generated       |               +---------------------------+
                        +---------------------------+
```

---

## 2. Environment Configuration

Copy `.env.example` to `.env` in the project root:

```ini
# Application Mode
DEBUG=False
PROJECT_NAME="CodeOrigin AI"

# Ports & Hosts
BACKEND_HOST=0.0.0.0
BACKEND_PORT=8000
FRONTEND_ORIGIN=http://localhost:3000

# Storage
STORAGE_DIR=storage
MAX_UPLOAD_SIZE_MB=25

# Analysis Timeouts
ANALYSIS_TIMEOUT_SECONDS=30

# MongoDB (Optional - falls back to persistent storage/data/*.json)
MONGODB_URI=mongodb://localhost:27017
MONGODB_DB_NAME=codeorigin_ai

# GitHub Integration (Optional - required for live GitHub issues)
GITHUB_TOKEN=ghp_your_personal_access_token_here
```

---

## 3. Deployment Methods

### Method A: Docker Compose (Standard Production)

1. Build and start containers:
```bash
docker compose up -d --build
```

2. Verify container status:
```bash
docker compose ps
```

3. View live application logs:
```bash
docker compose logs -f backend
```

4. Health check endpoint:
```bash
curl http://localhost:8000/health
```

### Method B: Native Host Process (Development / Staging)

1. **Backend:**
```bash
cd backend
python -m venv .venv
# Windows:
.venv\Scripts\activate
# Linux/macOS:
# source .venv/bin/activate

pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

2. **Frontend:**
```bash
cd frontend
npm install
npm run build
npm run start
```

---

## 4. Health Verification & Smoke Tests

After deployment, verify that all core subsystems report healthy status:

```bash
# 1. API Health Check
curl http://localhost:8000/health
# Expected: {"status":"healthy","database":"connected","storage":"available"}

# 2. Automated Smoke Test
python backend/scripts/seed_demo.py
# Expected: Seeds demo fixtures, runs static analysis, and exits 0

# 3. Unit & Integration Test Suite
cd backend && .venv/bin/pytest tests/
```

---

## 5. Rollback Runbook

### Scenario 1: Unhealthy Service Version / Broken Deployment

1. **Revert Git to previous release tag or stable commit:**
```bash
git checkout <PREVIOUS_RELEASE_TAG_OR_COMMIT>
```

2. **Rebuild Docker containers with cached data preserved:**
```bash
docker compose down
docker compose up -d --build
```

3. **Verify health check:**
```bash
curl -f http://localhost:8000/health || echo "Deployment still unhealthy!"
```

### Scenario 2: Storage or Data Store Recovery

All submission records and audit trails are backed up automatically in `storage/data/`:
- `storage/data/submissions.json`
- `storage/data/analysis_runs.json`
- `storage/data/comparisons.json`
- `storage/data/reviews.json`
- `storage/data/audit_events.json`

To restore or backup state:
```bash
# Backup current state:
cp -r storage/data storage/data_backup_$(date +%Y%m%d_%H%M%S)

# Restore from backup:
cp -r storage/data_backup_<TIMESTAMP>/* storage/data/
```

### Scenario 3: Corrupted Upload / Disk Cleanup

If an invalid or untracked file is placed in storage:
```bash
# Backend automatically reconciles untracked uploads upon reboot.
# To safely clean generated artifacts without affecting submissions:
rm -rf storage/generated/*
```
