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

function getPlugins(mode) {
  const basePlugins = [eslint(), glsl(), react()];
  if (mode === 'examples') {
    // For examples mode, we don't need TypeScript compilation since it's handled by Vite
    return basePlugins;
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
          input: {
            main: path.resolve(_dirname, 'examples/index.html'),
            // Add all example HTML files
            image2d_from_omezarr4d_hcs: path.resolve(_dirname, 'examples/image2d_from_omezarr4d_hcs/index.html'),
            image_series_from_omezarr5d_u8: path.resolve(_dirname, 'examples/image_series_from_omezarr5d_u8/index.html'),
            ome_zarr_v05: path.resolve(_dirname, 'examples/ome_zarr_v05/index.html'),
            image2d_from_omezarr5d_u16: path.resolve(_dirname, 'examples/image2d_from_omezarr5d_u16/index.html'),
            chunk_streaming: path.resolve(_dirname, 'examples/chunk_streaming/index.html'),
            projected_lines: path.resolve(_dirname, 'examples/projected_lines/index.html'),
            tracks: path.resolve(_dirname, 'examples/tracks/index.html'),
            layer_blending: path.resolve(_dirname, 'examples/layer_blending/index.html'),
            points: path.resolve(_dirname, 'examples/points/index.html'),
            image_mask_overlay: path.resolve(_dirname, 'examples/image_mask_overlay/index.html'),
            image_labels_overlay_with_value_picking: path.resolve(_dirname, 'examples/image_labels_overlay_with_value_picking/index.html'),
            image_series_labels_overlay: path.resolve(_dirname, 'examples/image_series_labels_overlay/index.html')
          }
        }
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
