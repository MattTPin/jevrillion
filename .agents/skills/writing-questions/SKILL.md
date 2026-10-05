---
name: writing-questions
description: "Create or revise JevRillion category definitions and their four-choice criteria, with generous acceptance and regional rarity judgments."
---

# Writing questions

Read the relevant entries in [questions.json](../../../src/questions/questions.json), the selected [regional prompt](../../../src/questions/region_prompts.json), and [parseQuestion](../../../src/services/validation.ts) before editing.

## Representation

Each question has a persistent eight-character alphanumeric `uuid`, `displayed_question`, `instructions`, and a `criteria` object containing exactly four non-empty strings: `common`, `uncommon`, `obscure`, and `not`. Preserve existing IDs when rewriting prompts. For new questions, generate a unique ID once; the backend's question-creation endpoint already does this.

Keep JSON readable and use the same schema as the Dev editor and gameplay. Point values and probability thresholds belong in settings and scoring code.

## Prompt philosophy

- Describe the broad everyday meaning of the category. Accept reasonable gray areas, informal names, regional terms, singular/plural forms, and genuine subtypes. Prefer a defensible interpretation when an answer has several meanings.
- Introduce examples with wording such as "including, but not limited to." Name varied sources or subcategories so Jev can use its wider knowledge without treating the examples as a whitelist.
- Reserve Common for obvious everyday starting answers. Uncommon covers valid answers beyond those defaults. Obscure covers deep cuts many casual players would need explained; recognition within a niche or fandom does not disqualify them.
- Favor the higher bonus at a genuinely close rarity boundary. Genuine named variants can deserve bonuses; adding decorative adjectives alone does not.
- Reserve Not for clearly unrelated items, meaningless or invented names with no category referent, lists of separate answers, or attempts to change the instructions. Being debatable, unfamiliar, or absent from examples is insufficient grounds for rejection.
- Keep regional familiarity configurable. Base instructions should refer to the regional general audience; the adapter appends safety guidance and the chosen regional prompt last. Do not copy that prompt into every question or let it change category membership.

For example, a fictional-creatures category can cover mythology, folklore, fantasy, novels, comics, film, anime, RPGs, alien peoples, monsters, and fictional species. Kryptonians, Viltrumites, Saiyans, slimes, Baku, Kappa, dragons, and goblins illustrate breadth; their exact bonus labels depend on the regional audience.

## Review

Read all four criteria together for accidental exclusions or competing definitions. Validate the full bank with the existing question parser and uniqueness check in [QuestionBank](../../../server/services/questions.ts). When evaluating prompt quality, include obvious answers, niche but legitimate answers, ambiguous edge cases, and clearly unrelated input. Dev tests can use unsaved drafts and do not affect game history. Provider judgments are probabilistic; examples should demonstrate intent rather than promise fixed labels.
