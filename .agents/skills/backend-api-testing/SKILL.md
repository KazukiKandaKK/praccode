---
name: Backend API Manual Testing
description: How to manually spin up the PostgreSQL backend, seed it, and run curl/tsx checks against the `@praccode/api` backend.
---

# Backend API Manual Testing

## Scope

Use this when verifying `apps/backend` API behavior, Prisma repositories, or `LearningAnalysisTrigger` log output.

## Devin Secrets Needed

- None for the basic API smoke tests. `DATABASE_URL` is set locally.
- `GEMINI_API_KEY` or `OPENAI_API_KEY` is only required if you want real LLM analysis output; otherwise the `analyzeLearningProgress` fallback path runs.

## Environment Setup

1. Start Postgres:
   ```bash
   docker run -d --name praccode-db-test \
     -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=praccode \
     -p 5432:5432 --health-cmd='pg_isready -U postgres' postgres:16-alpine
   ```
2. Set `DATABASE_URL`:
   ```bash
   export DATABASE_URL='postgresql://postgres:postgres@localhost:5432/praccode?schema=public'
   ```
3. Generate client, push schema, seed:
   ```bash
   pnpm --filter @praccode/api db:generate
   pnpm --filter @praccode/api db:push --skip-generate
   pnpm --filter @praccode/api db:seed
   ```
4. Get the seeded sample user UUID:
   ```bash
   DATABASE_URL=$DATABASE_URL pnpm --filter @praccode/api exec tsx -e \
     "import {prisma} from './src/lib/prisma.js'; \
      const u=await prisma.user.findUnique({where:{email:'user@example.com'},select:{id:true}}); \
      console.log(u?.id); await prisma.$disconnect();"
   ```

## Start the Dev Server

```bash
DATABASE_URL=$DATABASE_URL PORT=3001 pnpm --filter @praccode/api dev
```

The server logs `Server listening at http://[::]:3001`.

## Common curl Checks

```bash
USER='b3f658e7-ef26-4d87-b2b1-812b9ec6bd15'  # replace with seeded UUID
curl -s -w '\nHTTP %{http_code}' "http://localhost:3001/dashboard/stats?userId=$USER"
curl -s -X POST -H 'Content-Type: application/json' -d "{\"userId\":\"$USER\"}" \
  -w '\nHTTP %{http_code}' http://localhost:3001/dashboard/analyze
```

## Verify LearningAnalysisTrigger Log Hashing

Create a temporary script that calls `triggerLearningAnalysis(userId)` against the seeded user, capture stdout, and grep:

- expected `Triggering learning analysis for user <12-char-sha256-prefix>`
- absence of the raw UUID.

The 12-char prefix is `crypto.createHash('sha256').update(userId).digest('hex').slice(0,12)`.

## Repository Smoke Test

Create a temporary `tsx` script that imports the five `Prisma*Repository` classes and exercises their `save*` and `list*`/`get*` methods. All should use `import { prisma } from './src/lib/prisma.js'` and complete without throwing.

## Test / Lint Commands

```bash
DATABASE_URL=$DATABASE_URL pnpm --filter @praccode/api test
pnpm --filter @praccode/api lint
```

## Cleanup

```bash
fuser -k 3001/tcp 2>/dev/null || true
docker stop praccode-db-test && docker rm praccode-db-test
```
