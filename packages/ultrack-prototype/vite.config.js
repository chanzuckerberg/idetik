/// <reference types="vitest" />
import { defineConfig } from 'vite';
import eslint from 'vite-plugin-eslint';
import path from 'path';
import react from "@vitejs/plugin-react";
import typescript from '@rollup/plugin-typescript';

// __dirname is not available in ES6 modules
// https://github.com/vitejs/vite/issues/6946#issuecomment-1041506056
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
const _dirname = dirname(fileURLToPath(import.meta.url));

const plugins = [
  typescript({
    noForceEmit: true,
    compilerOptions: {
      noEmit: true,
    },
  }),
  eslint(),
  react(),
];

export default defineConfig(() => {
  return {
    plugins,
    root: "frontend",
    publicDir: path.resolve(_dirname, 'public'),
    build: {
      outDir: 'dist',
    },
    resolve: {
      alias: {
        '@': path.resolve(_dirname, 'src'),
      },
    },
    server: {
      watch: {
        include: [
          path.resolve(_dirname, 'frontend/**'),
        ],
      },
    },
  }
});
