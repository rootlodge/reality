import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'storage/index': 'src/storage/index.ts',
    'http/index': 'src/http/index.ts',
    'mesh/index': 'src/mesh/index.ts',
    'redis/index': 'src/redis/index.ts',
    'compat/index': 'src/compat/index.ts',
  },
  format: ['cjs', 'esm'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  treeshake: true,
  external: ['@rootlodge/reality'],
});
