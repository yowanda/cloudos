# GitHub Actions workflows

Both `ci.yml.disabled` and `release.yml.disabled` are ready to use — they are
checked in with `.disabled` suffixes only because the PAT used to commit them
did not have GitHub's `workflow` token scope (which is required to push files
under `.github/workflows/`).

To enable them in your fork:

1. **GitHub web UI**: open each file, click "rename", drop the `.disabled`
   suffix, commit. (Web UI commits use your account directly, not a PAT, so
   they bypass the scope rule.)
2. **CLI** (only if your local PAT has `workflow` scope):

   ```bash
   cd .github/workflows
   git mv ci.yml.disabled ci.yml
   git mv release.yml.disabled release.yml
   git commit -m "ci: enable workflows"
   git push
   ```

## What the workflows do

- **ci.yml** — on every push and PR, builds the SolidJS frontend (`pnpm turbo
  build`) and the Go backend (`go vet ./... && go build ./...`); on `main`,
  also builds both Docker images via Buildx (no push, just verification).
- **release.yml** — triggered by `v*.*.*` tags; builds and pushes Docker
  images to `ghcr.io/<owner>/cloudos-{server,desktop}` (with `:latest` and
  `:vX.Y.Z` tags) and creates a GitHub Release with an auto-generated
  changelog.
