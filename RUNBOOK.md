# Phoenix Development Runbook

## Quick Start (Docker)

```bash
cd /Users/ruo/Downloads/projects/work/phoenix

# Start Phoenix with Postgres
docker-compose up -d

# View logs
docker logs -f phoenix-phoenix-1
```

Phoenix will be available at http://localhost:6006

## Development with Hot-Reload

For faster iteration during development:

```bash
# Terminal 1: Start database
docker-compose up -d db

# Terminal 2: Start Phoenix backend (from repo root)
cd /Users/ruo/Downloads/projects/work/phoenix
pip install -e ".[dev]"
PHOENIX_SQL_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/postgres phoenix serve --port 6006

# Terminal 3: Start frontend dev server with hot-reload
cd /Users/ruo/Downloads/projects/work/phoenix/app
pnpm install
pnpm run dev
```

Frontend dev server runs on http://localhost:5173 and proxies API calls to the backend.

## Architecture

```
phoenix/
├── src/phoenix/           # Python backend
│   ├── server/api/        # GraphQL API
│   ├── db/                # SQLAlchemy models & migrations
│   └── discovery/         # Issue discovery module
├── app/                   # React frontend (Relay + Vite)
└── docker-compose.yml     # Docker setup
```

## Making Changes

### Frontend Changes (app/)

**With Docker:**
```bash
cd /Users/ruo/Downloads/projects/work/phoenix/app
pnpm run build
docker-compose build phoenix && docker-compose up -d phoenix
```

**With hot-reload:**
```bash
cd /Users/ruo/Downloads/projects/work/phoenix/app
pnpm run dev  # Changes reflect immediately
```

### Backend Changes (src/phoenix/)

**With Docker:**
```bash
docker-compose build phoenix && docker-compose up -d phoenix
```

**With hot-reload:**
```bash
# Restart the phoenix serve command (Ctrl+C and re-run)
```

### GraphQL Schema Changes

After modifying GraphQL types in `src/phoenix/server/api/types/`:

```bash
cd /Users/ruo/Downloads/projects/work/phoenix/app
pnpm run build:relay  # Regenerate Relay types
pnpm run build        # Build frontend
```

### Database Migrations

```bash
# Create a new migration
cd /Users/ruo/Downloads/projects/work/phoenix
alembic -c src/phoenix/db/alembic.ini revision --autogenerate -m "description"

# Run migrations (Docker)
docker exec phoenix-phoenix-1 alembic -c src/phoenix/db/alembic.ini upgrade head

# Run migrations (local)
PHOENIX_SQL_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/postgres \
  alembic -c src/phoenix/db/alembic.ini upgrade head
```

## Database

Postgres runs in a separate container with persistent volume.

```bash
# Connect to database
docker exec -it phoenix-db-1 psql -U postgres -d postgres

# View projects
SELECT * FROM projects;

# View traces
SELECT * FROM traces LIMIT 10;

# View discovery runs
SELECT * FROM trace_discovery_runs;

# View annotations
SELECT COUNT(*), name FROM span_annotations GROUP BY name;
```

## Mock Data

Generate test traces with evaluations:

```bash
cd /Users/ruo/Downloads/projects/work/agentic-obs-demo/mock_data
python generate_mock_traces.py -n 100 -p research-agent -d 30
```

This creates:
- 100 traces spread over 30 days
- 5 eval annotations per trace (intent, complexity, quality, grounding, tool_coverage)

## Issue Discovery Feature

The Issues tab runs trace clustering and slice analysis:

1. Navigate to a project with traces
2. Click the "Issues" tab
3. Click "Run Discovery"

Discovery pipeline:
- Fetches traces and eval annotations from Phoenix
- Extracts features (tool sequences, metadata, eval scores)
- Clusters traces using HDBSCAN
- Ranks attribute slices by statistical lift
- Computes badness scores from eval results

See `src/phoenix/discovery/README.md` for algorithm details.

## Troubleshooting

### Container won't start
```bash
docker logs phoenix-phoenix-1
```

### Reset database
```bash
docker-compose down -v  # WARNING: deletes all data
docker-compose up -d
```

### Force clean rebuild
```bash
docker-compose build --no-cache phoenix
docker-compose up -d phoenix
```

### Clear discovery results
```bash
docker exec phoenix-db-1 psql -U postgres -d postgres -c \
  "DELETE FROM trace_slices; DELETE FROM trace_clusters; DELETE FROM trace_discovery_runs;"
```

### Check eval annotations exist
```bash
docker exec phoenix-db-1 psql -U postgres -d postgres -c \
  "SELECT COUNT(*), name FROM span_annotations GROUP BY name;"
```
