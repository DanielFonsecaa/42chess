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
