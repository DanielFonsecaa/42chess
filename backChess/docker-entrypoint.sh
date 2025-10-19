#!/bin/sh
set -e

echo "Waiting for database to be available..."
# Try to infer host/port from DATABASE_URL if DB_HOST/DB_PORT not set
if [ -z "$DB_HOST" ]; then
  DB_HOST=$(echo "$DATABASE_URL" | sed -n 's#.*@\([^:/]*\).*#\1#p')
  DB_HOST=${DB_HOST:-db}
fi
if [ -z "$DB_PORT" ]; then
  DB_PORT=$(echo "$DATABASE_URL" | sed -n 's#.*:\([0-9]*\)/.*#\1#p')
  DB_PORT=${DB_PORT:-5432}
fi

echo "DB host=$DB_HOST port=$DB_PORT"

# Node-based TCP wait loop (exits when able to connect)
node -e "const net=require('net'); const host=process.env.DB_HOST||'${DB_HOST}'; const port=Number(process.env.DB_PORT||${DB_PORT}); function wait(){ const s=net.createConnection({host,port},()=>{ s.end(); console.log('DB reachable'); process.exit(0); }); s.on('error',()=>setTimeout(wait,2000)); } wait();"

echo "Running prisma migrations (if any)..."
# try to run migrations; allow failure without breaking (deploys without migrations are ok)
npx prisma migrate deploy || true

echo "Starting application"
exec node index.js
