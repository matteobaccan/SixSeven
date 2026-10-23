/**
 * Rilevamento del movimento con una sorgente controllata.
 *
 * Al posto della telecamera si mette un canvas animato: una barra che scorre
 * su fondo scuro. Così si può pilotare esattamente quando c'è movimento e
 * quando no, e verificare che il rilevatore tari la quiete, dichiari l'inizio
 * del gesto e ne dichiari la fine. Con una telecamera vera non si saprebbe mai
 * se un mancato rilevamento è del codice o della stanza.
 *
 * Attenzione, due cose.
 *
 * Tocca campi privati di `PoseDetector` (`stream`, `callbacks`). È l'unico modo
 * per sostituire la sorgente senza aprire la classe solo per i test, ma vuol
 * dire che rinominare quei campi rompe questo script.
 *
 * E dipende da `canvas.captureStream()`, che non in tutti i browser headless
 * propaga davvero gli aggiornamenti del canvas al video: capita che il video
 * resti congelato sul primo fotogramma. In quel caso il rilevatore non ha
 * nulla da rilevare, e dire «fallito» sarebbe una falsa accusa — lo script
 * distingue il caso e esce con 2, che vuol dire inconcludente.
 *
 * Uso: node tools/visual/motion.mjs [url]
 * Uscita: 0 coerente, 1 rilevatore incoerente, 2 sorgente inutilizzabile.
 */
import { launch, openApp, DEFAULT_URL } from './browser.mjs';

const url = process.argv[2] ?? DEFAULT_URL;
const browser = await launch();
const { page } = await openApp(browser, url, { width: 393, height: 852 });

const phases = await page.evaluate(async () => {
  const pose = window.sixSeven.pose;
  if (!pose || typeof pose.start !== 'function') throw new Error('PoseDetector non esposto');

  const canvas = document.createElement('canvas');
  canvas.width = 320;
  canvas.height = 240;
  const ctx = canvas.getContext('2d');
  let moving = false;
  let x = 0;
  const draw = () => {
    ctx.fillStyle = '#202020';
    ctx.fillRect(0, 0, 320, 240);
    if (moving) {
      x = (x + 40) % 240;
      ctx.fillStyle = '#f0f0f0';
      ctx.fillRect(x, 20, 90, 200);
    }
    requestAnimationFrame(draw);
  };
  draw();

  const stream = canvas.captureStream(30);
  const video = pose.videoElement;
  video.srcObject = stream;
  await video.play();
  // Fa credere al rilevatore di avere una telecamera, senza chiedere permessi.
  pose.stream = stream;

  const events = [];
  // Si registra **ogni** valore prodotto dal rilevatore: leggere `pose.motion`
  // una volta a fine fase coglie un istante a caso, spesso fra due fotogrammi.
  const series = [];
  pose.callbacks.onMotion = (m) => series.push(m);
  pose.callbacks.onMovementStarted = () => events.push('started');
  pose.callbacks.onMovementSettled = () => events.push('settled');

  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const log = [];
  const mark = (fase, from) => {
    const slice = series.slice(from);
    log.push({
      fase,
      campioni: slice.length,
      picco: +Math.max(0, ...slice).toFixed(4),
      eventi: [...events],
    });
    return series.length;
  };

  pose.start();
  let cursor = 0;

  await wait(800);
  cursor = mark('quiete', cursor);

  moving = true;
  await wait(900);
  cursor = mark('movimento', cursor);

  moving = false;
  await wait(1800);
  mark('di nuovo fermo', cursor);

  pose.stop();
  return log;
});

for (const row of phases) console.log(JSON.stringify(row));

const [quiet, moved, settled] = phases;

// Prima di giudicare il rilevatore si controlla la sorgente: se durante la fase
// di movimento non è arrivato nessun campione sopra la quiete, è il video a non
// essersi aggiornato, non il rilevatore ad aver sbagliato.
if (moved.campioni === 0 || moved.picco <= quiet.picco) {
  console.error(
    '\nla sorgente sintetica non ha prodotto movimento: in questo browser ' +
      'captureStream() non aggiorna il video, e il controllo è inconcludente.',
  );
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

expect(quiet.eventi.length === 0, 'nella quiete non dichiara nessun movimento');
expect(moved.eventi.includes('started'), 'con la barra in moto dichiara l’inizio del gesto');
expect(settled.eventi.includes('settled'), 'tornando fermo dichiara finito il gesto');

console.log(failures === 0 ? '\nrilevamento coerente nelle tre fasi' : `\n${failures} controlli falliti`);
await browser.close();
process.exit(failures === 0 ? 0 : 1);
