# Scholar Agent

Conversational dashboard for Brauer-configuration analysis of citation
networks. Built on top of [`aiq-quivers`](https://pypi.org/project/aiq-quivers/)
and a Claude tool-calling agent. Includes a Colombian Scienti
(Minciencias) sample so the Scienti views work out of the box; see
[scienti_sample/](scienti_sample/) for the bundled records.

> Part of the doctoral work of Carlos Isaac Zainea Maya
> (Universidad Nacional de Colombia), advised by Agustín Moreno Cañadas.

## Stack

- **Backend** — FastAPI · Anthropic SDK (Claude with tool calling) ·
  pyalex · `aiq-quivers ≥ 1.2.0`. Returns raw graph data
  (nodes / edges / values), streams chat over Server-Sent Events.
- **Frontend** — Vite · React 19 · TypeScript · Tailwind · shadcn/ui ·
  TanStack Query · Zustand · react-router. Visualisations use
  Cytoscape.js (Brauer quiver + Scienti coauthorship) and Recharts
  (histograms, treemap, radar).
- **Docker** — two services (`backend`, `frontend`) wired together by
  `docker-compose.yml`. Each has its own Dockerfile and `railway.json`
  for one-click deployment.

## Quick start — local (Docker)

```bash
git clone https://github.com/<your-username>/scholar-agent.git
cd scholar-agent
cp .env.example .env
# Fill in ANTHROPIC_API_KEY (get one at console.anthropic.com)
docker compose up --build
```

Then open:

- **Frontend** → http://localhost:8080
- **Backend Swagger** → http://localhost:8000/docs
- **Backend health** → http://localhost:8000/health

## Local development (no Docker)

### Backend

```bash
cd backend
pip install -e ".[dev]"
export ANTHROPIC_API_KEY=...
uvicorn app.main:app --reload --port 8000
pytest tests/ -v
```

### Frontend

```bash
cd frontend
npm install
npm run dev     # http://localhost:5173 (proxies /api to :8000)
```

## Deploying to Railway

The repo is preconfigured for [Railway](https://railway.app). Each
service ships its own `railway.json` so the platform knows which
Dockerfile to build.

### One-time setup

1. Sign in to Railway and connect your GitHub account.
2. **New Project → Deploy from GitHub repo → pick `scholar-agent`**.
3. Railway will detect two services. For each, set the **Root Directory**:

   | Service  | Root directory |
   |----------|----------------|
   | backend  | _empty_ (uses repo root; Dockerfile path is `backend/Dockerfile`) |
   | frontend | `frontend`     |

   > The backend's Dockerfile needs the repo root as build context so
   > it can copy both `backend/app` and `scienti_sample/`.

4. Configure environment variables (Service → Variables):

   **backend:**

   ```
   ANTHROPIC_API_KEY = sk-ant-api03-...
   CLAUDE_MODEL      = claude-sonnet-4-5      (optional)
   OPENALEX_EMAIL    = you@example.org        (optional)
   CORS_ORIGINS      = https://<your-frontend>.up.railway.app
   ```

   **frontend:**

   ```
   BACKEND_URL = https://<your-backend>.up.railway.app
   NGINX_PORT  = ${{PORT}}      # let Railway choose the port
   ```

5. Generate a public domain for each service (Service → Settings →
   Networking → Generate Domain). Plug the backend URL into the
   frontend's `BACKEND_URL` and the frontend URL into the backend's
   `CORS_ORIGINS`.

6. Every push to `main` triggers a redeploy.

### Notes

- The backend image bundles a small Scienti sample (~9 MB, 100 CvLAC +
  50 GrupLAC). For the full 4 GB scrape, mount a Railway Volume and
  point `SCIENTI_DATA_DIR` at it.
- The chat agent needs a valid `ANTHROPIC_API_KEY`. Without one the
  rest of the app still works (Brauer + Scienti viz).
- Logs and health endpoints: backend at `/health`, frontend at `/`.
- Cost: with light traffic this fits inside Railway's free tier
  (~$5/month credit). Heavier loads will incur usage-based charges.

## Endpoints

| Method | Path                                         | Description                                            |
|--------|----------------------------------------------|--------------------------------------------------------|
| GET    | `/health`                                    | Health check (Anthropic configured? Scienti present?)  |
| GET    | `/authors`                                   | Authors with preprocessed datasets                     |
| GET    | `/authors/registry`                          | Persistent author registry (JSON)                      |
| POST   | `/authors/registry`                          | Register an author + queue OpenAlex collection         |
| DELETE | `/authors/registry/{key}`                    | Remove an author from the registry                     |
| GET    | `/authors/jobs/{key}`                        | Status of an in-progress collection job                |
| GET    | `/authors/openalex/search?q=...`             | Live OpenAlex search                                   |
| GET    | `/brauer/{key}/summary`                      | Full Brauer analysis (δ_B, H(B), dimensions, …)        |
| GET    | `/brauer/{key}/top-papers?n=5`               | Papers ranked by Δ_B contribution                      |
| GET    | `/brauer/{key}/top-references?n=10`          | References ranked by valency                           |
| GET    | `/brauer/{key}/entropy`                      | Per-reference entropy contributions                    |
| GET    | `/brauer/{key}/search?q=...`                 | Search references by title / author                    |
| GET    | `/brauer/compare?keys=a&keys=b`              | Multi-way author comparison + shared refs              |
| GET    | `/brauer/{key}/quiver?max_nodes=200`         | Quiver Q_M as nodes / edges / loops                    |
| GET    | `/brauer/{key}/valency`                      | Valency histogram bins                                 |
| GET    | `/brauer/{key}/polygon-contributions`        | Per-polygon δ_B contribution                           |
| GET    | `/brauer/{key}/weights?top_n=40`             | Reference weights ω(m) for the treemap                 |
| GET    | `/brauer/radar?keys=a&keys=b`                | Normalised invariants for a radar chart                |
| POST   | `/agent/chat`                                | SSE-streamed Claude conversation with tool calling     |
| GET    | `/scienti/overview`                          | Counts of CvLAC and GrupLAC records                    |
| GET    | `/scienti/coauthorship/summary`              | Top coauthors of the Scienti scrape                    |
| GET    | `/scienti/coauthorship/graph`                | Node/edge payload for the coauthorship visualisation   |
| GET    | `/scienti/groups/summary`                    | Top research groups by membership                      |
| GET    | `/scienti/brauer`                            | Brauer configuration built from Scienti articles       |

## Layout

```
scholar-agent/
├── backend/
│   ├── Dockerfile
│   ├── railway.json
│   ├── pyproject.toml
│   ├── app/
│   │   ├── config.py            # paths, env, registry defaults
│   │   ├── main.py              # FastAPI app, CORS, /health
│   │   ├── routers/             # authors, brauer, agent (SSE), scienti
│   │   └── services/            # registry, brauer (raw data),
│   │                            # collector, agent (tool-calling), scienti
│   └── tests/                   # 18 tests
├── frontend/
│   ├── Dockerfile               # multi-stage Node → nginx
│   ├── nginx.conf.template      # env-substituted at container start
│   ├── railway.json
│   └── src/
│       ├── App.tsx              # Router (Chat / Brauer / Compare / Scienti)
│       ├── components/
│       │   ├── ui/              # shadcn primitives
│       │   ├── graphs/          # QuiverGraph, CoauthorshipGraph (Cytoscape)
│       │   ├── charts/          # ValencyHistogram, PolygonContributionsChart,
│       │   │                    # WeightTreemap, RadarComparison (Recharts)
│       │   ├── Sidebar.tsx
│       │   └── AddAuthorDialog.tsx
│       ├── pages/               # ChatPage, BrauerPage, ComparePage, ScientiPage
│       └── lib/                 # API client, hooks, store
├── scienti_sample/              # 100 CvLAC + 50 GrupLAC bundled samples
│   ├── cvlac/
│   └── gruplac/
├── docker-compose.yml
├── .env.example
├── .gitignore
├── LICENSE
└── README.md
```

## Provenance

- The Scienti sample under [scienti_sample/](scienti_sample/) was
  collected from publicly available Minciencias CvLAC and GrupLAC
  records. The full 4 GB scrape used elsewhere in the research is not
  included here.
- All Brauer mathematics lives in [`aiq-quivers`](https://pypi.org/project/aiq-quivers/);
  this app is a thin orchestration layer + UI.

## License

MIT — see [LICENSE](LICENSE).
