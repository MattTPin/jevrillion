---
name: testing-gameplay-changes
description: "Verify JevRillion gameplay, connection, editor, or persistence changes with focused regression cases and the isolated browser harness."
---

# Testing gameplay changes

Choose checks that exercise the behavior being changed. Use existing test fixtures and mock OpenRouter responses; deterministic probabilities make scoring cases reproducible. New cases should explicitly set the configurable values they assert so personal settings can change independently.

## Commands and isolation

The scripts in [package.json](../../../package.json) provide `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, and `npm run test:e2e`. For application logic changes, run lint, TypeScript, unit/HTTP tests, and build; use browser tests for affected UI, OAuth, timer, or persistence flows. Documentation-only changes need link/content checks and skill-frontmatter validation.

[The browser server](../../../tests/browser-server.ts) copies the bank and writes leaderboard records in ignored `.test-data/`. Its judge is mocked; OAuth redirects and exchanges are mocked in [game.spec.ts](../../../tests/browser/game.spec.ts). Keep tests isolated from real player records and the source question bank. Do not log into OpenRouter as the user.

[Playwright configuration](../../../playwright.config.ts) starts its own backend and Vite instances. If a personal game is running, choose unused test ports rather than stopping it. Both processes use these overrides:

```powershell
$env:E2E_API_PORT = '3002'
$env:E2E_WEB_PORT = '5174'
npm run test:e2e
```

Windows uses Edge by default. `PLAYWRIGHT_CHANNEL` can override the browser.

## Relevant regression cases

- **Scoring:** strict combined-probability boundary, winning/tied Not, inclusive bonus margin, zero margin, no cascading promotion, configured points, raw versus awarded choice, and Dev explanations.
- **Spelling/repeats:** recognized words, a close typo and an unrelated suggestion, original-result priority, one paired request, both spelling aliases, truck/truk in either order, and overlapping responses.
- **Submission/timing:** rapid Enter presses, exact repeats, more than four words rejected before a request, independent pending evaluations, errors without ending the round, an absolute deadline, and settling submitted answers before saving.
- **History:** identity and scores survive refresh, question exhaustion, reset changes only replay eligibility, replay sets eligibility false again, delayed sync is retryable, and old scoring snapshots retain their points.
- **Connection:** invalid/missing credentials keep Play locked; callback state fails safely; refresh clears credentials; selected models reach check/game/Dev requests; failed discovery preserves the default.
- **Dev/input:** server-side visibility gate, four required criteria, draft testing, question edits and creation persist, and text inputs keep autocomplete disabled.

Inspect failures for actual regressions or unintended dependence on personal settings. After relevant checks pass, expand or repeat them only when a change or unresolved concern warrants it. Live regional classification quality can be playtested by the user with their own connection; mocked tests verify application behavior rather than Jev's real-world judgments.
