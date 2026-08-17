import { defineConfig } from 'vitest/config'

// `@/` is the app's own root, exactly as tsconfig `paths` declares it. A panel
// imports `@/lib/money`, so a test that renders one needs the same alias.
export default defineConfig({
  resolve: { alias: { '@': import.meta.dirname } },
})
