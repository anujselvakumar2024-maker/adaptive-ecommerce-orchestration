# Adaptive Multi-Agent Orchestration for Stockout Recovery and Relevance–Diversity-Aware Product Discovery in E-Commerce

An end-to-end research platform and experimental evaluation system that integrates intelligent multi-agent stockout recovery, structured constraint satisfaction, and intent-adaptive Maximal Marginal Relevance (MMR) diversity reranking for e-commerce search.

---

## 1. Project Overview

Modern e-commerce search systems face two frequent failure modes:
1. **Stockout Bounce Risk**: When high-intent users query a specific product that is out-of-stock internally, traditional lexical or dense retrieval pipelines silently fail or return unrelated substitutes, causing high churn.
2. **Relevance vs. Diversity Trade-off**: Standard lexical matching often returns homogeneous lists dominated by a single vendor or accessory rather than a balanced assortment across brands, form factors, and specifications.

This project implements and empirically validates three search pipelines:
- **Mode 1: Baseline TF-IDF** — Pure lexical BM25/TF-IDF similarity ranking across catalog product titles and descriptions.
- **Mode 2: Optimized Intent MMR** — Structured query attribute parsing (RAM, storage, budget, screen size, color) combined with intent-adaptive MMR diversity reranking to preserve brand assortment.
- **Mode 3: Adaptive Multi-Agent Orchestration** — An adaptive agentic pipeline that inspects top candidates for stockouts. When an unavailable item is detected, the agent autonomously queries external partner fulfillment inventories (e.g. *Partner Electronics Hub*) or selects specification-preserving substitutes with minimal latency overhead (~16ms).

The platform includes:
- A modern e-commerce discovery website with live search across 1,145 catalog products in 4 categories (`laptop`, `phone`, `watch`, `refrigerator`).
- A controlled, double-blind human-evaluation workflow adhering to strict research integrity (zero target leakage into retrieval, randomized column blinding).
- SQLite-backed persistence for 5-point Likert questionnaire responses with duplicate-submission protection.
- A live researcher dashboard with interactive decision-trace inspection and one-click research CSV export.

---

## 2. Unified Folder Structure

```text
adaptive-ecommerce-orchestration/
│
├── README.md                      # Comprehensive project guide & documentation
├── .gitignore                     # Git ignore rules for Python & Node artifacts
├── .env.example                   # Environment configuration template
│
├── backend/                       # Python FastAPI Backend & Algorithmic Engine
│   ├── api.py                     # FastAPI application endpoints (health, scenarios, search, evaluate, experiments)
│   ├── search_engine.py           # Core retrieval engine (TF-IDF, MMR reranker, stockout orchestrator)
│   ├── evaluator.py               # Evaluation logic (Hit@5, MRR, constraint match %)
│   ├── experiment_store.py        # SQLite persistence layer for sessions, tasks, and Likert submissions
│   ├── requirements.txt           # Python dependency specifications
│   │
│   ├── data/                      # Canonical catalog, scenarios, and database
│   │   ├── products.csv           # 1,145 catalog products across 4 categories
│   │   ├── query_products.csv     # 173 ground-truth Amazon ESCI queries and relevance labels
│   │   ├── scenarios.json         # Controlled evaluation scenarios (Specific & General tasks)
│   │   ├── experiments.db         # Canonical SQLite database storing participant responses
│   │   └── benchmark_*.csv        # Empirical benchmark outcome tables
│   │
│   ├── benchmarks/                # Automated evaluation and plotting scripts
│   │   ├── benchmark.py           # Evaluates 173 ESCI queries across baseline, optimized, and orchestrated
│   │   ├── benchmark_stockouts.py # Evaluates 9 controlled exact-product stockout cases
│   │   ├── benchmark_substitutes.py # Pilot substitute retrieval evaluation
│   │   └── generate_plots.py      # Generates publication-ready figures
│   │
│   ├── results/                   # Research figures & visual plots
│   │   ├── latency_comparison.png
│   │   ├── search_quality_diversity.png
│   │   └── stockout_recovery.png
│   │
│   ├── tests/                     # Backend verification scripts
│   │   ├── test_search.py         # Specific product retrieval test
│   │   ├── test_general.py        # General multi-constraint test
│   │   └── test_demo.py           # Interactive stockout recovery demonstration
│   │
│   └── scripts/                   # Data extraction and scenario generation utilities
│       ├── prepare_data.py
│       ├── generate_scenarios.py
│       └── find_recovery_case.py
│
├── frontend/                      # React / Vite / Tailwind CSS Website
│   ├── package.json               # Frontend dependencies & build scripts
│   ├── package-lock.json          # Dependency lockfile
│   ├── vite.config.js             # Vite development server configuration
│   ├── tailwind.config.js         # Tailwind styling design tokens
│   ├── postcss.config.js          # PostCSS configuration
│   ├── index.html                 # Single page application entry point
│   ├── .env.example               # Frontend environment template
│   │
│   ├── public/                    # Static web assets
│   │   └── results/               # Mirrored benchmark plots displayed in UI
│   │
│   ├── src/
│   │   ├── app/                   # App root component and declarative routing
│   │   ├── components/            # Reusable UI components (CategoryIcon, AppShell, Header)
│   │   ├── data/                  # Standardized categories taxonomy and benchmark figures
│   │   ├── hooks/                 # useExperimentSession custom hook for double-blind study
│   │   ├── pages/                 # Full web pages (Welcome, Discover, Experiment, Benchmarks, Researcher)
│   │   ├── services/              # api.js client (zero target leakage, SQLite export)
│   │   ├── styles/                # Tailwind global stylesheet
│   │   └── main.jsx               # React DOM entry point
│   │
│   └── tests/                     # Frontend integration & experiment integrity test suite
│       └── searchlab.test.js      # 12 Node.js native tests (leakage, blinding, Likert validation)
│
├── scripts/                       # Unified startup commands
│   ├── start-backend.bat          # Starts FastAPI server on port 8000 (Windows)
│   ├── start-frontend.bat         # Starts Vite dev server on port 5173 (Windows)
│   ├── start-all.bat              # Launches both services in separate windows (Windows)
│   ├── start-all.ps1              # PowerShell multi-process launcher
│   └── start-all.sh               # Bash startup script (Linux/macOS)
│
└── docs/                          # Academic documentation
    └── report/                  # Project report documentation, figures, and screenshots
```

---

## 3. System Requirements

- **Operating System**: Windows 10/11, macOS, or Linux (Ubuntu 20.04+).
- **Python**: `3.10` or higher (`3.12` tested and confirmed).
- **Node.js**: `v18.0.0` or higher (`v24.20.0` tested and confirmed) with `npm` `9.0+`.

---

## 4. Environment Configuration

Copy `.env.example` in the root folder or set environment variables:

```bash
# Optional: customize port bindings
BACKEND_HOST=0.0.0.0
BACKEND_PORT=8000
VITE_API_BASE_URL=http://localhost:8000
```

By default, the frontend automatically connects to `http://localhost:8000`.

---

## 5. Installation

### A. Backend Python Dependencies
From the project root:

```powershell
cd backend
python -m pip install -r requirements.txt
cd ..
```

Dependencies installed: `fastapi`, `uvicorn`, `pandas`, `numpy`, `scikit-learn`, `pydantic`, `matplotlib`.

### B. Frontend Node Dependencies
From the project root:

```powershell
cd frontend
npm.cmd install
cd ..
```

Dependencies installed: `react`, `react-dom`, `react-router-dom`, `lucide-react`, `tailwindcss`, `vite`.

---

## 6. Starting the Application

### Option 1: One-Click Startup (Recommended for Windows)
Double-click `scripts/start-all.bat` or run from PowerShell:

```powershell
.\scripts\start-all.bat
```

Or via PowerShell script:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\start-all.ps1
```

This launches the backend on port `8000` and the frontend on port `5173` in separate windows.

### Option 2: Start Services Individually

**Terminal 1 — Backend:**
```powershell
cd backend
python -m uvicorn api:app --host 0.0.0.0 --port 8000 --reload
```

**Terminal 2 — Frontend:**
```powershell
cd frontend
npm.cmd run dev -- --host 0.0.0.0 --port 5173
```

---

## 7. Web Application & API Access URLs

Once launched, access the platform at:

| Service / Interface | Local URL | Description |
| :--- | :--- | :--- |
| **SearchLab Web Application** | [http://localhost:5173/](http://localhost:5173/) | Product discovery, scenario testing & human evaluation |
| **Product Discovery Page** | [http://localhost:5173/discover](http://localhost:5173/discover) | Live exploratory search with category and pipeline filters |
| **Human Evaluation Workflow** | [http://localhost:5173/experiment](http://localhost:5173/experiment) | Double-blind 4-stage participant evaluation study |
| **Empirical Benchmarks** | [http://localhost:5173/benchmarks](http://localhost:5173/benchmarks) | Interactive visualization of 173 ESCI queries & stockouts |
| **Researcher Diagnostic Dashboard** | [http://localhost:5173/researcher](http://localhost:5173/researcher) | Live decision-trace inspector & CSV dataset export |
| **FastAPI Swagger Documentation** | [http://localhost:8000/docs](http://localhost:8000/docs) | Interactive OpenAPI testing interface |
| **Backend Health Endpoint** | [http://localhost:8000/health](http://localhost:8000/health) | JSON status and catalog count check |

---

## 8. Running Tests and Benchmarks

### A. Run Frontend Test Suite
From `frontend/`:

```powershell
cd frontend
node --test tests/searchlab.test.js
```

All 12 automated test suites verify:
- Catalog SKU integrity and category isolation across all 4 domains.
- Structured constraint parsing and contradiction detection.
- **Zero ground-truth target leakage**: verifying that target product IDs are never passed into retrieval.
- Fixed per-session column blinding with preserved condition mappings.
- Session persistence and duplicate-submission protection.

### B. Run Backend Diagnostic Tests
From `backend/`:

```powershell
cd backend
python tests/test_search.py
python tests/test_general.py
python tests/test_demo.py
```

### C. Run Full Empirical Benchmark Evaluation
To recompute the 173-query ESCI benchmark, 9-case stockout study, and plot generation:

```powershell
cd backend
python benchmarks/benchmark.py
python benchmarks/benchmark_stockouts.py
python benchmarks/generate_plots.py
```

---

## 9. Experiment Database & Research Data Export

All participant sessions and questionnaire evaluations are stored locally in the canonical SQLite database:

```text
backend/data/experiments.db
```

The database schema includes:
- `experiment_sessions`: Tracks anonymous session IDs (`SL-2026-XXXX`), informed consent timestamps, and completion statuses.
- `experiment_tasks`: Records individual query trials, hidden evaluation targets, and retrieved result rankings.
- `experiment_submissions`: Persists validated 9-dimension Likert scores (5-point Likert scale), per-system ratings, system preference, and comments.

### One-Click CSV Export
Researchers can download the complete research-ready dataset at any time via:
- The UI button at `http://localhost:5173/researcher` ("Export CSV Dataset").
- Direct API endpoint: `GET http://localhost:8000/experiments/export.csv`.

---

## 10. Research Integrity Guarantees

1. **Zero Target Leakage**: The target product ID or target constraints are privately held in frontend state during query formulation and are **never** passed into `POST /search`. Evaluation occurs via `POST /evaluate` strictly after retrieval completes.
2. **Double-Blind Column Assignment**: Conditions are randomized across columns (`System A`, `System B`, `System C`) so participants cannot identify which search algorithm is running.
3. **Trace Protection**: Internal agent reasoning (`decision_trace`) and stockout badges (`source: partner`) are hidden from participant views and exposed only in the researcher dashboard.
4. **Duplicate Prevention**: SQLite primary key constraints on `session_id` block repeated questionnaire submissions with HTTP 409 Conflict.
