# Agents Mission Control

A lightweight Mission Control web app with three sections only: **Memory**, **Projects**, and **Agenda**.

## Stack
- Frontend: React + Vite
- Backend: Express
- Unit tests: Vitest (frontend + backend)
- E2E tests: Playwright

## Run
```bash
npm install
npm run dev
```

## Tests
```bash
npm test
npx playwright test
```

## Data conventions
- Agent memories are loaded from `data/memory/<AgentName>/*.md`
- Agenda files are loaded from `data/agenda/*.md`
