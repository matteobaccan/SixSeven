/**
 * Partita vera nel browser, con telecamera e microfono finti.
 *
 * È il controllo che prende gli errori che la build non vede: la UI che non
 * parte per un `id` mancante nell'HTML è passata di qui, non dal typecheck.
 *
 * Uso: node tools/visual/smoke.mjs [url] [file.png]
 */
import { launchWithFakeDevices, openApp, reportErrors, DEFAULT_URL } from './browser.mjs';

const url = process.argv[2] ?? DEFAULT_URL;
const shot = process.argv[3] ?? 'tools/visual/out/partita.png';

const browser = await launchWithFakeDevices();
const { page, errors } = await openApp(browser, url, { width: 393, height: 852 });
console.log('schermata iniziale mostrata');

await page.click('#start-sensors');
await page.waitForFunction(() => window.sixSeven?.machine?.state, { timeout: 20_000 });

const seen = new Set();
let turns = 0;
for (let i = 0; i < 120; i++) {
  const s = await page.evaluate(() => ({
    state: window.sixSeven?.machine?.state,
    turn: window.sixSeven?.machine?.turn,
    aura: window.sixSeven?.machine?.auraValue,
  }));
  if (s.state) seen.add(s.state);
  turns = s.turn ?? 0;
  // Si fotografa a metà del primo turno del giocatore, quando l'interfaccia
  // mostra tutto insieme: aura, nome della mossa, anteprima della telecamera.
  if (i === 12) await page.screenshot({ path: shot });
  if (turns >= 2) break;
  await page.waitForTimeout(500);
}

console.log(`stati attraversati: ${[...seen].join(' -> ')}`);
console.log(`turni completati: ${turns}`);
const code = reportErrors(errors);
await browser.close();
process.exit(code || (turns >= 2 ? 0 : 1));
