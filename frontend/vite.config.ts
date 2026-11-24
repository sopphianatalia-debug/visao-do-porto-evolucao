import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    server: {
      host: '127.0.0.1',
      strictPort: true,
      proxy: {
        '/api/epi/incident': { target: env.EPI_INCIDENT_TARGET || 'http://127.0.0.1:8004', changeOrigin: true, ws: true, rewrite: p => p.replace(/^\/api\/epi\/incident/, '/api/v1') },
        '/api/epi/auth': { target: env.EPI_AUTH_TARGET || 'http://127.0.0.1:8006', changeOrigin: true, rewrite: p => p.replace(/^\/api\/epi\/auth/, '/api/v1') },
        '/api/epi/fusion': { target: env.EPI_FUSION_TARGET || 'http://127.0.0.1:8002', changeOrigin: true, ws: true, rewrite: p => p.replace(/^\/api\/epi\/fusion/, '/api/v1') },
        '/api/epi/tracker': { target: env.EPI_TRACKER_TARGET || 'http://127.0.0.1:8010', changeOrigin: true, rewrite: p => p.replace(/^\/api\/epi\/tracker/, '/api/v1') },
        '/api/v1/vision': { target: env.VISION_API_TARGET || 'http://127.0.0.1:8100', changeOrigin: true },
      },
    },
  }
})
