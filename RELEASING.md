# Releasing

`@blueprint-chart/mcp` ships as a single npm package. One tag, one version, one Release.

## How releases happen

Releases are automatic. Push Conventional Commits to `main`:

- `fix:` → patch · `feat:` → minor · `feat!:` / `BREAKING CHANGE:` → major
- `docs:` / `chore:` / `test:` / `refactor:` / `ci:` → no release

When the `CI` workflow succeeds on `main`, the `Release` workflow runs semantic-release, which
computes the next version, writes `CHANGELOG.md`, publishes `@blueprint-chart/mcp` to npm with
provenance, creates the GitHub Release (notes editable afterward), tags `vX.Y.Z`, and commits
`chore(release): vX.Y.Z [skip ci]` back to `main`. No local commands, no GitHub UI.

The Railway server deploy is independent and continues to deploy on every push to `main`.

## Dry run

GitHub → Actions → Release → **Run workflow** → leave `dry_run` checked. semantic-release prints
the next version and notes and validates the pack without publishing or tagging.

## Recovering from a failed release

| Failure | Recovery |
|---|---|
| Publish failed mid-run | Fix forward with a `fix:` — the next green CI republishes; versions are never reused |
| Bad release shipped | `npm deprecate @blueprint-chart/mcp@x.y.z "reason"` and ship a `fix:` |
| Need a release the commits won't trigger | Land a `fix:`/`feat:`, or **Actions → Release → Run workflow** with `dry_run` off |
| Emergency manual release | `make release-*` + `git push --follow-tags` still work (see Makefile) |
