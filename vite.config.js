import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The React app lives in /client. `npm run build` outputs to /dist, which the
// Node server serves. In dev, Vite proxies the Socket.IO connection to the server.
export default defineConfig({
  root: 'client',
  plugins: [react()],
  build: { outDir: '../dist', emptyOutDir: true },
  server: {
    host: true,
    port: 5173,
    proxy: { '/socket.io': { target: 'http://localhost:3000', ws: true } },
  },
});
