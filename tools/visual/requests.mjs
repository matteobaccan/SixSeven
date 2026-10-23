/**
 * Le risorse statiche escono con la query di versione.
 *
 * Non basta guardare il bundle: l'URL si compone a runtime, quindi la prova
 * sta nelle richieste di rete. Senza `?v=` un browser che ha in cache il
 * vecchio avatar continua a servirlo dopo un rilascio che lo cambia, e il
 * gioco mostra le animazioni di ieri senza che niente sembri rotto.
 *
 * Uso: node tools/visual/requests.mjs [url]
 */
import { launch, openApp, DEFAULT_URL } from './browser.mjs';

const url = process.argv[2] ?? DEFAULT_URL;
const browser = await launch();
const seen = [];

const { page } = await openApp(browser, url);
page.on('response', (r) => {
  if (/\.(glb|png)(\?|$)/.test(r.url())) seen.push(r);
});
await page.reload({ waitUntil: 'networkidle' });

let missing = 0;
for (const r of seen) {
  const path = r.url().replace(/^https?:\/\/[^/]+/, '');
  const versioned = /\?v=[0-9a-f]+$/.test(path);
  if (!versioned) missing += 1;
  console.log(`${r.status()}  ${versioned ? 'ok ' : 'SENZA VERSIONE '} ${path}`);
}
if (seen.length === 0) {
  console.error('nessuna risorsa binaria richiesta: controllo inconcludente');
  missing = 1;
}
console.log(missing === 0 ? '\ntutte versionate' : `\n${missing} risorse senza versione`);
await browser.close();
process.exit(missing === 0 ? 0 : 1);
