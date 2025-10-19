# Docker setup

This repository includes Dockerfiles for the frontend (`frontChess`) and backend (`my-express-backend`), and a `docker-compose.yml` at the repo root.

Quick start:

```bash
# from the repo root
docker compose up --build
```

Services:

- db: Postgres 15 (listens on 5432)
- backend: Node backend (listens on 3000)
- frontend: nginx serving built Vite app (listens on 8080)

Environment:

- The backend uses `DATABASE_URL` set in `docker-compose.yml`. Update it if you change Postgres credentials.
- Replace `JWT_TOKEN` in the compose file for production.

Notes:

- The backend volume mount allows development edits to be reflected in the container; for production you may want to remove the mount and rely on the built image.
- The frontend Dockerfile builds the static assets and serves them via nginx.

Railpack / CI note:

- Some deployment tools look for a repository root script named `start.sh` to build or start the project. This repo includes a helper `start.sh` which installs dependencies and builds both `backChess` and `frontChess` when present. Make it executable before use:

```bash
chmod +x start.sh
./start.sh
```

## Railway deployment notes

- Railway can deploy either by detecting a `start` script in `package.json` or by using your service's `Dockerfile`.
- For the frontend (`frontChess`) I added a `start` script which runs `vite preview --host 0.0.0.0 --port $PORT`. Railway sets the `$PORT` environment variable; you don't need to hardcode it.
- For the backend (`backChess`) ensure the `DATABASE_URL` and any secrets (like `JWT_TOKEN`) are set in Railway's environment variables. Example values from `docker-compose.yml`:

```
DATABASE_URL=postgresql://postgres:postgres@<your-railway-postgres-host>:5432/chess42
JWT_TOKEN=change_this_for_prod
SALT_ROUNDS=12
```

- If you prefer Docker-based deploy on Railway, the repository already contains `Dockerfile` for both services and a `docker-compose.yml` for local testing. Railway will use the Dockerfile in each service's root if you select Docker deployment.
