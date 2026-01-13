import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { nodePolyfills } from 'vite-plugin-node-polyfills'
import { resolve } from 'path'

export default defineConfig({
  plugins: [nodePolyfills(), react()],
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
    'process.env': JSON.stringify({})
  },
  build: {
    outDir: './dist',
    emptyOutDir: true,
    lib: {
      entry: resolve(__dirname, 'index.tsx'),
      name: 'PrivyIsland',
      fileName: 'privy-island',
      formats: ['iife']
    },
    rollupOptions: {
      output: {
        extend: true
      }
    }
  }
})
