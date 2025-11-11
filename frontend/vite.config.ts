import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const envDir = __dirname
  const env = loadEnv(mode, envDir, 'VITE_')
  const runtimeApiUrl = process.env.VITE_API_URL?.trim()
  const fileApiUrl = env.VITE_API_URL?.trim()
  const backendUrl = runtimeApiUrl || fileApiUrl || 'http://localhost:8000'

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    envDir,
    server: {
      host: true,
      port: 3000,
      proxy: {
        '/api': {
          target: backendUrl,
          changeOrigin: true,
        },
      },
    },
  }
})
