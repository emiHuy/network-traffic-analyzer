import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],

  // ── Production build output ──────────────────────────────────────────────
  // Place the built assets into backend/static so FastAPI can serve them
  // directly from the same process on port 8000.
  //
  // DEV  workflow:  cd frontend && npm run dev         (port 5173, proxied to 8000)
  // PROD workflow:  cd frontend && npm run build
  //                 cd ..       && uvicorn main:app     (port 8000 serves everything)
  build: {
    outDir: '../backend/static',
    emptyOutDir: true,
  },

  // ── Dev-server proxy ─────────────────────────────────────────────────────
  // In dev mode the Vite server runs on :5173 while FastAPI runs on :8000.
  // Proxying /api (and other backend paths) avoids CORS issues entirely AND
  // means the same relative-URL assumptions that work in prod also work in
  // dev.  We keep the VITE_API_URL escape-hatch in client.js for the rare
  // case where the backend is on a remote host.
  server: {
    proxy: {
      '/sessions':  'http://localhost:8000',
      '/capture':   'http://localhost:8000',
      '/network':   'http://localhost:8000',
      '/ai':        'http://localhost:8000',
    },
  },
})
