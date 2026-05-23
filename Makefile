.PHONY: install build test lint typecheck dev clean

install:
	pnpm install

build:
	pnpm run build

test:
	pnpm run test

lint:
	pnpm run lint

typecheck:
	pnpm run typecheck

dev:
	pnpm run dev

clean:
	rm -rf dist node_modules
