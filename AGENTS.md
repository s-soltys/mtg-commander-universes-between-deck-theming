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

## Rule Maintenance
- Treat user direction changes and new perspectives as rule-update triggers.
- When the user provides a new direction or an interesting perspective, propose a concrete refinement to `AGENTS.md` (and any related rules file) in the same thread.
- Keep rules current with the latest confirmed direction; do not leave guidance stale after a direction change.

## Runtime Command Consent Rules
- Ask the user before starting the app (`meteor`, `npm run start`, `npm run dev`, or equivalent long-running watch/server commands).
- Do not start or restart the app unless the user explicitly confirms for the current task.
- If app runtime verification would help, offer it as an option instead of running it by default.
