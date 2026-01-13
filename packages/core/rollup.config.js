// rollup.config.js
import dts from 'rollup-plugin-dts';

export default {
  input: 'dist/types/src/index.d.ts',
  output: {
    file: 'dist/index.d.ts',
    format: 'es',
  },
  plugins: [dts({
    compilerOptions: {
      baseUrl: 'dist/types/src',
    },
  })],
  onwarn(warning) {
    throw new Error(warning.message);
  },
};
