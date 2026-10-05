---
name: scoring-philosophy
description: "Change or explain JevRillion acceptance, rarity bonuses, spelling fallback, duplicate handling, and saved scoring rules."
---

# Scoring philosophy

Players should feel rewarded for creative, defensible answers. Keep category acceptance, rarity classification, point assignment, and spelling-result selection distinct. Use [scoring.ts](../../../src/services/scoring.ts) as the scoring authority; components display its result.

## Current rules

Jev returns `common`, `uncommon`, `obscure`, and `not` probabilities on a 0–1 scale. The shared parser converts them to percentages. Overall decision confidence is diagnostic.

1. Find the highest scoring-label probability, using Common, Uncommon, Obscure order for exact ties.
2. Reject if Not wins or ties that label. A bonus cannot rescue category rejection.
3. Require the sum of Common, Uncommon, and Obscure probabilities to be strictly above `CONFIDENCE_THRESHOLD`. Uncertainty about rarity should not invalidate an otherwise strong category match.
4. Consider only the immediately following tier: Common to Uncommon, or Uncommon to Obscure. Promote when its nonzero probability trails the original winner by no more than `BONUS_STEP_UP_MARGIN` percentage points. Zero margin disables promotion, including tied success labels.
5. Promote at most once. Never cascade to a second tier or jump over an intervening tier. Apply the configured points for the awarded label.

Both threshold settings are validated between 0 and 100. Point values come from `COMMON_POINTS`, `UNCOMMON_POINTS`, and `OBSCURE_POINTS`; consult current settings rather than assuming their values.

With Common 50%, Uncommon 43%, Obscure 5%, Not 2%, the combined match is 98% and a 7-point margin awards Uncommon. The 50% / 40% / 8% / 2% spread stays Common at margin 7 and becomes Uncommon at margin 15. These are absolute percentage-point differences, not relative percentages.

Preserve the actual Jev choice in decision data. The awarded choice can differ; record promotion metadata and show the reason in the Dev test bench. Keep comments explaining these exceptions and meaningful tests for threshold boundaries and ties.

## Spelling and duplicates

[Local spelling](../../../server/services/spelling.ts) uses a general English lexicon and a conservative distance limit. A dictionary-recognized answer needs no suggestion. When one eligible correction exists, evaluate original and corrected candidates independently in one Jev request.

The [resolver](../../../server/services/jev/resolve.ts) always prefers a scoring original, then a scoring correction, then the failed original. Higher points for the correction never override a scoring original.

Normalize whitespace and case for repeats. Compare both original and suggested spellings against answers that already scored, using [duplicate handling](../../../src/services/duplicates.ts) and `DUPLICATE_SIMILARITY_THRESHOLD`. Reserve accepted and suggested aliases when an answer scores. Preserve synchronous exact-submission reservations and the second duplicate check when requests settle; concurrent responses must not award the same answer twice. Return the existing "Already entered" state.

## Historical scores

New evaluations use version 3 and capture scoring settings. [Saved-evaluation parsing](../../../server/services/saved-evaluations.ts) recomputes from those snapshots. Version 2 retains its single-label probability gate and receives no step-up bonus; older validity/confidence records retain their original rules.

When changing scoring behavior, account for historical attempts and pending browser retries. Version the rules if applying a new algorithm would change old points. Keep bonus metadata, totals, and restored scores consistent. Relevant regression cases live in [bonus-scoring.test.ts](../../../tests/bonus-scoring.test.ts), [spelling.test.ts](../../../tests/spelling.test.ts), and [duplicates.test.ts](../../../tests/duplicates.test.ts).
