/**
 * URL delle risorse statiche, con l'impronta del contenuto come query.
 *
 * Tutto ciò che l'applicazione carica a runtime da `public/` passa di qui.
 * Vite mette l'impronta nel nome di JS e CSS, ma i file in `public/` li copia
 * con il nome originale: senza `?v=` un browser che ha già in cache l'avatar
 * continua a servire quello vecchio dopo un rilascio che lo cambia.
 *
 * La mappa delle impronte è iniettata in fase di build dal plugin in
 * `vite.config.ts`; qui si legge soltanto.
 */

declare const __ASSET_HASHES__: Record<string, string>;

/**
 * @param path percorso servito, relativo alla radice del sito e senza barra
 *   iniziale — per esempio `assets/avatar.glb`.
 */
export function assetUrl(path: string): string {
  const url = `${import.meta.env.BASE_URL}${path}`;
  // Il controllo su `typeof` serve fuori dalla build di Vite — un test che
  // importasse questo modulo in Node non avrebbe la costante definita. Meglio
  // un'URL senza versione che un errore in fase di caricamento.
  const version = typeof __ASSET_HASHES__ === 'undefined' ? undefined : __ASSET_HASHES__[path];
  return version ? `${url}?v=${version}` : url;
}
