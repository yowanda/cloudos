# AGENTS.md — guide for AI / coding agents working on CloudOS

This file is for any AI agent (Codex, Copilot, Cursor, Devin, Aider, etc.)
landing in this repository. It captures the conventions a human contributor
would already know after reading the existing code.

> **Humans:** read [`README.md`](README.md), [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md),
> and [`docs/ROADMAP.md`](docs/ROADMAP.md) first. This file repeats some of
> that context for the benefit of agents that don't follow links well.

## Repository layout

```
cloudos/
  apps/
    desktop/          # SolidJS + Vite frontend (the "OS" UI you see)
    server/           # Go + Fiber + GORM backend
  packages/
    shared/           # cross-cutting TS types
  docs/               # architecture, API, roadmap, hosting guides
  .github/workflows/  # GitHub Actions CI
  AGENTS.md           # this file
  README.md
  turbo.json          # monorepo build orchestrator
  pnpm-workspace.yaml
```

## Running the project locally

```bash
# Once
pnpm install
( cd apps/server && go mod download )

# Backend
( cd apps/server && go run ./cmd/server )

# Frontend
pnpm --filter @cloudos/desktop dev
```

The frontend defaults to `http://localhost:4100` and the backend to
`:3000`. CORS is wired so the dev server proxies `/api/*` straight to
the backend.

## Common commands

| Task | Command |
| ---- | ------- |
| Build everything | `pnpm turbo build` |
| Run frontend tests | `pnpm --filter @cloudos/desktop test` |
| Run backend tests | `cd apps/server && go test ./...` |
| Lint frontend | `pnpm --filter @cloudos/desktop lint` (Biome) |
| Vet backend | `cd apps/server && go vet ./...` |

## Conventions

### Frontend (SolidJS)

- **Reactivity primitives:** `createSignal`, `createMemo`, `createEffect`,
  `createStore` — never React's `useState`. Solid's signals are the
  source of truth for UI state.
- **State:** prefer module-level signals/stores in `apps/desktop/src/stores/`.
  All persisted state lives in `localStorage` with the prefix
  `cloudos:` (e.g. `cloudos:vfs`, `cloudos:ai:conversations`).
- **VFS:** the in-browser virtual filesystem in
  `apps/desktop/src/vfs/vfs.ts`. Operations:
  `getEntry`, `listDir`, `writeFile`, `createFile`, `createDir`,
  `moveEntry`, `renameEntry`, `deleteEntry`, `vfsStats`,
  `exportSnapshot`. Mutating ops trigger `notifyFs()` and may throw
  `VFSQuotaExceededError`.
- **Slash commands:** the AI Assistant supports a rule-based slash
  command layer in `apps/desktop/src/stores/ai-tools.ts`. Mutating
  commands (`/write`, `/mkdir`, `/rm`, `/mv`) go through a
  `ConfirmationPayload` Run / Cancel gate; never bypass it.
- **LLM tool-calling:** the same registry is exposed to LLMs via
  `getToolsSchema()` + `runTool()`. See
  [`docs/ASSISTANT_TOOLS.md`](docs/ASSISTANT_TOOLS.md). When you add
  new tools, factor a `prepare<Verb>` helper for any mutating tool
  so the slash command and the typed tool runtime share the same
  validation logic.
- **Styling:** Tailwind CSS utility classes plus theme tokens
  (`bg-os-surface`, `text-os-text`, `border-os-border`, `text-os-accent`,
  `bg-os-danger`, etc.). See [`docs/THEMING.md`](docs/THEMING.md).
- **Permissions:** apps declare permissions in their manifest; runtime
  prompts in `apps/desktop/src/core/permissions.ts` and
  `apps/desktop/src/shell/PermissionPrompt.tsx`.

### Backend (Go + Fiber + GORM)

- **Layout:** `cmd/server/main.go` for the entrypoint;
  `internal/config`, `internal/database`, `internal/handlers`,
  `internal/middleware`, `internal/models`, `internal/services` for
  the rest. Exported names live in `internal/...` because the binary
  is the only consumer.
- **Auth:** JWT bearer tokens. `internal/middleware/auth.go` rejects
  protected routes without a valid token. Keep handlers free of
  password / token comparisons — defer to the middleware + services.
- **Tests:** prefer table-driven tests with `t.Setenv` for anything
  reading env vars; never write to the parent process environment.
  Use `t.Run` to give subtests names that show up in CI output.
- **Errors:** propagate up to the handler, then translate to an
  HTTP status with a JSON `{"error": "..."}` body. Don't `log.Fatal`
  inside handlers.

## Pull request rules

These are mirrored in the project's `git` workflow scripts but bear
repeating because some agents over-eagerly amend or force-push:

- **Never** force-push `main` or any branch you don't own.
- **Never** amend commits that have been pushed.
- **Never** skip git hooks (`--no-verify`, `--no-gpg-sign`).
- Open one PR per feature; small, reviewable changes preferred.
- CI must be green before merge: Frontend (build + test), Backend
  (build + vet + test), and Docker images on merges to `main`.
- The Biome lint baseline is large and not your responsibility to
  fix — only ensure your diff doesn't add **net new** errors. Run
  `pnpm --filter @cloudos/desktop lint` before pushing.
- Every dangerous mutation (VFS write, delete, move) flows through
  the `ConfirmationPayload` gate. Don't add a code path that bypasses
  it without an explicit user-facing setting (`dangerousAlwaysAllow`).

## Things to avoid

- **Don't** introduce React-isms (`useState`, JSX hooks). This is Solid.
- **Don't** add TypeScript `any` or `as any` to silence the compiler.
  If you need a structural type, define an `interface` or `type`.
- **Don't** commit secrets. `apps/server/.env` and similar are in
  `.gitignore`. The frontend never holds server secrets — only the
  user's API keys, in `localStorage`.
- **Don't** modify generated files (`apps/desktop/dist/`, Go binaries).
  They are CI-only artefacts.
- **Don't** depend on browser-only APIs in code that the test suite
  imports without checking — guard with `typeof window === "undefined"`
  if you must, or move the side effect into a function called at
  runtime.

## Useful entry points by feature

| Feature | Look at |
| ------- | ------- |
| AI Assistant | `apps/desktop/src/apps/AIAssistant.tsx`, `apps/desktop/src/stores/ai-{store,tools,provider-presets}.ts`, `docs/ASSISTANT_TOOLS.md` |
| File Manager + VFS | `apps/desktop/src/apps/FileManager.tsx`, `apps/desktop/src/vfs/*.ts` |
| Window manager / desktop shell | `apps/desktop/src/shell/*.tsx`, `apps/desktop/src/stores/desktop-store.ts` |
| Auth (frontend) | `apps/desktop/src/stores/auth-store.ts`, `apps/desktop/src/login/Login.tsx` |
| HTTP API | `apps/server/internal/handlers/*.go`, `docs/API.md` |
| Sharing / permissions | `apps/server/internal/handlers/shares.go`, `apps/desktop/src/stores/share-store.ts` |
| Theming | `docs/THEMING.md`, `apps/desktop/src/stores/theme-store.ts` |
| Self-hosting / Docker | `docs/SELF_HOSTING.md`, `docs/OLLAMA_HOSTING.md`, `apps/*/Dockerfile` |
