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
  expect(h.machine.turn, 21, 'ventuno turni contati');
  expect(h.machine.state, 'AVATAR_TURN', 'stato coerente alla fine');
}

console.log(failures === 0 ? '\nTutti i controlli superati.' : `\n${failures} controlli falliti.`);
process.exit(failures === 0 ? 0 : 1);
