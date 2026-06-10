/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // @ts-expect-error - vitest types provide test config
  test: {
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/stateMachine.test.ts',
    ],
  },
})
