# JevRillion

![JevRillion gameplay: fruit answers receiving Jev classifications and points on the live scoreboard](docs/media/gameplay.gif)

JevRillion is a local category word game inspired by [Krillion](https://krillion.io/). When you start, the game will present you with a category (i.e. "Name fruit"). Enter as many matching answers as you can before the timer runs out! Common answers earn points; uncommon and obscure answers earn more!

## Why Jev?

Jev is a specialized AI language model designed specifically for classification and structured output rather than for generating conversational text. Open-ended categories need a judge with broad general knowledge. Jev can evaluate familiar and unusual answers against each category's written criteria without a predefined list of acceptable words for each category.

- **Jev has the knowledge of a standard LLM, but runs up to 200× faster at a fraction of the cost**. By evaluating choices in parallel instead of generating text token-by-token, Jev delivers complex categorizations in under half a second—ideal, making it ideal for real-time game logic where even the fastest typical LLMs would be far too slow and expensive.
- **Its structured [Choice output](https://docs.typesafe.ai/primitives/choice) can map answers to defined criteria**. Each answer can be assigned a label to **Common**, **Uncommon**, **Obscure**, or **Not**, for the given category, determining if the answer is valid and how many points it scores. The game can evaluate answers that were never anticipated by the developer rather than being limited to a fixed answer bank.
- **Adding new questions is easy.** Category definitions live in human-editable JSON, making adding new questions easy as developers need only define the question and criteria for each scoring level. Jev handles the rest.

## Install and run

To run JevRillion locally, install [Node.js 22.12 or newer](https://nodejs.org/en/download) first. npm is included with Node.js, so you do not need to install it separately. You will also need [Git](https://git-scm.com/downloads) if you want to clone the repository from the command line, and a modern browser.

Open a terminal in the folder where you want the project, then clone the repository and move into it.

```sh
git clone MattTPin/jevrillion
cd jevrillion
```

If you already have the project downloaded, open the `jevrillion` folder in your terminal instead. Before running the next commands, make sure you are in the repository root—the folder containing `package.json`.

Install the project dependencies, then start the local development server:

```sh
npm install
npm run dev
```

Open **http://127.0.0.1:5173** in your browser. Keep the terminal running while you play; press **Ctrl+C** there to stop the server.

To use Jev during gameplay, you will also need an [OpenRouter account](https://openrouter.ai/). After launching the game, choose **Connect OpenRouter** and authorize JevRillion; requests are billed to your OpenRouter account.

`npm run dev` starts Vite and a small local Express backend. The backend handles Jev requests, spelling checks, and reading/writing the question and leaderboard JSON files. Vite proxies `/api` requests to it at `127.0.0.1:3001` by default.

## Bring your own OpenRouter Key

After launching the game, click **Connect OpenRouter**, this will take you to OpenRouter where you can authorize JevRillion to make Jev requests which will be billed to your account.

- This process uses OAuth with [OpenRouter's OAuth PKCE flow](https://openrouter.ai/docs/guides/overview/auth/oauth) to connect your account without exposing an app secret. Your credential stays in browser memory and is sent to the local game server only to make Jev requests; it is never saved and cleared whenever you refresh or close the page.

The Connect screen loads available TypeSafe Jev models from [OpenRouter's model catalog](https://openrouter.ai/docs/api/api-reference/models/list-all-models-and-their-properties). The model you choose is kept for the active app session and used for connection checks and gameplay.

## Key features

- **Automatic spelling correction** — Whenever a mispelled word is submitted a local spell check can try the closest valid correction alongside the player's original answer, allowing for answers points to still be scored. Traditional NLP still has it's place!
- **Configuration and easy model upgrades** — change the default Jev model, probability threshold, round duration, accepted answer threshold, and point values without changing game code by updating `settings.json`.
- **Leaderboards** — completed rounds and category scores are stored locally for quick comparison.

## Configuration

Edit the root `settings.json` to change game settings. It contains no API keys; OpenRouter credentials come from the Connect screen. Restart the app and refresh the page after changing settings.

| Setting                          | Default / purpose                                                           |
| -------------------------------- | --------------------------------------------------------------------------- |
| `VITE_DEFAULT_JEV_MODEL`         | `typesafe/jev-1.13`; pinned default selected on the Connect screen          |
| `CONFIDENCE_THRESHOLD`           | `90`; a scoring option's probability must be strictly above this percentage |
| `DUPLICATE_SIMILARITY_THRESHOLD` | `95`; similarity percentage for repeat detection                            |
| `REGION`                         | `western`; selects an instruction from `src/questions/region_prompts.json`     |
| `ROUND_SECONDS`                  | `90`; displayed as 01:30                                                    |
| `COMMON_POINTS`                  | `10`                                                                        |
| `UNCOMMON_POINTS`                | `20`                                                                        |
| `OBSCURE_POINTS`                 | `50`                                                                        |
| `DEV_MODE`                       | `false`; `true` shows the question workshop                                 |
| `BACKEND_PORT`                   | `3001`; local API port, also used by Vite's proxy                            |

## Test and build

```sh
npm run lint
npm run typecheck
npm test
npm run test:e2e
npm run build
```

The automated browser tests simulate the OpenRouter redirect and credential exchange without logging into any account. A real OpenRouter login and live Jev call require manual testing with your own account. `npm run build && npm start` serves the built app and API from the local server on port 3001.

## Repository map

| Location                            | Responsibility                                                          |
| ----------------------------------- | ----------------------------------------------------------------------- |
| `src/features/keys/`                | OAuth PKCE, connection state, and the Connect screen                    |
| `src/features/play/`                | Round engine, gameplay UI, feedback, and results                        |
| `src/features/leaderboard/`         | Player history and category leaderboards                                |
| `src/features/dev/`                 | Category editor and test bench                                          |
| `src/services/`                     | API client, player storage, validation, duplicate handling, and scoring |
| `src/questions/questions.json`      | Editable categories with stable IDs                                     |
| `src/questions/region_prompts.json` | Regional familiarity instructions                                       |
| `server/services/jev/`              | OpenRouter Decisions API adapter and response handling                  |
| `server/services/spelling.ts`       | Local spell check and closest suggestion                                |
| `server/app.ts`                     | Loopback Express API, questions, and leaderboards                       |
| `settings.json`                      | Non-secret game and backend settings                                     |
| `tests/`                            | Unit, HTTP, and browser tests                                           |
