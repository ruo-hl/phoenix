# Phoenix Development Runbook

## Quick Start

```bash
cd /Users/ruo/Downloads/projects/work/phoenix

# Start Phoenix with Postgres
docker-compose up -d

# View logs
docker logs -f phoenix-phoenix-1
```

Phoenix will be available at http://localhost:6006

## Architecture

```
phoenix/                    # Phoenix observability platform
├── src/phoenix/           # Python backend
├── app/                   # React frontend
└── docker-compose.yml     # Docker setup

agentic-obs-demo/obs/      # Observation SDK (separate repo)
└── src/obs/discovery/     # Issue discovery module
```

The `obs` package is mounted into the Phoenix container as a volume:
- Host: `../agentic-obs-demo/obs`
- Container: `/phoenix/obs`

This means:
- **Changes to obs code are reflected immediately** (no rebuild needed)
- **obs persists across container restarts** (no more `docker cp`)
- **Both repos stay separate** but work together

## Making Changes

### Frontend Changes (app/)

```bash
cd /Users/ruo/Downloads/projects/work/phoenix/app

# Build frontend
pnpm run build

# Rebuild Docker image and restart
docker-compose build phoenix
docker-compose up -d phoenix
```

### Backend Changes (src/phoenix/)

```bash
# Rebuild Docker image and restart
docker-compose build phoenix
docker-compose up -d phoenix
```

### obs Package Changes (../agentic-obs-demo/obs/)

No action needed! Changes are reflected immediately via the volume mount.

## Database

Postgres runs in a separate container with persistent volume.

```bash
# Connect to database
docker exec -it phoenix-db-1 psql -U postgres -d postgres

# View projects
SELECT * FROM projects;

# View discovery runs
SELECT * FROM trace_discovery_runs;
```

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

## Issue Discovery Feature

The Issues tab runs trace clustering and slice analysis:

1. Navigate to a project with traces
2. Click the "Issues" tab
3. Click "Run Discovery"

Discovery uses the `obs.discovery` module which:
- Fetches traces from Phoenix
- Extracts features (tool sequences, metadata)
- Clusters traces using HDBSCAN
- Ranks attribute slices by statistical lift
