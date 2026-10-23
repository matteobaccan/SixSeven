/**
 * Inquadratura e ingombro del pannello alle misure dei dispositivi reali.
 *
 * È lo script che ha trovato l'avatar tagliato ai lati: il caso peggiore non è
 * il telefono, è il **browser dentro un'app**, che toglie spazio sopra e sotto
 * e porta il rapporto della scena vicino al quadrato. Le altezze qui sotto
 * sono lo spazio *utile* alla pagina, non quello dello schermo.
 *
 * Uso: node tools/visual/viewport.mjs [url] [cartella]
 */
import { launch, openApp, stripForPosing, outDir, DEFAULT_URL } from './browser.mjs';

const url = process.argv[2] ?? DEFAULT_URL;
const dir = outDir(process.argv[3] ?? 'tools/visual/out/viewport');

const SIZES = [
  ['telefono-browser-intero', 393, 852],
  ['telefono-dentro-app', 393, 650],
  ['telefono-dentro-app-stretto', 393, 580],
  ['tablet', 834, 1112],
];

const browser = await launch();
for (const [name, width, height] of SIZES) {
  const { page } = await openApp(browser, url, { width, height });
  await stripForPosing(page);
  // Una posa con le braccia alzate: è lì che le spalle uscivano dal campo.
  await page.evaluate(() => {
    const a = window.sixSeven.animations;
    a.seek('ClassicWeighing', a.duration('ClassicWeighing') * 0.45);
  });
  const box = await page.evaluate(() => {
    const stage = document.getElementById('stage');
    const panel = document.querySelector('.panel');
    return {
      stage: [stage.clientWidth, stage.clientHeight],
      panel: Math.round(panel.getBoundingClientRect().height),
    };
  });
  const aspect = (box.stage[0] / box.stage[1]).toFixed(2);
  console.log(
    `${name.padEnd(30)} pagina ${width}x${height}  scena ${box.stage[0]}x${box.stage[1]} (rapporto ${aspect})  pannello ${box.panel}px`,
  );
  await page.screenshot({ path: `${dir}/${name}.png` });
  await page.close();
}
console.log(`\nimmagini in ${dir}`);
await browser.close();
