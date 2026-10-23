/**
 * Pose chiave di ogni mossa, per il confronto a occhio.
 *
 * Serve a rispondere alla domanda «si distinguono fra loro?». È così che si è
 * visto che tre mosse su cinque leggevano uguali: i gesti avvenivano
 * all'altezza della pancia e le mani restavano al bordo inferiore.
 *
 * Campiona fra il 10% e il 90% della clip: gli estremi sono la posa di riposo,
 * uguale per tutte, e non dicono niente.
 *
 * Uso: node tools/visual/moves.mjs [url] [cartella]
 */
import { launch, openApp, stripForPosing, outDir, DEFAULT_URL } from './browser.mjs';

const url = process.argv[2] ?? DEFAULT_URL;
const dir = outDir(process.argv[3] ?? 'tools/visual/out/moves');
const SHOTS = 6;

const browser = await launch();
const { page } = await openApp(browser, url, { width: 393, height: 852 });
await stripForPosing(page);

// Le mosse si leggono dal catalogo dell'applicazione: aggiungerne una non
// richiede di toccare questo script, e le reazioni restano fuori.
const moves = await page.evaluate(() =>
  window.sixSeven.catalog.moves
    .filter((m) => m.clip && window.sixSeven.animations.duration(m.clip) > 0)
    .map((m) => [m.clip, window.sixSeven.animations.duration(m.clip), m.id]),
);

const stage = page.locator('.stage-wrap');
for (const [clip, duration, id] of moves) {
  for (let i = 0; i < SHOTS; i++) {
    const t = duration * (0.1 + (0.8 * i) / (SHOTS - 1));
    await page.evaluate(([c, time]) => window.sixSeven.animations.seek(c, time), [clip, t]);
    await stage.screenshot({ path: `${dir}/${id}-${clip}-${i}.png` });
  }
  console.log(`${id}  ${clip.padEnd(18)} ${duration.toFixed(2)}s  ${SHOTS} pose`);
}
console.log(`\nimmagini in ${dir}`);
await browser.close();
