# Learnify Backend

Express + Prisma + PostgreSQL API for the Learnify frontend.

## Setup

1. Create a PostgreSQL database named `learnify`.
2. Copy `.env.example` to `.env` and set `DATABASE_URL` and a strong `JWT_SECRET`.
3. Install dependencies and create the database schema:

```bash
npm install
npm run prisma:generate
npm run prisma:migrate -- --name init
npm run dev
```

When the schema changes, run another migration, for example:

```bash
npm run prisma:migrate -- --name add-theme-preference
```

The API runs at `http://localhost:5000`.

## Render deployment

Set the Render build command to:

```bash
npm install && npm run prisma:generate && npm run prisma:deploy
```

Use `npm start` as the start command. Add `DATABASE_URL` with the Aiven PostgreSQL connection string, a strong `JWT_SECRET`, and `FRONTEND_URL=https://frontend-learnify.vercel.app` in the Render environment settings.

## Core endpoints

- `GET /api/health`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/verify-email`
- `POST /api/auth/resend-verification`
- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password`
- `GET /api/auth/me` with `Authorization: Bearer <token>`
- `PATCH /api/users/me/preferences`
- `GET /api/parent/learners`
- `POST /api/parent/learners`
- `POST /api/integrations/ussd`
- `GET /api/integrations/:provider/start`

OAuth providers require provider applications and callback URLs before they can be enabled. The API intentionally returns a clear `503` response when a provider is not configured instead of pretending an account was linked.
