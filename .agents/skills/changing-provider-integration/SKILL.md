---
name: changing-provider-integration
description: "Modify JevRillion OpenRouter OAuth, model discovery or selection, and Jev Decisions requests while preserving credential security."
---

# Changing provider integration

Trace the relevant existing flow before changing it. Verify current official OpenRouter or TypeSafe documentation when altering API contracts; preserve adapter isolation and validate upstream responses.

## Connection and credentials

[oauth.ts](../../../src/features/keys/oauth.ts) handles random state, an S256 PKCE challenge, the callback, and code exchange. Temporary verifier/state/model data uses sessionStorage and is removed when consumed. Callback parameters are scrubbed before React mounts; missing, mismatched, expired, or reused state must not yield a credential.

[useCredentials.ts](../../../src/features/keys/useCredentials.ts) owns the returned key and active model in application memory. Preserve verification before unlocking Play, protection against stale asynchronous results, and one callback exchange despite React StrictMode. Refresh or disconnect clears the credential. Keep keys out of URLs, cookies, browser storage, settings, diagnostics, and raw error messages. Automated checks use mocked OAuth; do not authenticate as the user.

## Models

The centralized fallback in [jev-models.ts](../../../src/services/jev-models.ts) is pinned to `typesafe/jev-1.13`; root `VITE_DEFAULT_JEV_MODEL` can override it.

Opening Connect triggers the public OpenRouter catalog through [the model adapter](../../../server/services/jev/models.ts). Filter to TypeSafe Jev-family IDs and prefer concrete versions. Include aliases or router entries only when returned by the catalog; avoid unrelated TypeSafe models. Discovery failure must retain the configured default and allow connection.

The session's selected model passes with credentials through the API client to connection checks, gameplay, and Dev evaluation. Preserve it across the OAuth redirect using temporary PKCE state. Components should consume this shared state.

## Decisions and errors

[openrouter.ts](../../../server/services/jev/openrouter.ts) calls OpenRouter's Decisions API. Jev requests use `model`, candidate data in `state`, and choice `questions`; use the existing structured request builder.

[shared.ts](../../../server/services/jev/shared.ts) appends candidate-safety instructions and the regional prompt, parses the four probabilities, validates distributions, and maps upstream failures into safe errors. Candidate text belongs in state and must not become instructions. Optional spelling correction evaluates two independent choice questions in one request and resolves them into one evaluation afterward.

Preserve timeouts, rejection of malformed responses, and sanitized authentication, credit, rate-limit, and availability errors. Relevant checks are [oauth.test.ts](../../../tests/oauth.test.ts), [models.test.ts](../../../tests/models.test.ts), and [scoring.test.ts](../../../tests/scoring.test.ts).
