import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    include: ['tests/int/**/*.int.spec.ts'],
    // Base de datos aparte: las pruebas nunca tocan la de desarrollo ni la de producción.
    env: { DATABASE_URL: 'file:./tests/.cmc-test.db', UPLOADS_DIR: './tests/.uploads', S3_BUCKET: '', SMTP_HOST: '' },
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 120_000,
  },
})
