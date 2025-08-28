/// <reference types="vitest" />
import { defineConfig } from 'vite';
import eslint from 'vite-plugin-eslint';
import glsl from 'vite-plugin-glsl';
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
  glsl(),
  react(),
];

const MODES = ['development', 'production', 'test'];

function modeToRoot(mode) {
  if (mode === 'development') {
    return 'examples';
  } else if (!MODES.includes(mode)) {
    console.error(`Unrecognized mode ${mode}`);
  }
  return undefined;
}

export default defineConfig(({ mode }) => {
  return {
    plugins,
    root: modeToRoot(mode),
    publicDir: path.resolve(_dirname, 'public'),
    build: {
      outDir: 'dist',
      // TODO: set these by build mode or something
      sourcemap: true,
      // minify: false,
      lib: {
        entry: path.resolve(_dirname, 'src/index.ts'),
        name: 'idetik-core',
        fileName: "index",
      },
    },
    resolve: {
      alias: {
        '@': path.resolve(_dirname, 'src'),
      },
    },
    server: {
      watch: {
        include: [
          path.resolve(_dirname, 'src/**'),
          path.resolve(_dirname, 'examples/**'),
        ],
      },
    },
    test: {
      environment: "jsdom",
      browser: {
        enabled: true,
        provider: "playwright",
        headless: true,
        instances: [
          {
            browser: "chromium",
          },
        ],
      },
      coverage: {
        provider: "istanbul",
        include: ["src/**"],
      },
    },
  }
});
