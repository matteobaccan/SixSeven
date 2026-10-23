/**
 * Parti condivise degli script di verifica visiva.
 *
 * Perché esistono: `check:game` e `check:naming` provano la logica senza
 * browser, ma le cose che si sono rotte davvero in questo progetto — l'avatar
 * tagliato ai lati sul telefono, l'aura invisibile per via della fusione
 * additiva, la UI che non partiva per un `id` mancante nell'HTML — passano
 * tutte per un browser vero. Questi script sono il modo per vederle.
 */
import { chromium } from 'playwright';
import { mkdirSync, rmSync } from 'node:fs';

export const DEFAULT_URL = 'http://localhost:4173';

/**
 * Rendering software: su una macchina senza GPU — un container, una sessione
 * remota — senza questi argomenti WebGL non parte affatto.
 */
const SOFTWARE_GL = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];

/** Telecamera e microfono finti, già concessi senza chiedere permessi. */
const FAKE_DEVICES = ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'];

/**
 * `CHROMIUM_PATH` permette di usare un browser già presente sulla macchina
 * invece di quello che Playwright si scarica da sé. Serve negli ambienti che
 * ne hanno già uno — tipicamente un container predisposto — e dove scaricarne
 * un altro è sprecato o vietato:
 *
 *   CHROMIUM_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome \
 *     node tools/visual/smoke.mjs
 */
function options(extraArgs = []) {
  const executablePath = process.env.CHROMIUM_PATH;
  return {
    args: [...extraArgs, ...SOFTWARE_GL],
    ...(executablePath ? { executablePath } : {}),
  };
}

export async function launch() {
  return chromium.launch(options());
}

export async function launchWithFakeDevices() {
  return chromium.launch(options(FAKE_DEVICES));
}

/**
 * Apre la pagina e aspetta che l'avatar sia caricato, cioè che compaia la
 * schermata iniziale. Raccoglie anche gli errori di console: un errore a
 * runtime qui è esattamente ciò che la build non vede.
 */
export async function openApp(browser, url, viewport = { width: 393, height: 852 }) {
  const page = await browser.newPage({ viewport });
  const errors = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForSelector('#start:not(.is-hidden)', { timeout: 60_000 });
  return { page, errors };
}

/**
 * Nasconde le sovrapposizioni e ferma i micro-movimenti continui: serve a
 * fotografare una posa precisa invece di un fotogramma a caso del respiro.
 */
export async function stripForPosing(page) {
  await page.evaluate(() => {
    document.getElementById('fps').style.display = 'none';
    document.getElementById('start').classList.add('is-hidden');
    document.getElementById('banner').classList.add('is-hidden');
    window.sixSeven.life.enabled = false;
  });
}

/** Cartella di uscita, svuotata a ogni giro. */
export function outDir(path) {
  rmSync(path, { recursive: true, force: true });
  mkdirSync(path, { recursive: true });
  return path;
}

/** Esce con 1 se ci sono errori: così lo script serve anche come controllo. */
export function reportErrors(errors) {
  if (errors.length === 0) {
    console.log('nessun errore in console');
    return 0;
  }
  console.error(`ERRORI IN CONSOLE:\n${errors.join('\n')}`);
  return 1;
}
