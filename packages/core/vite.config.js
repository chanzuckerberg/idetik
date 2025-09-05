/// <reference types="vitest" />
import { defineConfig } from 'vite';
import eslint from 'vite-plugin-eslint';
import glsl from 'vite-plugin-glsl';
import path from 'path';
import react from "@vitejs/plugin-react";
import typescript from '@rollup/plugin-typescript';
import injectExamplesNavigation from './vite-plugin-examples-nav.js';

// __dirname is not available in ES6 modules
// https://github.com/vitejs/vite/issues/6946#issuecomment-1041506056
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readdirSync, existsSync } from 'node:fs'
const _dirname = dirname(fileURLToPath(import.meta.url));

// Dynamic example discovery
function getExampleInputs() {
  const examplesDir = path.resolve(_dirname, 'examples');
  const entries = readdirSync(examplesDir, { withFileTypes: true });
  
  const inputs = {
    main: path.resolve(_dirname, 'examples/index.html'),
  };
  
  const ignoreDirs = new Set(['dist', 'node_modules', '.git']);
  
  entries
    .filter(entry => entry.isDirectory() && !ignoreDirs.has(entry.name))
    .forEach(entry => {
      const examplePath = path.resolve(examplesDir, entry.name, 'index.html');
      if (existsSync(examplePath)) {
        inputs[entry.name] = examplePath;
      }
    });
  
  return inputs;
}

function getPlugins(mode) {
  const basePlugins = [eslint(), glsl(), react()];
  
  if (mode === 'examples') {
    // For examples mode, we don't need TypeScript compilation since it's handled by Vite
    // Add navigation plugin for examples
    return [...basePlugins, injectExamplesNavigation()];
  } else if (mode === 'development') {
    // For development mode (examples), include navigation plugin but keep TypeScript
    return [
      typescript({
        noForceEmit: true,
        compilerOptions: {
          noEmit: true,
        },
      }),
      ...basePlugins,
      injectExamplesNavigation(),
    ];
  } else {
    // For library mode, include TypeScript plugin
    return [
      typescript({
        noForceEmit: true,
        compilerOptions: {
          noEmit: true,
        },
      }),
      ...basePlugins,
    ];
  }
}
const MODES = ['development', 'production', 'test', 'examples'];

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
    plugins: getPlugins(mode),
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
        rollupOptions: {
          input: getExampleInputs(),
        },
        // Copy manifest file
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
