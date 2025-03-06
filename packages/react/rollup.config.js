// rollup.config.js
import dts from 'rollup-plugin-dts';

export default {
  input: 'dist/types/index.d.ts',
  external: [
    /.*\.css$/,
  ],
  output: {
    file: 'dist/index.d.ts',
    format: 'es',
  },
  plugins: [dts({
    compilerOptions: {
      baseUrl: 'dist/types',
    },
  })],
};
