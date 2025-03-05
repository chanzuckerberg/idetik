// rollup.config.js
import dts from 'rollup-plugin-dts';

export default {
  input: 'dist/types/src/index.d.ts', // Adjust the path to where your TypeScript emits .d.ts files
  output: {
    file: 'dist/index.d.ts',
    format: 'es',
  },
  plugins: [dts({
    compilerOptions: {
      baseUrl: 'dist/types/src',
    },
  })],
};
