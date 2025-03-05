/// <reference types="vitest" />
import { defineConfig } from 'vite';
import eslint from 'vite-plugin-eslint';
import path from 'path';
import react from "@vitejs/plugin-react";
import tailwindcss from '@tailwindcss/vite'
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
  tailwindcss(),
];

export default defineConfig(() => {
  return {
    plugins,
    root: '.',
    publicDir: path.resolve(_dirname, 'public'),
    build: {
      outDir: 'dist',
      // TODO: set these by build mode or something
      sourcemap: true,
      // minify: false,
      lib: {
        entry: path.resolve(_dirname, 'src/index.ts'),
        name: 'idetik-react',
        fileName: "index",
        cssFileName: 'index.css',
      },
      rollupOptions: {
        external: [
          'react',
          'react/jsx-runtime',
          'react-dom',
          'react-dom/client',
        ],
        output: {
          globals: {
            'react': 'React',
            'react-dom': 'ReactDOM',
            'react/jsx-runtime': 'React.jsxRuntime',
            'react-dom/client': 'ReactDOM.client',
          },
          assetFileNames: 'index.[ext]',
        },
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
        ],
      },
    },
  }
});
