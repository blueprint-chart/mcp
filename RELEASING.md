# Releasing

`@blueprint-chart/mcp` ships as a single npm package. One tag, one version, one Release.

## Steps

1. From a clean `main` working tree, pick one:

   ```bash
   make release-patch          # 0.1.0 → 0.1.1
   make release-minor          # 0.1.0 → 0.2.0
   make release-major          # 0.1.0 → 1.0.0
   make release VERSION=0.4.2  # explicit
   ```

   This bumps `package.json`, creates the commit `chore(release): vX.Y.Z`, and tags `vX.Y.Z` locally.

2. Push:

   ```bash
   git push --follow-tags
   ```

3. On GitHub, create a Release for `vX.Y.Z`. Author the release notes. Publish.

4. The `Release` workflow runs automatically:
   - `verify` confirms `package.json` version matches the tag
   - `lint`, `test`, `build` run in parallel
   - `publish-npm` publishes with provenance via OIDC trusted publishing

## Dry run

Before a real release, dry-run the workflow:

GitHub → Actions → Release → **Run workflow** → leave `dry_run` checked, optionally specify a tag (defaults to current `package.json` version).

This validates the pack contents without publishing.

## Recovering from a failed release

| Failure | Recovery |
|---|---|
| `make release-*` aborted between version bump and commit (rare) | `git checkout package.json` to discard partial bumps, then retry |
| `verify` job fails | Edit drifted `package.json`, delete the tag locally and on GitHub, delete the Release, re-tag, re-create Release |
| `lint` / `test` / `build` job fails | Fix on `main`, delete the failed Release + tag, cut a fresh patch release |
| `publish-npm` failed | Inspect logs. NPM rejects republishing the same version — bump to the next patch and re-release |
| Bad release shipped | `npm deprecate @blueprint-chart/mcp@x.y.z "reason"` and ship a fix in the next version |
