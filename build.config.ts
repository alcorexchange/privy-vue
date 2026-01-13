import { defineBuildConfig } from 'unbuild'

export default defineBuildConfig({
  entries: ['./src/index'],
  declaration: true,
  clean: false,  // Don't clean - preserve privy-island.iife.js
  rollup: {
    emitCJS: true,
    esbuild: {
      minify: false
    }
  },
  externals: ['vue']
})
