# Local PostgreSQL

This Compose configuration runs PostgreSQL 17 for local development. Django
continues to run directly in Ubuntu and connects through the existing
`DATABASE_URL` in the root `.env`, using `127.0.0.1:5432`.

## Start PostgreSQL

From the repository root, run:

```sh
docker compose --project-directory . --env-file .env -f infra/compose.yaml up -d db
```

Compose reads `POSTGRES_DB`, `POSTGRES_USER`, and `POSTGRES_PASSWORD` from the
root `.env`; all three are required. The database is published only on
`127.0.0.1:5432`, so it is reachable to development tools in Ubuntu without
exposing the port on other network interfaces.

## Verify health and connections

Check the Compose service state and PostgreSQL health check:

```sh
docker compose --project-directory . --env-file .env -f infra/compose.yaml ps db
docker inspect --format '{{.State.Health.Status}}' \
  "$(docker compose --project-directory . --env-file .env -f infra/compose.yaml ps -q db)"
```

The health status should be `healthy`. To verify that PostgreSQL accepts a
query inside the container:

```sh
docker compose --project-directory . --env-file .env -f infra/compose.yaml \
  exec db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAc "SELECT 1"'
```

To verify Django can open the configured database connection, without running
migrations:

```sh
cd backend
pipenv run python manage.py shell -c \
  'from django.db import connection; connection.ensure_connection(); print(connection.vendor)'
```

The command should report `postgresql`.

## Logs, stop, and restart

Inspect the service logs with:

```sh
docker compose --project-directory . --env-file .env -f infra/compose.yaml logs --tail=100 db
```

Stop the container while preserving all database data:

```sh
docker compose --project-directory . --env-file .env -f infra/compose.yaml stop db
```

Restart a stopped container:

```sh
docker compose --project-directory . --env-file .env -f infra/compose.yaml start db
```

The `postgres_data` named volume stores the PostgreSQL data directory and
survives container stops, restarts, and recreation. Preserve this volume to
preserve the database. Do not use `docker compose down -v` or otherwise remove
the volume as part of normal development.
