# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Frontend**: React + Vite (artifacts/financial-risk)

## Structure

```text
artifacts-monorepo/
├── artifacts/              # Deployable applications
│   ├── api-server/         # Express API server
│   └── financial-risk/     # React + Vite frontend (AI Financial Risk Analytics)
├── lib/                    # Shared libraries
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
├── scripts/                # Utility scripts (single workspace package)
│   └── src/                # Individual .ts scripts
├── pnpm-workspace.yaml     # pnpm workspace (artifacts/*, lib/*, scripts)
├── tsconfig.base.json      # Shared TS options
├── tsconfig.json           # Root TS project references
└── package.json            # Root package with hoisted devDeps
```

## Application: AI Financial Risk Analytics and Decision Support System

A Bloomberg terminal-inspired financial risk analytics system for portfolio managers and risk officers.

### Features
- **Dashboard**: Total AUM, risk scores, active alerts, market pulse, sector allocation, activity feed
- **Portfolios**: CRUD for portfolios with calculated risk scores, return rates, and values
- **Portfolio Detail**: Asset management, risk metrics breakdown, AI decision recommendations
- **Risk Analysis**: Market risk panel, risk history charts, portfolio risk breakdowns
- **Alerts**: Risk alerts management with severity levels and acknowledgement
- **AI Decisions**: AI-generated recommendations (rebalance, hedge, diversify, buy/sell)

### Database Tables
- `portfolios` — portfolio records with calculated metrics
- `assets` — individual holdings within portfolios
- `alerts` — risk alerts with severity and status
- `decisions` — AI decision recommendations
- `activity` — system activity feed

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all packages as project references.

- **Always typecheck from the root** — run `pnpm run typecheck`
- **`emitDeclarationOnly`** — only emit `.d.ts` files during typecheck

## Root Scripts

- `pnpm run build` — runs `typecheck` first, then recursively runs `build` in all packages
- `pnpm run typecheck` — runs `tsc --build --emitDeclarationOnly` using project references

## Packages

### `artifacts/financial-risk` (`@workspace/financial-risk`)

React + Vite frontend for the AI Financial Risk Analytics system. Pages in `src/pages/`, components in `src/components/`. Uses `@workspace/api-client-react` for all API calls.

### `artifacts/api-server` (`@workspace/api-server`)

Express 5 API server. Routes in `src/routes/` organized by domain (portfolios, assets, risk, alerts, decisions, dashboard).

- `portfolios.ts` — portfolio CRUD + asset listing
- `assets.ts` — asset update/delete with portfolio recalculation
- `risk.ts` — risk metrics, market risk, risk history
- `alerts.ts` — alert management and acknowledgement
- `decisions.ts` — AI decision generation and application
- `dashboard.ts` — dashboard summary, sector allocation, activity feed

### `lib/db` (`@workspace/db`)

Database layer. Schema tables: `portfoliosTable`, `assetsTable`, `alertsTable`, `decisionsTable`, `activityTable`.

### `lib/api-spec` (`@workspace/api-spec`)

OpenAPI 3.1 spec with endpoints for portfolios, assets, risk, alerts, decisions, and dashboard.

Run codegen: `pnpm --filter @workspace/api-spec run codegen`
