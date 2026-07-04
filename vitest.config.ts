import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    // mirror tsconfig "paths": { "@/*": ["./*"] } so tests can import like the app
    alias: [{ find: /^@\/(.*)$/, replacement: path.resolve(rootDir, '$1') }],
  },
  test: {
    environment: 'jsdom',
    globals: true,
  },
});
