/**
 * GameStateMachine — alternanza dei turni fra avatar e giocatore (spec 5.2).
 *
 * Non conosce Three.js, MediaPipe né la Web Audio API: riceve **eventi
 * normalizzati** ed emette **intenti**, che chi la usa traduce in chiamate ai
 * moduli concreti. È la separazione chiesta dalla specifica (8.2), e il motivo
 * per cui la logica di gioco si può provare senza browser, telecamera o
 * microfono.
 *
 * I passaggi di turno dipendono solo da eventi espliciti. Le attese non sono
 * `setTimeout` sparsi nel codice ma timer dichiarati dalla macchina stessa,
 * passati dall'esterno: così sono tutti in un posto solo e, nei test, si
 * possono far scattare a comando.
 */
import type { CatalogEntry } from '../assets/AssetCatalog.ts';
import { AuraMeter, type AuraReason, type AuraWinner } from './Aura.ts';

export type GameState =
  | 'INITIALIZING'
  | 'AVATAR_TURN'
  | 'PLAYER_READY'
  | 'PLAYER_TURN'
  | 'WAITING_FOR_STILLNESS'
  | 'REACTION_SAMPLING'
  | 'AVATAR_REACTION'
  | 'NEXT_TURN'
  | 'MATCH_OVER'
  | 'PAUSED';

/** Intensità della reazione sonora del pubblico (spec 7.3). */
export type ReactionLevel = 'low' | 'medium' | 'high' | 'unknown';

export type GameEvent =
  /** Modello e clip pronti: si può cominciare. */
  | { type: 'ASSETS_READY' }
  /** Una clip non ciclica è arrivata in fondo. */
  | { type: 'CLIP_FINISHED' }
  /** Il rilevamento ha visto partire il movimento del giocatore. */
  | { type: 'MOVEMENT_STARTED' }
  /** Il giocatore è rimasto fermo abbastanza a lungo. */
  | { type: 'MOVEMENT_SETTLED' }
  /** Il giocatore dichiara di aver finito (pulsante di riserva). */
  | { type: 'PLAYER_DONE' }
  /** Esito del campionamento audio. */
  | { type: 'AUDIO_RESULT'; level: ReactionLevel }
  /**
   * Quanto il giocatore si sta muovendo, da 0 a 1. Arriva in continuazione
   * durante il turno; della raffica la macchina tiene il picco, perché è il
   * momento migliore a dire se il giocatore ci ha provato, non la media.
   */
  | { type: 'AGITATION'; value: number }
  /** Nuova partita dopo la fine. */
  | { type: 'RESTART' }
  /** Disponibilità delle periferiche; cambia i percorsi di riserva. */
  | { type: 'SENSORS'; camera: boolean; microphone: boolean }
  | { type: 'PAUSE' }
  | { type: 'RESUME' }
  /** Scatto di un timer richiesto dalla macchina. */
  | { type: 'TIMER'; token: TimerToken };

export type TimerToken =
  | 'invitation'
  | 'player-turn'
  | 'stillness-fallback'
  | 'beat'
  | 'next-turn';

export type Intent =
  /** Riproduci questa voce del catalogo. */
  | { kind: 'play'; entry: CatalogEntry }
  /** Torna all'animazione di attesa. */
  | { kind: 'idle' }
  /** Accendi o spegni l'osservazione del movimento. */
  | { kind: 'watch-movement'; on: boolean }
  /** Campiona il livello sonoro per questa durata. */
  | { kind: 'sample-audio'; ms: number }
  /** Stato cambiato: serve all'interfaccia. */
  | { kind: 'state'; state: GameState; turn: number }
  /** Aura dopo il turno: valore, spostamento e motivo. */
  | {
      kind: 'aura';
      value: number;
      delta: number;
      performance: number;
      reason: AuraReason;
    }
  /** Partita finita: l'aura ha toccato un estremo. */
  | { kind: 'match-over'; winner: AuraWinner; turns: number }
  /** Esito del turno, per il riepilogo a schermo. */
  | {
      kind: 'outcome';
      move: CatalogEntry;
      reaction: CatalogEntry;
      level: ReactionLevel;
      /** Se la telecamera era attiva, se ha visto muoversi il giocatore. */
      moved: boolean;
    };

export interface Timers {
  set(token: TimerToken, ms: number): void;
  clear(token: TimerToken): void;
  clearAll(): void;
}

export interface GameConfig {
  /** Quanto resta a schermo l'invito prima di passare la mano. */
  invitationMs: number;
  /** Tempo massimo del turno del giocatore prima di procedere comunque. */
  playerTurnMs: number;
  /**
   * Riserva quando il rilevamento non dichiara mai l'immobilità: evita che il
   * turno resti appeso (spec 6.3).
   */
  stillnessFallbackMs: number;
  /** Pausa fra la fine della mossa del giocatore e la reazione dell'avatar. */
  beatMs: number;
  /** Finestra di campionamento audio. */
  samplingMs: number;
  /** Pausa fra una reazione e la mossa successiva. */
  nextTurnMs: number;
}

export const DEFAULT_CONFIG: GameConfig = {
  invitationMs: 900,
  playerTurnMs: 12_000,
  stillnessFallbackMs: 6_000,
  beatMs: 600,
  samplingMs: 1_500,
  nextTurnMs: 900,
};

export interface GameOptions {
  moves: readonly CatalogEntry[];
  reactions: readonly CatalogEntry[];
  idle: CatalogEntry;
  /** Clip di passaggio del turno; se assente il passaggio è immediato. */
  transition?: CatalogEntry;
  timers: Timers;
  config?: Partial<GameConfig>;
  /** Sorgente casuale iniettabile, per rendere i test deterministici. */
  random?: () => number;
  /** Contatore dell'aura; se assente se ne crea uno al valore iniziale. */
  aura?: AuraMeter;
}

/** Reazioni preferite per livello sonoro; la scelta resta non vincolante. */
const REACTION_BY_LEVEL: Record<ReactionLevel, readonly string[]> = {
  high: ['RX-03', 'RX-01'],
  medium: ['RX-01', 'RX-02'],
  low: ['RX-04', 'RX-02'],
  unknown: ['RX-02', 'RX-01'],
};

export class GameStateMachine {
  private current: GameState = 'INITIALIZING';
  private turnCount = 0;
  private listeners: ((intent: Intent) => void)[] = [];

  private readonly config: GameConfig;
  private readonly random: () => number;

  private hasCamera = false;
  private hasMicrophone = false;
  private lastMoveId: string | null = null;
  /**
   * Mosse già uscite nel giro corrente. Si svuota solo quando il repertorio è
   * esaurito: dentro una partita una mossa non torna finché non sono uscite
   * tutte le altre.
   */
  private readonly usedMoveIds = new Set<string>();
  private lastReactionId: string | null = null;
  private currentMove: CatalogEntry | null = null;
  private movementSeen = false;
  /** Picco di agitazione del turno, oppure -1 se non è arrivata nessuna misura. */
  private agitation = -1;
  private pendingWinner: AuraWinner | null = null;
  private readonly aura: AuraMeter;

  constructor(private readonly options: GameOptions) {
    this.config = { ...DEFAULT_CONFIG, ...options.config };
    this.random = options.random ?? Math.random;
    this.aura = options.aura ?? new AuraMeter();
    if (options.moves.length === 0) throw new Error('Nessuna mossa disponibile nel catalogo');
    if (options.reactions.length === 0) throw new Error('Nessuna reazione disponibile nel catalogo');
  }

  get state(): GameState {
    return this.current;
  }

  get turn(): number {
    return this.turnCount;
  }

  /** Aura corrente: la legge l'interfaccia al primo disegno. */
  get auraValue(): number {
    return this.aura.value;
  }

  onIntent(listener: (intent: Intent) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private emit(intent: Intent): void {
    for (const listener of this.listeners) listener(intent);
  }

  private enter(state: GameState): void {
    this.current = state;
    this.emit({ kind: 'state', state, turn: this.turnCount });
  }

  send(event: GameEvent): void {
    // Eventi validi in qualunque stato.
    if (event.type === 'SENSORS') {
      this.hasCamera = event.camera;
      this.hasMicrophone = event.microphone;
      return;
    }
    if (event.type === 'AGITATION') {
      if (event.value > this.agitation) this.agitation = event.value;
      return;
    }
    if (event.type === 'RESTART') {
      if (this.current !== 'MATCH_OVER') return;
      this.aura.reset();
      this.turnCount = 0;
      this.pendingWinner = null;
      this.usedMoveIds.clear();
      this.emit({ kind: 'aura', value: this.aura.value, delta: 0, performance: 0, reason: 'pari' });
      this.beginAvatarTurn();
      return;
    }
    if (event.type === 'PAUSE') {
      if (this.current === 'PAUSED') return;
      this.options.timers.clearAll();
      this.emit({ kind: 'watch-movement', on: false });
      this.enter('PAUSED');
      return;
    }
    if (event.type === 'RESUME') {
      if (this.current !== 'PAUSED') return;
      // Si riparte dall'inizio del turno: riprendere a metà di una misura
      // audio o di un'attesa di immobilità darebbe risultati senza senso.
      this.enter('NEXT_TURN');
      this.options.timers.set('next-turn', this.config.nextTurnMs);
      return;
    }

    switch (this.current) {
      case 'INITIALIZING':
        if (event.type === 'ASSETS_READY') this.beginAvatarTurn();
        return;

      case 'AVATAR_TURN':
        if (event.type === 'CLIP_FINISHED') {
          this.enter('PLAYER_READY');
          if (this.options.transition) this.emit({ kind: 'play', entry: this.options.transition });
          this.options.timers.set('invitation', this.config.invitationMs);
        }
        return;

      case 'PLAYER_READY':
        if (event.type === 'TIMER' && event.token === 'invitation') this.beginPlayerTurn();
        if (event.type === 'PLAYER_DONE') this.beginPlayerTurn();
        return;

      case 'PLAYER_TURN':
        if (event.type === 'MOVEMENT_STARTED') {
          this.movementSeen = true;
          this.enter('WAITING_FOR_STILLNESS');
          this.options.timers.clear('player-turn');
          this.options.timers.set('stillness-fallback', this.config.stillnessFallbackMs);
          return;
        }
        if (event.type === 'PLAYER_DONE') return this.endPlayerTurn();
        // Senza telecamera, o se il giocatore non si muove affatto, il turno
        // scade comunque: la partita non deve potersi incastrare.
        if (event.type === 'TIMER' && event.token === 'player-turn') return this.endPlayerTurn();
        return;

      case 'WAITING_FOR_STILLNESS':
        if (event.type === 'MOVEMENT_SETTLED') return this.endPlayerTurn();
        if (event.type === 'PLAYER_DONE') return this.endPlayerTurn();
        if (event.type === 'TIMER' && event.token === 'stillness-fallback') return this.endPlayerTurn();
        return;

      case 'REACTION_SAMPLING':
        if (event.type === 'AUDIO_RESULT') return this.react(event.level);
        if (event.type === 'TIMER' && event.token === 'beat') {
          // Nessun microfono: si reagisce lo stesso, senza pretendere di
          // sapere com'è andata.
          return this.react('unknown');
        }
        return;

      case 'AVATAR_REACTION':
        if (event.type === 'CLIP_FINISHED') {
          if (this.pendingWinner) return this.endMatch(this.pendingWinner);
          this.enter('NEXT_TURN');
          this.emit({ kind: 'idle' });
          this.options.timers.set('next-turn', this.config.nextTurnMs);
        }
        return;

      case 'MATCH_OVER':
        // Si esce solo con RESTART, gestito prima dello switch.
        return;

      case 'NEXT_TURN':
        if (event.type === 'TIMER' && event.token === 'next-turn') this.beginAvatarTurn();
        return;

      default:
        return;
    }
  }

  private beginAvatarTurn(): void {
    this.turnCount += 1;
    this.movementSeen = false;
    this.agitation = -1;
    this.currentMove = this.pickMove();
    this.lastMoveId = this.currentMove.id;
    this.enter('AVATAR_TURN');
    this.emit({ kind: 'play', entry: this.currentMove });
  }

  private beginPlayerTurn(): void {
    this.enter('PLAYER_TURN');
    this.emit({ kind: 'idle' });
    if (this.hasCamera) this.emit({ kind: 'watch-movement', on: true });
    this.options.timers.set('player-turn', this.config.playerTurnMs);
  }

  private endPlayerTurn(): void {
    this.options.timers.clear('player-turn');
    this.options.timers.clear('stillness-fallback');
    this.emit({ kind: 'watch-movement', on: false });
    this.enter('REACTION_SAMPLING');

    if (this.hasMicrophone) {
      this.emit({ kind: 'sample-audio', ms: this.config.samplingMs });
      // La riserva copre anche il caso in cui l'analisi non risponda.
      this.options.timers.set('beat', this.config.samplingMs + this.config.beatMs);
    } else {
      this.options.timers.set('beat', this.config.beatMs);
    }
  }

  private react(level: ReactionLevel): void {
    this.options.timers.clear('beat');
    // Se la telecamera guardava e non ha visto muovere niente, il giocatore
    // non ha giocato: qualunque cosa dica il microfono, la reazione giusta è
    // quella delusa.
    const effective: ReactionLevel = this.hasCamera && !this.movementSeen ? 'low' : level;

    // L'aura giudica sul livello grezzo, non su `effective`: il caso del
    // giocatore immobile lo riconosce da sé dall'agitazione, e contarlo due
    // volte lo farebbe pesare il doppio.
    const verdict = this.aura.apply({
      agitation: this.agitation >= 0 ? this.agitation : null,
      approval: level,
      watched: this.hasCamera,
      moved: this.movementSeen,
    });
    this.pendingWinner = verdict.winner;
    this.emit({
      kind: 'aura',
      value: verdict.value,
      delta: verdict.delta,
      performance: verdict.performance,
      reason: verdict.reason,
    });

    const reaction = this.pickReaction(effective);
    this.lastReactionId = reaction.id;
    this.enter('AVATAR_REACTION');
    if (this.currentMove) {
      this.emit({
        kind: 'outcome',
        move: this.currentMove,
        reaction,
        level: effective,
        moved: this.movementSeen,
      });
    }
    this.emit({ kind: 'play', entry: reaction });
  }

  /**
   * Chiusura della partita. L'ultima clip non è una reazione al turno ma il
   * commento sull'esito: l'avatar festeggia se ha tenuto l'aura, incassa se
   * l'ha persa. Se la clip non è nel modello si torna all'attesa, senza
   * inventarsi un ripiego muto.
   */
  private endMatch(winner: AuraWinner): void {
    this.options.timers.clearAll();
    this.enter('MATCH_OVER');
    this.emit({ kind: 'match-over', winner, turns: this.turnCount });
    const closing = this.options.reactions.find(
      (r) => r.id === (winner === 'avatar' ? 'RX-03' : 'RX-04'),
    );
    if (closing) this.emit({ kind: 'play', entry: closing });
    else this.emit({ kind: 'idle' });
  }

  /**
   * Mossa a caso fra quelle non ancora uscite nel giro.
   *
   * Non basta evitare la ripetizione immediata: con otto mosse e una partita di
   * quattro-otto turni, il solo vincolo «mai due volte di fila» lascia
   * comunque rivedere la stessa mossa tre volte mentre altre non compaiono
   * mai. Qui il repertorio si consuma come un mazzo: quando è finito si
   * rimescola, e nel rimescolare si esclude l'ultima uscita, altrimenti il
   * passaggio da un giro al successivo sarebbe l'unico punto in cui una mossa
   * può ripetersi di fila.
   */
  private pickMove(): CatalogEntry {
    let pool = this.options.moves.filter((m) => !this.usedMoveIds.has(m.id));
    if (pool.length === 0) {
      this.usedMoveIds.clear();
      pool = this.options.moves.filter((m) => m.id !== this.lastMoveId);
      if (pool.length === 0) pool = [...this.options.moves];
    }
    const chosen = pool[Math.floor(this.random() * pool.length) % pool.length];
    this.usedMoveIds.add(chosen.id);
    return chosen;
  }

  /**
   * Reazione coerente con il livello sonoro, senza legarla alla mossa (spec
   * 4.2). Se la preferita è la stessa di prima si prende la seconda scelta:
   * ripetere la stessa smorfia due volte di fila la svuota.
   */
  private pickReaction(level: ReactionLevel): CatalogEntry {
    const preferred = REACTION_BY_LEVEL[level]
      .map((id) => this.options.reactions.find((r) => r.id === id))
      .filter((r): r is CatalogEntry => r !== undefined);

    const fresh = preferred.filter((r) => r.id !== this.lastReactionId);
    if (fresh.length > 0) return fresh[0];
    if (preferred.length > 0) return preferred[0];

    const pool = this.options.reactions.filter((r) => r.id !== this.lastReactionId);
    const from = pool.length > 0 ? pool : this.options.reactions;
    return from[Math.floor(this.random() * from.length) % from.length];
  }
}
