import { defineVitestConfig } from '@nuxt/test-utils/config'

export default defineVitestConfig({
  test: {
    environment: 'nuxt',
    environmentOptions: {
      nuxt: {
        mock: {
          intersectionObserver: true,
          indexedDb: true,
        },
      },
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: [
        'app/composables/**/*.ts',
        'app/stores/**/*.ts',
        'app/utils/**/*.ts',
      ],
      exclude: [
        'app/**/*.spec.ts',
        'app/**/*.test.ts',
        'node_modules/**',
      ],
    },
    globals: true,
    setupFiles: ['./test/setup.ts'],
  },
})
