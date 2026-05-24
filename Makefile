.PHONY: help install dev build test test-watch lint lint-fix typecheck clean release release-patch release-minor release-major _release-bump

help: ## Show this help
	@grep -E '^[a-zA-Z0-9_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2}'

install: ## Install dependencies
	pnpm install

dev: ## Run the MCP server in dev mode (tsx, no build)
	pnpm run dev

build: ## Compile TypeScript to dist/
	pnpm run build

test: ## Run all tests (vitest)
	pnpm run test

test-watch: ## Run tests in watch mode
	pnpm run test:watch

lint: ## Run ESLint
	pnpm run lint

lint-fix: ## Run ESLint with auto-fix
	pnpm run lint -- --fix

typecheck: ## Type-check without emit
	pnpm run typecheck

clean: ## Remove build artifacts and node_modules
	rm -rf node_modules dist

# --- Release ---

release-patch: ## Bump by patch, commit, and tag
	@$(MAKE) _release-bump BUMP=patch

release-minor: ## Bump by minor, commit, and tag
	@$(MAKE) _release-bump BUMP=minor

release-major: ## Bump by major, commit, and tag
	@$(MAKE) _release-bump BUMP=major

release: ## Set explicit version (VERSION=x.y.z), commit, and tag
	@if [ -z "$(VERSION)" ]; then echo "Usage: make release VERSION=x.y.z" >&2; exit 1; fi
	@$(MAKE) _release-bump BUMP=$(VERSION)

_release-bump:
	@if [ -n "$$(git status --porcelain)" ]; then echo "Working tree is dirty. Commit or stash first." >&2; exit 1; fi
	npm version --no-git-tag-version $(BUMP)
	@NEW_VERSION="$$(node -p "require('./package.json').version")"; \
	node scripts/verify-release-versions.mjs "v$$NEW_VERSION"; \
	git add package.json; \
	git commit -m "chore(release): v$$NEW_VERSION"; \
	git tag -a "v$$NEW_VERSION" -m "v$$NEW_VERSION"; \
	echo ""; \
	echo "Tagged v$$NEW_VERSION."; \
	echo "Next:"; \
	echo "  1. git push --follow-tags"; \
	echo "  2. Create a GitHub Release for v$$NEW_VERSION at:"; \
	echo "     https://github.com/blueprint-chart/mcp/releases/new?tag=v$$NEW_VERSION"
