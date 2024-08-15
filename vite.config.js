import { defineConfig } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';
import eslint from 'vite-plugin-eslint';
import path from 'path';

const plugins = [tsconfigPaths(), eslint()];

export default defineConfig(({ mode }) => {
  if (mode === "lib") {
    return {
      plugins,
      build: {
        lib: {
          entry: path.resolve(__dirname, 'src/index.ts'),
          name: 'viz',
          fileName: (format) => `viz.${format}.js`,
        }
      },
    }
  } else {
    return {
      plugins,
      root: './examples',
      build: {
        outDir: 'dist',
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, 'src'),
        },
      },
      server: {
        watch: {
          include: path.resolve(__dirname, 'src/**'),
        },
      },
    };
  }
});