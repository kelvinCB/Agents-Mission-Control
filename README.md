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

## UI/UX Standard (Mandatory)
- This repo enforces **Uncodixfy** for all frontend UI/UX changes.
- Skill is installed at `.agents/skills/uncodixfy`.
- Project-level enforcement notes live in `AGENTS.md`.

## Production
See `DEPLOYMENT.md` for VPS + Vercel deployment steps (`kelvin-control.site`).
