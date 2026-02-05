import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts'],
  format: 'cjs',
  outDir: 'dist',
  clean: true,
  dts: false,
  platform: 'node',
  target: 'node18',
  minify: {
    compress: {
      dropConsole: true,
    },
  },
  external: ['vscode'],
  noExternal: ['cos-nodejs-sdk-v5', 'reactive-vscode'],
})
