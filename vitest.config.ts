import { defineConfig } from 'vitest/config';

// Unit tests only. Playwright owns tests/*.spec.ts (run with `npx playwright test`).
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'supabase/functions/**/*.test.ts'],
  },
});
