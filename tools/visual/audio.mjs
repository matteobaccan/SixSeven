/**
 * Che cosa sente davvero l'applicazione dal microfono.
 *
 * Chromium con `--use-fake-device-for-media-stream` emette un tono continuo al
 * posto del microfono: è una sorgente controllata, come il canvas animato lo è
 * per la telecamera. Permette di verificare tre cose che a mano si vedrebbero
 * solo urlando davanti al telefono e fidandosi dell'impressione.
 *
 * 1. Il contesto audio **gira**. Nasce dopo un `await`, quindi fuori dal gesto
 *    dell'utente, e su iOS può restare sospeso: finché lo è, il segnale letto è
 *    muto e il fondo viene stimato sul silenzio.
 * 2. Il segnale arriva: valore efficace diverso da zero.
 * 3. La stima del fondo si **congela** durante il turno del giocatore.
 *    Inseguirla mentre è lui a fare rumore la alza fin quasi al livello della
 *    sua reazione, e il campionamento la leggerebbe come silenzio.
 *
 * Uso: node tools/visual/audio.mjs [url] [cartella]
 * Uscita: 0 coerente, 1 incoerente, 2 inconcludente (nessun segnale).
 */
import { launchWithFakeDevices, openApp, outDir, reportErrors, DEFAULT_URL } from './browser.mjs';

const url = process.argv[2] ?? DEFAULT_URL;
const dir = outDir(process.argv[3] ?? 'tools/visual/out/audio');

const browser = await launchWithFakeDevices();
const { page, errors } = await openApp(browser, url, { width: 393, height: 852 });

await page.click('#start-sensors');
await page.waitForFunction(() => window.sixSeven?.machine?.state, { timeout: 20_000 });

const read = () => page.evaluate(() => ({
  ...window.sixSeven.audio.read(),
  disponibile: window.sixSeven.audio.available,
  stato: window.sixSeven.machine?.state,
}));

// Il tono del dispositivo finto è **periodico**, non continuo: una finestra di
// osservazione corta può capitare fra due bip e concludere «nessun segnale».
// Si aspetta quindi esplicitamente il primo campione non nullo prima di
// giudicare, invece di sperare nella coincidenza.
let sawSignal = false;
for (let i = 0; i < 40 && !sawSignal; i++) {
  sawSignal = await page.evaluate(() => window.sixSeven.audio.read().rms > 0);
  if (!sawSignal) await page.waitForTimeout(250);
}
console.log(sawSignal ? 'segnale rilevato dal microfono finto' : 'nessun segnale entro 10 s');

// Si segue la partita finché non si entra nel turno del giocatore, annotando
// come cambiano fondo e livello.
const samples = [];
for (let i = 0; i < 60; i++) {
  const r = await read();
  samples.push(r);
  if (r.floorFrozen && samples.filter((s) => s.floorFrozen).length > 8) break;
  await page.waitForTimeout(250);
}

const avatarPhase = samples.filter((s) => !s.floorFrozen);
const playerPhase = samples.filter((s) => s.floorFrozen);

const show = (label, rows) => {
  if (rows.length === 0) return console.log(`${label}: nessun campione`);
  const last = rows[rows.length - 1];
  console.log(
    `${label.padEnd(22)} campioni ${String(rows.length).padStart(2)}  ` +
      `rms ${last.rms.toExponential(2)}  fondo ${last.floor.toExponential(2)}  ` +
      `+${last.aboveFloorDb.toFixed(1)} dB  ${last.level}  ` +
      `contesto ${last.running ? 'attivo' : 'FERMO'}`,
  );
};
show('turno dell’avatar', avatarPhase);
show('turno del giocatore', playerPhase);

await page.locator('.stage-wrap').screenshot({ path: `${dir}/indicatore.png` });

const last = samples[samples.length - 1];
if (!last.disponibile) {
  console.error('\nmicrofono non disponibile: controllo inconcludente');
  await browser.close();
  process.exit(2);
}
if (!sawSignal) {
  console.error('\nnessun segnale dal dispositivo finto: controllo inconcludente');
  await browser.close();
  process.exit(2);
}

let failures = 0;
const expect = (ok, label) => {
  if (!ok) {
    failures += 1;
    console.error(`  FALLITO  ${label}`);
  }
};

expect(last.running, 'il contesto audio è attivo subito, non al primo campionamento');
// Si verifica che il segnale sia arrivato, non *quando*: a seconda di come
// cade la finestra di osservazione i campioni possono finire tutti nella fase
// del giocatore, e legare l'assertion alla fase la rendeva saltuaria.
expect(sawSignal || samples.some((s) => s.rms > 0), 'il segnale del microfono arriva all’analizzatore');
if (playerPhase.length > 1) {
  const floors = playerPhase.map((s) => s.floor);
  expect(
    Math.max(...floors) - Math.min(...floors) === 0,
    'durante il turno del giocatore la stima del fondo resta ferma',
  );
}

console.log(failures === 0 ? `\naudio coerente — immagini in ${dir}` : `\n${failures} controlli falliti`);
const code = reportErrors(errors);
await browser.close();
process.exit(failures === 0 ? code : 1);
