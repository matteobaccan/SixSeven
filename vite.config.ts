import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: { host: true },
  build: {
    target: 'es2020',
    // three.js supera da solo la soglia predefinita: avvisare non aiuta.
    chunkSizeWarningLimit: 700,
    // Three.js finisce in un chunk separato: l'app si avvia senza attendere
    // il bundle di rendering completo (requisito non funzionale "prestazioni").
    rollupOptions: {
      output: {
        manualChunks: { three: ['three'] },
      },
    },
  },
});
