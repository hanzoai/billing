# @hanzo/billing — the billing surface (Next.js). There is no `packageManager`
# field; the committed pnpm-lock.yaml is what makes pnpm the one package manager
# here. Targets call billing's own scripts wherever those scripts actually run.

PNPM ?= pnpm

.PHONY: help build test lint typecheck dev clean

help: ## Show this help.
	@awk 'BEGIN{FS=":.*##";printf "\nUsage: make <target>\n\nTargets:\n"} /^[a-zA-Z_-]+:.*##/{printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

build: node_modules ## Build the Next.js app (next build).
	$(PNPM) build

# billing ships NO tests — no `test` script, no spec files, no runner. The
# target exists because the fleet vocabulary promises it, and it exits 0 because
# nothing failed: a red exit would claim a suite ran and broke, which is the
# opposite lie. It says so on every run, so a green line here is never read as
# coverage. Delete this recipe the day the repo grows a real suite.
test: ## No test suite in this repo — says so, exits 0.
	@echo ">> billing has NO tests (no test script, no spec files). Green here is not coverage."

# Deliberately NOT the `lint` script: that one is literally `echo 'lint ok'` and
# passes unconditionally. `tsc --noEmit` is the only real static check billing
# has, so that is what the verb runs.
lint: typecheck ## Static check — alias for typecheck (the `lint` script is a no-op stub).

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
