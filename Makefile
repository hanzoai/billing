# @hanzo/billing — the billing surface (Next.js). package.json pins
# `packageManager: pnpm@10.33.4` and the committed pnpm-lock.yaml agrees, so pnpm
# is the one package manager here. Targets call billing's own scripts wherever
# those scripts actually run.

PNPM ?= pnpm

.PHONY: help build test lint typecheck dev clean

help: ## Show this help.
	@awk 'BEGIN{FS=":.*##";printf "\nUsage: make <target>\n\nTargets:\n"} /^[a-zA-Z_-]+:.*##/{printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

build: node_modules ## Build the Next.js app (next build).
	$(PNPM) build

test: node_modules ## Run the suite (vitest).
	$(PNPM) test

# Two real static checks, both required. `pnpm lint` is scripts/pci-scope.mjs —
# the SAQ-A boundary, scanned against the source AND the built bundle, so it
# needs `build` to have run or it refuses to pass on an empty scan. typecheck is
# tsc --noEmit. Neither subsumes the other: one asks whether a raw PAN can reach
# first-party JS, the other whether the types hold.
lint: typecheck ## Static checks — tsc --noEmit, then the PCI scope scan.
	$(PNPM) lint

typecheck: node_modules ## tsc --noEmit.
	$(PNPM) typecheck

dev: node_modules ## Dev server on :3005.
	$(PNPM) dev

node_modules: ## Install deps (pnpm install --frozen-lockfile).
	$(PNPM) install --frozen-lockfile

# Deliberately NOT `$(PNPM) clean`. That script is `rimraf .next out`, but rimraf
# is not a declared dependency and is not installed, so it dies with "rimraf: not
# found" — it has never run from a clean install. Same two paths, spelled a way
# that works. next-env.d.ts is excluded on purpose: it is TRACKED in this repo
# and tsconfig `include`s it, so deleting it would both dirty the tree and break
# typecheck. node_modules is never touched — dropping it is a reinstall.
clean: ## Remove build output (.next, out, *.tsbuildinfo).
	rm -rf .next out *.tsbuildinfo
