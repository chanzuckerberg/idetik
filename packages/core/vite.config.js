/// <reference types="vitest" />
import { defineConfig } from 'vite';
import eslint from 'vite-plugin-eslint';
import glsl from 'vite-plugin-glsl';
import path from 'path';
import react from "@vitejs/plugin-react";
import typescript from '@rollup/plugin-typescript';
import examplesManifestPlugin from './vite-plugin-examples-nav.js';

// __dirname is not available in ES6 modules
// https://github.com/vitejs/vite/issues/6946#issuecomment-1041506056
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
const _dirname = dirname(fileURLToPath(import.meta.url));

const MODES = ['development', 'production', 'test', 'examples'];

function modeToPlugins(mode) {
  const basePlugins = [eslint(), glsl(), react()];
  const typescriptPlugin = typescript({
    noForceEmit: true,
    compilerOptions: {
      noEmit: true,
    },
  });

  if (mode === 'examples') {
    // for examples mode, TypeScript compilation is handled by Vite's built-in esbuild
    return [...basePlugins, examplesManifestPlugin()];
  } else if (mode === 'development') {
    return [
      typescriptPlugin,
      ...basePlugins,
      examplesManifestPlugin(),
    ];
  } else if (!MODES.includes(mode)) {
    console.error(`Unrecognized mode ${mode}`);
  }

  return [
    typescriptPlugin,
    ...basePlugins,
  ];
}

function modeToRoot(mode) {
  if (mode === 'development' || mode === 'examples') {
    return 'examples';
  } else if (!MODES.includes(mode)) {
    console.error(`Unrecognized mode ${mode}`);
  }
  return undefined;
}

export default defineConfig(({ mode }) => {
  return {
    plugins: modeToPlugins(mode),
    root: modeToRoot(mode),
    publicDir: path.resolve(_dirname, 'public'),
    build: {
      outDir: 'dist',
      target: 'es2022',
      // TODO: set these by build mode or something
      sourcemap: true,
      minify: mode === 'production',
      ...(mode === 'examples' ? {
        // Build examples as a static site
        copyPublicDir: true
      } : {
        lib: {
          entry: path.resolve(_dirname, 'src/index.ts'),
          name: 'idetik-core',
          fileName: "index",
        },
      }),
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
