# Codex Project Rules

## Meteor 3 Rules
- Use async-first Meteor 3 patterns. Prefer `async/await`; do not use sync-style data access.
- Keep server-only code in `server/` or server-only modules. Do not import server logic into client code.
- Keep application modules under `imports/`. Keep `client/main.tsx` and `server/main.ts` as thin entrypoints.
- Use Meteor Methods and publications as client-server boundaries. Do not perform privileged operations from the client.
- Keep startup side effects inside `Meteor.startup` and keep module top-level execution minimal.

## Tailwind Rules
- Prefer Tailwind utilities in components. Do not add ad-hoc CSS when utility classes cover the need.
- Keep global CSS limited to framework directives, base layers, and theme tokens. Do not place component styling in globals.
- Define repeated style values as tokens or CSS variables. Do not scatter hard-coded colors or spacing values.
- Keep class composition readable and consistent. Extract repeated UI patterns into reusable components.

## TypeScript Rules
- Do not use `any` except tightly justified interop edges.
- Strongly type component props, Meteor method inputs/outputs, and shared domain models.
- Use `type` and `interface` intentionally. Keep nullability explicit.
- Prefer `unknown` with narrowing over unsafe casts.
- Keep imports and path usage type-safe and aligned with `tsconfig.json`.

## Testing Strategy Rules
- Keep `npm test` (`meteor test --once --driver-package meteortesting:mocha`) passing before finalizing changes.
- Add or update tests for every behavior change and every bug fix.
- Test at the correct layer: unit tests for pure logic, integration tests for Methods/publications and data boundaries, runtime assertions for client/server differences.
- Keep tests deterministic and isolated. Do not rely on hidden cross-test state.

## MTG Data Integration Rules
- Prefer Scryfall API for card metadata and image URLs.
- Treat deck parsing as deterministic pure logic and cover it with unit tests.
- Keep third-party API calls server-only and resilient to partial lookup failures.

## Deck Theming Rules
- Themed generation must run server-side only.
- Use one structured OpenAI call per deck by default.
- Preserve gameplay mechanics unless explicitly requested otherwise.
- Basic lands must remain unchanged.
- Theming prompts and schemas must live in dedicated maintainable modules with tests.
- Re-theming must require explicit user confirmation and must discard prior themed results before generating new ones.

## Deck Image Generation Rules
- Themed image generation must run server-side only and only after deck theming is completed.
- OpenAI themed image generation must be non-blocking server-side jobs. Methods should return start/queue acknowledgements immediately, and progress must be represented through persisted per-card status transitions (`idle` -> `generating` -> `generated|failed`).
- Generate themed images from stored themed card prompts on a per-card basis and persist results on themed card records.
- Deck details must expose per-card "Generate Image" actions in decklist rows and render generated themed art inline in those rows.
- Per-card image generation must open a confirmation/edit dialog that allows changing themed card title and image prompt before triggering generation.

## Themed Card Composite Rules
- Themed card composite generation must run server-side only.
- Composite generation must merge original Scryfall card frame image + generated themed art + themed card title into a final card render.
- Store composite outputs separately from generated themed art outputs.
- v1 composite generation supports standard single-face MTG frame coordinates only and must fail clearly on unsupported layouts.
- Deck details must expose asynchronous per-row "Create themed card" actions and render composite status transitions inline.

## Navigation IA Rules
- Keep deck list as the default landing page at `/`.
- Keep deck creation on a dedicated `/create` route.
- Keep deck details pages focused on deck-specific actions; do not show the create deck form on deck details pages.

## Deck Copy Rules
- Deck copy must duplicate only base decklist and card records.
- Deck copy must require a new title for the copied deck.
- Copied decks must reset theming state and must not inherit generated themed card results.

## Deck Deletion Rules
- Deck deletion must run through a server method and remove the deck plus associated deck cards and themed deck cards.
- Deck deletion UI must require explicit user confirmation before the delete operation runs.

## Decklist Presentation Rules
- When a deck has completed theming, each decklist card row must show themed card name alongside the original card name.
- Decklist rows should render as a three-column card layout: original name + original art, themed name + themed description + themed art, and final themed card render/status/actions.
- Do not render a separate themed section when themed details are already shown inline in the decklist rows.
- In deck details, render theme status/details and theme/re-theme action in a dedicated top card above the decklist card.

## Rule Maintenance
- Treat user direction changes and new perspectives as rule-update triggers.
- When the user provides a new direction or an interesting perspective, propose a concrete refinement to `AGENTS.md` (and any related rules file) in the same thread.
- Keep rules current with the latest confirmed direction; do not leave guidance stale after a direction change.

## Runtime Command Consent Rules
- Ask the user before starting the app (`meteor`, `npm run start`, `npm run dev`, or equivalent long-running watch/server commands).
- Do not start or restart the app unless the user explicitly confirms for the current task.
- If app runtime verification would help, offer it as an option instead of running it by default.

## App Settings & Secrets Rules
- OpenAI key configuration must be managed server-side.
- Client may only access masked OpenAI key status through a publication.
- Runtime OpenAI calls must resolve keys from app settings first, then fall back to environment variables.
- Raw OpenAI API keys must never be published to clients.
