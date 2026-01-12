# Local Development

## Setup

```bash
cd app
pnpm install
cp .env.example .env
pnpm dev:symlinks
```

## Running Dev Servers

### Terminal 1 - Backend
```bash
uv run python -m phoenix.server.main --dev serve
```

### Terminal 2 - Frontend
```bash
cd app
pnpm exec vite --port 5173
```

Open http://localhost:6006

## Troubleshooting

**`ModuleNotFoundError: No module named 'phoenix.evals'`**
```bash
cd app && pnpm dev:symlinks
```

**Port in use**
```bash
lsof -ti:5173 -ti:6006 | xargs kill -9
```
