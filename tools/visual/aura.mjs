/**
 * L'aura ai tre livelli, più la schermata di fine partita.
 *
 * Il primo tentativo usava la fusione additiva, giusta per qualcosa che
 * rappresenta luce su fondo scuro. Il fondo della scena è crema: sommare luce
 * su un fondo già chiaro satura verso il bianco, e l'alone era **invisibile**.
 * Nessun controllo headless lo avrebbe mai detto.
 *
 * Uso: node tools/visual/aura.mjs [url] [cartella]
 */
import { launchWithFakeDevices, openApp, outDir, reportErrors, DEFAULT_URL } from './browser.mjs';

const url = process.argv[2] ?? DEFAULT_URL;
const dir = outDir(process.argv[3] ?? 'tools/visual/out/aura');

const browser = await launchWithFakeDevices();
const { page, errors } = await openApp(browser, url, { width: 393, height: 852 });
await page.click('#start-sensors');
await page.waitForFunction(() => window.sixSeven?.machine?.state, { timeout: 20_000 });

for (const [name, ratio] of [['bassa', 0.05], ['media', 0.5], ['alta', 1]]) {
  await page.evaluate((r) => {
    window.sixSeven.halo.snap(r);
    window.sixSeven.ui.setAura(Math.round(r * 100));
  }, ratio);
  await page.waitForTimeout(350);
  await page.locator('.stage-wrap').screenshot({ path: `${dir}/${name}.png` });
}

await page.evaluate(() =>
  window.sixSeven.ui.showMatchOver('Hai vinto!', 'Aura azzerata: l’avatar non ha più niente da mostrare.'),
);
await page.waitForTimeout(250);
await page.locator('.stage-wrap').screenshot({ path: `${dir}/fine-partita.png` });

console.log(`immagini in ${dir}`);
const code = reportErrors(errors);
await browser.close();
process.exit(code);
