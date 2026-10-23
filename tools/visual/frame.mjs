/**
 * Un fotogramma solo, a dimensione piena, di una clip a un dato istante.
 *
 * I provini piccoli di `moves.mjs` servono a confrontare; questo serve a
 * capire. Più di una volta ho letto male un dettaglio da un'immagine
 * rimpicciolita — un braccio che sembrava dentro l'inquadratura e invece
 * usciva — e l'unico rimedio è stato guardarne una grande.
 *
 * Uso: node tools/visual/frame.mjs [url] [clip] [secondi] [file.png]
 */
import { launch, openApp, stripForPosing, DEFAULT_URL } from './browser.mjs';

const url = process.argv[2] ?? DEFAULT_URL;
const clip = process.argv[3] ?? 'ClassicWeighing';
const seconds = Number(process.argv[4] ?? '1.8');
const shot = process.argv[5] ?? `tools/visual/out/${clip}.png`;

const browser = await launch();
const { page } = await openApp(browser, url, { width: 393, height: 852 });
await stripForPosing(page);

const duration = await page.evaluate((c) => window.sixSeven.animations.duration(c), clip);
if (duration === 0) {
  console.error(`clip "${clip}" non presente nel modello`);
  await browser.close();
  process.exit(1);
}
await page.evaluate(([c, t]) => window.sixSeven.animations.seek(c, Number(t)), [clip, seconds]);
await page.locator('.stage-wrap').screenshot({ path: shot });
console.log(`${clip} a ${seconds}s di ${duration.toFixed(2)}s -> ${shot}`);
await browser.close();
