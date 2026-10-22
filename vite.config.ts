import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, posix, relative, sep } from 'node:path';
import { defineConfig } from 'vite';

const PUBLIC_DIR = 'public';

/**
 * Impronta del contenuto di ogni file in `public/`, da appendere alle URL come
 * `?v=`.
 *
 * Vite rinomina JS e CSS mettendo l'impronta nel nome del file, ma i file in
 * `public/` li copia tali e quali: senza una query, un browser che ha in cache
 * il vecchio `avatar.glb` continua a servirlo dopo un rilascio che lo cambia —
 * e il gioco mostra le animazioni di ieri senza che niente sembri rotto.
 *
 * L'impronta è del contenuto, non della data di build: cambia quando il file
 * cambia davvero, così un rilascio che non tocca l'avatar non costringe
 * nessuno a riscaricare un megabyte.
 *
 * Si calcola al caricamento della configurazione. In sviluppo questo significa
 * che rigenerando l'avatar a server acceso l'impronta resta quella vecchia
 * finché non si riavvia: in locale non è un problema, perché lì il ricaricamento
 * forzato è a portata di mano.
 */
function publicAssetHashes(dir: string): Record<string, string> {
  if (!existsSync(dir)) return {};
  const hashes: Record<string, string> = {};
  const walk = (current: string): void => {
    for (const entry of readdirSync(current)) {
      const full = join(current, entry);
      if (statSync(full).isDirectory()) walk(full);
      else {
        // La chiave è il percorso servito, con le barre del web anche su Windows.
        const key = relative(dir, full).split(sep).join(posix.sep);
        hashes[key] = createHash('sha256').update(readFileSync(full)).digest('hex').slice(0, 8);
      }
    }
  };
  walk(dir);
  return hashes;
}

export default defineConfig({
  base: './',
  server: { host: true },
  define: {
    __ASSET_HASHES__: JSON.stringify(publicAssetHashes(PUBLIC_DIR)),
  },
  build: {
    target: 'es2020',
    // three.js supera da solo la soglia predefinita: avvisare non aiuta.
    chunkSizeWarningLimit: 700,
    // Three.js finisce in un chunk separato: l'app si avvia senza attendere
    // il bundle di rendering completo (requisito non funzionale "prestazioni").
    rollupOptions: {
      output: {
        manualChunks: (id) => (id.includes('node_modules/three/') ? 'three' : undefined),
      },
    },
  },
});
