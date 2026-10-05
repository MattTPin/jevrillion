# JevRillion

JevRillion is a local category word game built with React and TypeScript. Players submit answers before a timer expires; Jev classifies each answer as Common, Uncommon, Obscure, or Not, and the game awards configured points.

## Architecture and directory guide

Vite serves the browser UI during development and proxies `/api` to a small Express backend. The backend handles OpenRouter requests, spelling checks, and JSON persistence; production mode also serves the built UI. OpenRouter is the only provider; Jev uses its structured Decisions API with `model`, `state`, and `questions`.

| Location | Responsibility |
| --- | --- |
| `src/main.tsx`, `src/app/App.tsx` | Startup, OAuth callback capture, shared state, and tab navigation. |
| `src/components/common/` | Shared UI and input conventions. |
| `src/features/keys/` | Connect screen, OAuth PKCE, credential session, and selected model. |
| `src/features/play/` | Round engine (`game.ts`), hook (`useGame.ts`), gameplay, and results. |
| `src/features/leaderboard/` | Player history and local category comparisons. |
| `src/features/dev/` | Question editor and draft-answer test bench. |
| `src/services/` | API client, persistence, shared scoring, duplicates, validation, timing, and model helpers. |
| `src/types/index.ts` | Types shared by the frontend and backend. |
| `src/questions/` | Human-editable `questions.json` and regional instructions in `region_prompts.json`. |
| `src/styles/globals.css` | Global CSS; gameplay styles live beside Play components. |
| `server/index.ts`, `server/app.ts` | Backend startup, guarded API routes, and production serving. |
| `server/settings.ts`, `server/config.ts` | Settings allowlist, loading, validation, and public configuration. |
| `server/services/jev/` | OpenRouter adapter, model discovery, request construction, parsing, and spelling-result resolution. |
| `server/services/` | Spell checker, question/leaderboard stores, atomic JSON writes, regions, and saved-score compatibility. |
| `leaderboards/` | Local leaderboard JSON; player records are ignored by Git. |
| `tests/` | Unit/HTTP tests and isolated Playwright flows in `tests/browser/`. |
| `docs/media/` | Gameplay GIF used by the README. |
| `.agents/skills/` | Task-specific guidance linked below. |

## Development

Use Node.js 22.12 or newer. Scripts live in [package.json](package.json).

- `npm install` installs dependencies; `npm run dev` starts both frontend and backend.
- `npm run lint`, `npm run typecheck`, and `npm test` check application code. Run relevant browser flows with `npm run test:e2e` when UI, authentication, timing, or persistence changes.
- `npm run build` creates the production frontend; `npm start` serves it with the API.

Root `settings.json` contains non-secret runtime settings. `BACKEND_PORT` also controls Vite's proxy. Read current values from the validated configuration; Vite's environment loader is disabled. [README.md](README.md) contains installation and user-facing setup details.

## Project rules

- Use strict TypeScript, Oxlint, existing React patterns, and minimal dependencies. Keep presentation, game rules, and provider requests separated.
- Favor broad, defensible category answers and reward creativity; specialist familiarity should not make every answer Common. Gameplay and Dev share the same question schema. Preserve existing question IDs and append safety/region guidance in the request builder.
- Keep scoring out of components. Preserve original-answer priority, duplicate protections, the absolute deadline, and settlement of submitted requests before finalizing.
- Use `src/services/storage.ts` for browser persistence. Pool reset retains scores. Backend mutations use the serialized, atomic JSON writer; preserve scoring snapshots and older attempts.
- OAuth uses PKCE. Keep the returned key in browser memory and send it to the local backend only for provider requests. Temporary redirect state uses sessionStorage; credentials must not enter storage, cookies, settings, logs, error details, or committed files.
- Preserve loopback binding, origin checks, sanitized errors, and the server-side Dev-mode gate. Automated provider/authentication checks use mocks; do not sign into OpenRouter as the user.
- Keep the default model pinned to a concrete version. The connection session owns the selected model; discovery failure must not block connection.

## Task skills and maintenance

Read the relevant skill before changing its area:

- [Writing questions](.agents/skills/writing-questions/SKILL.md): category scope, four-choice criteria, and regional familiarity.
- [Scoring philosophy](.agents/skills/scoring-philosophy/SKILL.md): acceptance, bonuses, spelling fallback, duplicates, and historical scores.
- [Changing provider integration](.agents/skills/changing-provider-integration/SKILL.md): OAuth, model discovery, requests, and credential handling.
- [Testing gameplay changes](.agents/skills/testing-gameplay-changes/SKILL.md): focused checks and the isolated browser harness.

Update this file when architecture, directories, commands, or conventions materially change. Update the relevant skill when its behavior changes. Keep README edits focused on information players need.
