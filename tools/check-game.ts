/**
 * Verifica della macchina a stati dei turni.
 *
 * La macchina non dipende da Three.js, telecamera o microfono: si può quindi
 * pilotare da riga di comando con timer finti, ed è il modo più diretto per
 * controllare che i percorsi di riserva funzionino — quelli che a mano si
 * proverebbero solo staccando la webcam.
 *
 * Uso: npm run check:game
 */
import {
  DEFAULT_CONFIG,
  GameStateMachine,
  type GameState,
  type Intent,
  type TimerToken,
  type Timers,
} from '../src/game/GameStateMachine.ts';
import { entriesOfKind, getEntry, IDLE_ID } from '../src/assets/AssetCatalog.ts';
import { AURA_MAX, AURA_START, AURA_STEP, AuraMeter } from '../src/game/Aura.ts';

let failures = 0;

function expect(actual: unknown, expected: unknown, label: string): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    failures += 1;
    console.error(
      `  FALLITO  ${label}\n           atteso ${JSON.stringify(expected)}, ottenuto ${JSON.stringify(actual)}`,
    );
  }
}

/** Timer finti: registrano le richieste e scattano a comando. */
class FakeTimers implements Timers {
  readonly pending = new Map<TimerToken, number>();

  set(token: TimerToken, ms: number): void {
    this.pending.set(token, ms);
  }
  clear(token: TimerToken): void {
    this.pending.delete(token);
  }
  clearAll(): void {
    this.pending.clear();
  }
  has(token: TimerToken): boolean {
    return this.pending.has(token);
  }
}

const ALL_CLIPS = [
  'Idle',
  'ClassicWeighing',
  'ReverseWeighing',
  'FingerSixSeven',
  'Handshake67',
  'ExtremeSixSeven',
  'ToDiWorld',
  'SixFootSeven',
  'ThreePointer',
  'SixSevenKid',
  'WhatDoYouWant',
  'MindBlown',
  'Blessing',
  'Applause',
  'NotBad',
  'ArmsCrossed',
  'SixSevenFace',
  'Taunt',
  'Celebration',
  'Disappointed',
  'TurnTransition',
];

interface Harness {
  machine: GameStateMachine;
  timers: FakeTimers;
  intents: Intent[];
  played: string[];
  states: GameState[];
  fire(token: TimerToken): void;
}

function harness(options: { camera: boolean; microphone: boolean } = { camera: true, microphone: true }): Harness {
  const timers = new FakeTimers();
  const intents: Intent[] = [];
  const played: string[] = [];
  const states: GameState[] = [];

  const moves = entriesOfKind('move', ALL_CLIPS);
  const reactions = entriesOfKind('reaction', ALL_CLIPS).filter((r) => r.id !== IDLE_ID && r.id !== 'RX-06');

  let seed = 0;
  const machine = new GameStateMachine({
    moves,
    reactions,
    idle: getEntry(IDLE_ID),
    transition: getEntry('RX-06'),
    timers,
    random: () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    },
  });

  machine.onIntent((intent) => {
    intents.push(intent);
    if (intent.kind === 'play') played.push(intent.entry.id);
    if (intent.kind === 'state') states.push(intent.state);
  });

  machine.send({ type: 'SENSORS', camera: options.camera, microphone: options.microphone });

  return {
    machine,
    timers,
    intents,
    played,
    states,
    fire(token: TimerToken) {
      if (!timers.has(token)) {
        failures += 1;
        console.error(`  FALLITO  timer "${token}" non richiesto dalla macchina`);
        return;
      }
      timers.clear(token);
      machine.send({ type: 'TIMER', token });
    },
  };
}

console.log('Turno completo, telecamera e microfono disponibili');
{
  const h = harness();
  h.machine.send({ type: 'ASSETS_READY' });
  expect(h.machine.state, 'AVATAR_TURN', 'si parte dal turno dell’avatar');
  expect(h.played.length, 1, 'ha riprodotto una mossa');
  expect(h.machine.turn, 1, 'primo turno');

  h.machine.send({ type: 'CLIP_FINISHED' });
  expect(h.machine.state, 'PLAYER_READY', 'invito al giocatore');
  expect(h.played[1], 'RX-06', 'invito con la clip di transizione');

  h.fire('invitation');
  expect(h.machine.state, 'PLAYER_TURN', 'turno del giocatore');
  expect(
    h.intents.some((i) => i.kind === 'watch-movement' && i.on),
    true,
    'osservazione del movimento accesa',
  );

  h.machine.send({ type: 'MOVEMENT_STARTED' });
  expect(h.machine.state, 'WAITING_FOR_STILLNESS', 'attesa dell’immobilità');
  expect(h.timers.has('player-turn'), false, 'il timeout del turno è stato tolto');

  h.machine.send({ type: 'MOVEMENT_SETTLED' });
  expect(h.machine.state, 'REACTION_SAMPLING', 'campionamento audio');
  expect(
    h.intents.some((i) => i.kind === 'sample-audio' && i.ms === DEFAULT_CONFIG.samplingMs),
    true,
    'ha chiesto il campionamento audio',
  );
  expect(
    h.intents.some((i) => i.kind === 'watch-movement' && !i.on),
    true,
    'osservazione del movimento spenta',
  );

  h.machine.send({ type: 'AUDIO_RESULT', level: 'high' });
  expect(h.machine.state, 'AVATAR_REACTION', 'reazione dell’avatar');
  expect(h.played[h.played.length - 1], 'RX-03', 'con reazione festosa');

  h.machine.send({ type: 'CLIP_FINISHED' });
  expect(h.machine.state, 'NEXT_TURN', 'passaggio al turno successivo');
  h.fire('next-turn');
  expect(h.machine.state, 'AVATAR_TURN', 'nuovo turno dell’avatar');
  expect(h.machine.turn, 2, 'secondo turno');
  expect(h.played[0] !== h.played[h.played.length - 1], true, 'mossa diversa dalla precedente');
}

console.log('Senza telecamera: il turno scade da solo');
{
  const h = harness({ camera: false, microphone: true });
  h.machine.send({ type: 'ASSETS_READY' });
  h.machine.send({ type: 'CLIP_FINISHED' });
  h.fire('invitation');
  expect(
    h.intents.some((i) => i.kind === 'watch-movement' && i.on),
    false,
    'non chiede di osservare il movimento',
  );
  expect(h.timers.has('player-turn'), true, 'ha armato il timeout del turno');
  h.fire('player-turn');
  expect(h.machine.state, 'REACTION_SAMPLING', 'il turno finisce comunque');
}

console.log('Senza microfono: si reagisce lo stesso');
{
  const h = harness({ camera: true, microphone: false });
  h.machine.send({ type: 'ASSETS_READY' });
  h.machine.send({ type: 'CLIP_FINISHED' });
  h.fire('invitation');
  h.machine.send({ type: 'MOVEMENT_STARTED' });
  h.machine.send({ type: 'MOVEMENT_SETTLED' });
  expect(
    h.intents.some((i) => i.kind === 'sample-audio'),
    false,
    'non chiede il campionamento audio',
  );
  h.fire('beat');
  expect(h.machine.state, 'AVATAR_REACTION', 'reagisce comunque');
  const outcome = h.intents.find((i) => i.kind === 'outcome');
  expect(outcome && outcome.kind === 'outcome' ? outcome.level : null, 'unknown', 'livello sonoro ignoto');
}

console.log('Giocatore immobile con la telecamera accesa: reazione delusa');
{
  const h = harness();
  h.machine.send({ type: 'ASSETS_READY' });
  h.machine.send({ type: 'CLIP_FINISHED' });
  h.fire('invitation');
  h.fire('player-turn');
  h.machine.send({ type: 'AUDIO_RESULT', level: 'high' });
  const outcome = h.intents.find((i) => i.kind === 'outcome');
  expect(outcome && outcome.kind === 'outcome' ? outcome.moved : null, false, 'nessun movimento visto');
  expect(h.played[h.played.length - 1], 'RX-04', 'reazione delusa nonostante il rumore');
}

console.log('Immobilità mai dichiarata: la riserva sblocca il turno');
{
  const h = harness();
  h.machine.send({ type: 'ASSETS_READY' });
  h.machine.send({ type: 'CLIP_FINISHED' });
  h.fire('invitation');
  h.machine.send({ type: 'MOVEMENT_STARTED' });
  expect(h.timers.has('stillness-fallback'), true, 'riserva armata');
  h.fire('stillness-fallback');
  expect(h.machine.state, 'REACTION_SAMPLING', 'il turno prosegue');
}

console.log('Pulsante "ho finito": vale in attesa, durante il turno e in attesa di immobilità');
for (const step of ['ready', 'turn', 'stillness'] as const) {
  const h = harness();
  h.machine.send({ type: 'ASSETS_READY' });
  h.machine.send({ type: 'CLIP_FINISHED' });
  if (step !== 'ready') h.fire('invitation');
  if (step === 'stillness') h.machine.send({ type: 'MOVEMENT_STARTED' });
  h.machine.send({ type: 'PLAYER_DONE' });
  const expected = step === 'ready' ? 'PLAYER_TURN' : 'REACTION_SAMPLING';
  expect(h.machine.state, expected, `da ${step}`);
}

console.log('Pausa e ripresa');
{
  const h = harness();
  h.machine.send({ type: 'ASSETS_READY' });
  h.machine.send({ type: 'CLIP_FINISHED' });
  h.fire('invitation');
  h.machine.send({ type: 'PAUSE' });
  expect(h.machine.state, 'PAUSED', 'in pausa');
  expect(h.timers.pending.size, 0, 'nessun timer in sospeso');
  expect(
    h.intents.filter((i) => i.kind === 'watch-movement' && !i.on).length > 0,
    true,
    'osservazione del movimento spenta',
  );
  h.machine.send({ type: 'MOVEMENT_STARTED' });
  expect(h.machine.state, 'PAUSED', 'gli eventi di gioco sono ignorati');
  h.machine.send({ type: 'RESUME' });
  h.fire('next-turn');
  expect(h.machine.state, 'AVATAR_TURN', 'riparte da un turno intero');
}

console.log('Venti turni di fila: nessuna mossa ripetuta, nessuno stato inatteso');
{
  const h = harness();
  const seen: string[] = [];
  h.machine.send({ type: 'ASSETS_READY' });
  for (let i = 0; i < 20; i++) {
    seen.push(h.played[h.played.length - 1]);
    h.machine.send({ type: 'CLIP_FINISHED' });
    h.fire('invitation');
    h.machine.send({ type: 'MOVEMENT_STARTED' });
    h.machine.send({ type: 'MOVEMENT_SETTLED' });
    h.machine.send({ type: 'AUDIO_RESULT', level: i % 2 === 0 ? 'high' : 'low' });
    h.machine.send({ type: 'CLIP_FINISHED' });
    h.fire('next-turn');
  }
  const repeats = seen.filter((id, i) => i > 0 && id === seen[i - 1]).length;
  expect(repeats, 0, 'nessuna mossa due volte di fila');

  // Vincolo vero: il repertorio si consuma come un mazzo, e dentro ogni giro
  // non escono doppioni. Il controllo è sui blocchi **allineati** al giro, non
  // su una finestra scorrevole: a cavallo fra due giri un doppione è lecito per
  // costruzione — l'ultima di un mazzo e una delle prime del successivo possono
  // coincidere, purché non siano di fila, e quello lo garantisce il controllo
  // qui sopra.
  const size = entriesOfKind('move', ALL_CLIPS).length;
  let roundsWithRepeats = 0;
  for (let i = 0; i < seen.length; i += size) {
    const round = seen.slice(i, i + size);
    if (new Set(round).size !== round.length) roundsWithRepeats += 1;
  }
  expect(roundsWithRepeats, 0, `nessun doppione dentro un giro di ${size} mosse`);
  expect(new Set(seen).size, size, 'tutte le mosse del catalogo sono uscite');
  expect(h.machine.turn, 21, 'ventuno turni contati');
  expect(h.machine.state, 'AVATAR_TURN', 'stato coerente alla fine');
}

console.log('Aura: il conteggio da solo');
{
  const aura = new AuraMeter();
  expect(aura.value, AURA_START, 'parte dal valore iniziale');

  // Giocatore che se la cava: agitazione piena e pubblico entusiasta.
  const bravo = aura.apply({ agitation: 1, approval: 'high', watched: true, moved: true });
  expect(bravo.delta, -AURA_STEP, 'una resa piena toglie il massimo');
  expect(bravo.reason, 'superato', 'motivo coerente');
  expect(bravo.winner, null, 'un turno solo non chiude la partita');

  // Fermo davanti alla telecamera: non ha giocato, qualunque cosa dica l'audio.
  const fermo = new AuraMeter();
  const pigro = fermo.apply({ agitation: 1, approval: 'high', watched: true, moved: false });
  expect(pigro.delta, AURA_STEP, 'chi non si muove regala il massimo all’avatar');
  expect(pigro.reason, 'inattivo', 'riconosciuto come inattivo');

  // Senza telecamera conta solo il pubblico: l'agitazione non è misurabile.
  const alCieco = new AuraMeter();
  alCieco.apply({ agitation: null, approval: 'high', watched: false, moved: false });
  expect(alCieco.value, AURA_START - AURA_STEP, 'senza telecamera decide il pubblico');

  // Estremi: non si esce mai dall'intervallo.
  const basso = new AuraMeter(4);
  const sotto = basso.apply({ agitation: 1, approval: 'high', watched: true, moved: true });
  expect(sotto.value, 0, 'non scende sotto zero');
  expect(sotto.winner, 'player', 'a zero vince il giocatore');

  const alto = new AuraMeter(AURA_MAX - 4);
  const sopra = alto.apply({ agitation: 0, approval: 'low', watched: true, moved: false });
  expect(sopra.value, AURA_MAX, 'non supera il massimo');
  expect(sopra.winner, 'avatar', 'al massimo vince l’avatar');
}

console.log('Aura: il giocatore la azzera e vince');
{
  const h = harness();
  h.machine.send({ type: 'ASSETS_READY' });

  let turns = 0;
  while (h.machine.state !== 'MATCH_OVER' && turns < 12) {
    turns += 1;
    h.machine.send({ type: 'CLIP_FINISHED' });
    h.fire('invitation');
    h.machine.send({ type: 'MOVEMENT_STARTED' });
    h.machine.send({ type: 'AGITATION', value: 1 });
    h.machine.send({ type: 'MOVEMENT_SETTLED' });
    h.machine.send({ type: 'AUDIO_RESULT', level: 'high' });
    h.machine.send({ type: 'CLIP_FINISHED' });
    if (h.machine.state === 'NEXT_TURN') h.fire('next-turn');
  }

  expect(h.machine.state, 'MATCH_OVER', 'la partita è finita');
  expect(h.machine.auraValue, 0, 'aura azzerata');
  expect(turns, Math.ceil(AURA_START / AURA_STEP), 'nel numero di turni previsto dal passo');
  const over = h.intents.find((i) => i.kind === 'match-over');
  expect(over && over.kind === 'match-over' ? over.winner : null, 'player', 'vince il giocatore');
  expect(h.played[h.played.length - 1], 'RX-04', 'chiude con la reazione delusa');
  expect(h.timers.pending.size, 0, 'nessun timer resta appeso');
}

console.log('Aura: il giocatore non gioca e l’avatar se la gode');
{
  const h = harness();
  h.machine.send({ type: 'ASSETS_READY' });

  let turns = 0;
  while (h.machine.state !== 'MATCH_OVER' && turns < 12) {
    turns += 1;
    h.machine.send({ type: 'CLIP_FINISHED' });
    h.fire('invitation');
    // Nessun movimento: il turno scade da solo.
    h.fire('player-turn');
    h.machine.send({ type: 'AUDIO_RESULT', level: 'low' });
    h.machine.send({ type: 'CLIP_FINISHED' });
    if (h.machine.state === 'NEXT_TURN') h.fire('next-turn');
  }

  expect(h.machine.state, 'MATCH_OVER', 'la partita è finita');
  expect(h.machine.auraValue, AURA_MAX, 'aura al massimo');
  const over = h.intents.find((i) => i.kind === 'match-over');
  expect(over && over.kind === 'match-over' ? over.winner : null, 'avatar', 'vince l’avatar');
  expect(h.played[h.played.length - 1], 'RX-03', 'chiude festeggiando');

  // E si può ricominciare.
  h.machine.send({ type: 'RESTART' });
  expect(h.machine.state, 'AVATAR_TURN', 'riparte dal turno dell’avatar');
  expect(h.machine.auraValue, AURA_START, 'aura riportata al valore iniziale');
  expect(h.machine.turn, 1, 'conteggio dei turni azzerato');
}

console.log('Aura: durante la pausa non si muove');
{
  const h = harness();
  h.machine.send({ type: 'ASSETS_READY' });
  const before = h.machine.auraValue;
  h.machine.send({ type: 'PAUSE' });
  h.machine.send({ type: 'AGITATION', value: 1 });
  h.machine.send({ type: 'RESUME' });
  expect(h.machine.auraValue, before, 'la pausa non cambia l’aura');
}

console.log(failures === 0 ? '\nTutti i controlli superati.' : `\n${failures} controlli falliti.`);
process.exit(failures === 0 ? 0 : 1);
