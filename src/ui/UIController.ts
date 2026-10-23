/**
 * UIController — tutto ciò che si vede e si tocca: caricamento, permessi,
 * stato del turno, riscontro dei sensori, repertorio e diagnostica.
 *
 * Non conosce Three.js né la macchina a stati: riceve stati e voci di catalogo
 * e notifica le scelte dell'utente tramite callback.
 */
import { AURA_MAX, AURA_STEP } from '../game/Aura.ts';
import type { CatalogEntry } from '../assets/AssetCatalog.ts';
import type { AvatarReport } from '../assets/AvatarContract.ts';
import type { NamingResult } from '../assets/BoneNaming.ts';
import type { GameState } from '../game/GameStateMachine.ts';

export interface UICallbacks {
  /** Avvio della partita; `withSensors` distingue le due scelte iniziali. */
  onStart: (withSensors: boolean) => void;
  onPlayerDone: () => void;
  onPause: () => void;
  onResume: () => void;
  /** Riproduzione libera di una voce del repertorio. */
  onPlay: (entry: CatalogEntry) => void;
  onReset: () => void;
  onRestart: () => void;
}

/**
 * Cosa dice la fascia di stato in ciascuno stato del gioco. Tenere qui le frasi
 * — e non nella macchina a stati — è ciò che permette di cambiarle, tradurle o
 * adattarle ai bambini senza toccare la logica dei turni.
 */
const HINTS: Record<GameState, string> = {
  INITIALIZING: 'Un attimo…',
  AVATAR_TURN: 'Guarda la mossa',
  PLAYER_READY: 'Tocca a te',
  PLAYER_TURN: 'Fai la mossa!',
  WAITING_FOR_STILLNESS: 'Fermati quando hai finito',
  REACTION_SAMPLING: 'Vediamo…',
  AVATAR_REACTION: 'La risposta',
  NEXT_TURN: 'Prossima mossa',
  MATCH_OVER: 'Partita finita',
  PAUSED: 'In pausa',
};

/** Fondo scala dell'indicatore audio, in dB sopra il rumore di fondo. */
const AUDIO_SCALE_DB = 20;

/** Colore della barra audio per classe: lo stesso linguaggio dell'aura. */
const AUDIO_COLOR: Record<string, string> = {
  low: 'var(--ink-soft)',
  medium: '#7fae5a',
  high: '#f0a830',
  unknown: 'var(--line)',
};

/**
 * Colore della barra dell'aura, interpolato fra le stesse tre tappe usate
 * dall'alone in scena (`AuraHalo`): freddo quando l'aura sta finendo, verde a
 * metà, oro quando l'avatar domina. Tenerle allineate è il motivo per cui sono
 * scritte come numeri qui e non come variabili CSS.
 */
function auraColor(ratio: number): string {
  const stops: [number, number, number][] = [
    [0x8f, 0xb0, 0xcc],
    [0x7f, 0xae, 0x5a],
    [0xf0, 0xa8, 0x30],
  ];
  const [from, to, t] = ratio < 0.5 ? [stops[0], stops[1], ratio * 2] : [stops[1], stops[2], (ratio - 0.5) * 2];
  const mix = from.map((c, i) => Math.round(c + (to[i] - c) * t));
  return `rgb(${mix[0]}, ${mix[1]}, ${mix[2]})`;
}

export class UIController {
  private readonly el: Record<string, HTMLElement> = {};
  private readonly moveButtons: HTMLButtonElement[] = [];

  constructor(private readonly callbacks: UICallbacks) {
    for (const id of [
      'loader',
      'loader-bar',
      'loader-text',
      'start',
      'start-sensors',
      'start-plain',
      'start-note',
      'banner',
      'banner-turn',
      'banner-hint',
      'banner-move',
      'camera',
      'camera-slot',
      'motion-bar',
      'audio',
      'audio-bar',
      'audio-db',
      'done',
      'pause',
      'resume',
      'outcome',
      'status',
      'moves',
      'reactions',
      'planned',
      'diagnostics',
      'extra',
      'reset',
      'fps',
      'aura',
      'aura-value',
      'aura-track',
      'aura-bar',
      'aura-note',
      'over',
      'over-title',
      'over-text',
      'again',
    ]) {
      const node = document.getElementById(id);
      if (!node) throw new Error(`Elemento mancante nel DOM: #${id}`);
      this.el[id] = node;
    }

    this.el['start-sensors'].addEventListener('click', () => this.callbacks.onStart(true));
    this.el['start-plain'].addEventListener('click', () => this.callbacks.onStart(false));
    this.el['done'].addEventListener('click', () => this.callbacks.onPlayerDone());
    this.el['pause'].addEventListener('click', () => this.callbacks.onPause());
    this.el['resume'].addEventListener('click', () => this.callbacks.onResume());
    this.el['reset'].addEventListener('click', () => this.callbacks.onReset());
    this.el['again'].addEventListener('click', () => this.callbacks.onRestart());

    // Una tacca per turno: la larghezza arriva dal passo dell'aura, non da un
    // numero scritto nel foglio di stile, così i due non possono divergere.
    this.el['aura-track'].style.setProperty('--notch', `${(AURA_STEP / AURA_MAX) * 100}%`);
  }

  // --- Caricamento ---

  setProgress(ratio: number): void {
    this.el['loader-bar'].style.width = `${Math.round(ratio * 100)}%`;
  }

  showError(message: string): void {
    this.el['loader'].classList.remove('is-faded');
    this.el['loader'].classList.add('is-error');
    this.el['loader-text'].textContent = message;
    this.el['loader-bar'].style.width = '100%';
  }

  /** Caricamento finito: si passa alla schermata iniziale. */
  showStart(): void {
    this.el['loader'].classList.add('is-faded');
    window.setTimeout(() => this.el['loader'].classList.add('is-hidden'), 320);
    this.el['start'].classList.remove('is-hidden');
  }

  hideStart(): void {
    this.el['start'].classList.add('is-hidden');
    this.el['banner'].classList.remove('is-hidden');
  }

  /**
   * Messaggio sulla schermata iniziale quando le periferiche non sono
   * utilizzabili: va detto prima di cominciare, non dopo (spec 9).
   */
  setStartNote(message: string): void {
    this.el['start-note'].textContent = message;
  }

  // --- Turno ---

  setTurn(state: GameState, turn: number): void {
    this.el['banner-turn'].textContent = state === 'PAUSED' ? 'In pausa' : `Turno ${turn}`;
    this.el['banner-hint'].textContent = HINTS[state];
    this.el['status'].textContent = `${state} · turno ${turn}`;

    const playing = state !== 'PAUSED' && state !== 'INITIALIZING';
    this.el['pause'].classList.toggle('is-hidden', !playing);
    this.el['resume'].classList.toggle('is-hidden', state !== 'PAUSED');

    // Il pulsante di riserva compare solo quando serve davvero: durante il
    // turno del giocatore e mentre si aspetta che si fermi.
    const canFinish = state === 'PLAYER_READY' || state === 'PLAYER_TURN' || state === 'WAITING_FOR_STILLNESS';
    this.el['done'].classList.toggle('is-hidden', !canFinish);
    this.el['done'].textContent = state === 'PLAYER_READY' ? 'Sono pronto' : 'Ho finito';
  }

  /**
   * Nome della mossa in corso. Resta a schermo per tutto il turno del
   * giocatore, non solo mentre l'avatar la esegue: è l'informazione che serve
   * proprio nel momento in cui bisogna imitarla.
   */
  setMove(label: string | null): void {
    this.el['banner-move'].textContent = label ?? '';
    this.el['banner-move'].classList.toggle('is-hidden', label === null);
  }

  setOutcome(text: string): void {
    this.el['outcome'].textContent = text;
  }

  // --- Aura ---

  /**
   * Mostra l'aura. Il colore della barra segue quello dell'alone in scena, così
   * il numero e la macchia di luce raccontano la stessa cosa.
   */
  setAura(value: number, note = ''): void {
    const ratio = Math.max(0, Math.min(1, value / AURA_MAX));
    this.el['aura'].classList.remove('is-hidden');
    this.el['aura-value'].textContent = String(value);
    this.el['aura-bar'].style.width = `${Math.round(ratio * 100)}%`;
    this.el['aura-bar'].style.backgroundColor = auraColor(ratio);
    this.el['aura-note'].textContent = note;
  }

  showMatchOver(title: string, text: string): void {
    this.el['over-title'].textContent = title;
    this.el['over-text'].textContent = text;
    this.el['over'].classList.remove('is-hidden');
    this.el['banner'].classList.add('is-hidden');
  }

  hideMatchOver(): void {
    this.el['over'].classList.add('is-hidden');
  }

  // --- Sensori ---

  attachCamera(video: HTMLVideoElement): void {
    this.el['camera-slot'].replaceChildren(video);
  }

  showCamera(on: boolean): void {
    this.el['camera'].classList.toggle('is-hidden', !on);
  }

  /**
   * Tacche delle soglie audio, in percentuale della scala. Arrivano
   * dall'analizzatore: il foglio di stile ha dei valori di ripiego, ma quelli
   * veri li sa solo chi classifica.
   */
  setAudioThresholds(medium: number, high: number): void {
    const el = this.el['audio'];
    el.style.setProperty('--mark-medium', `${(medium / AUDIO_SCALE_DB) * 100}%`);
    el.style.setProperty('--mark-high', `${(high / AUDIO_SCALE_DB) * 100}%`);
  }

  showAudio(on: boolean): void {
    this.el['audio'].classList.toggle('is-hidden', !on);
  }

  /** Evidenzia l'indicatore mentre l'applicazione sta misurando davvero. */
  setAudioSampling(on: boolean): void {
    this.el['audio'].classList.toggle('is-sampling', on);
  }

  /**
   * Livello audio corrente. Si mostra il guadagno sul fondo e non il volume
   * assoluto, perché è quel numero a decidere la reazione: in una stanza
   * rumorosa un volume alto non vuol dire niente.
   */
  setAudio(aboveFloorDb: number, level: string, running: boolean): void {
    const clamped = Math.max(0, Math.min(AUDIO_SCALE_DB, aboveFloorDb));
    this.el['audio-bar'].style.width = `${(clamped / AUDIO_SCALE_DB) * 100}%`;
    this.el['audio-bar'].style.backgroundColor = AUDIO_COLOR[level] ?? 'var(--ink-soft)';
    this.el['audio-db'].textContent = running ? `+${Math.round(clamped)} dB` : 'fermo';
    this.el['audio'].classList.toggle('is-muted', !running);
  }

  setMotion(value: number): void {
    // La barra satura presto: serve a far capire "ti vedo", non a misurare.
    this.el['motion-bar'].style.width = `${Math.min(100, Math.round(value * 1400))}%`;
  }

  setFps(value: number): void {
    this.el['fps'].textContent = `${value} fps`;
  }

  // --- Repertorio e diagnostica ---

  renderCatalog(moves: CatalogEntry[], reactions: CatalogEntry[], planned: CatalogEntry[]): void {
    this.moveButtons.length = 0;
    this.el['moves'].replaceChildren(...moves.map((e) => this.makeButton(e)));
    this.el['reactions'].replaceChildren(...reactions.map((e) => this.makeButton(e)));
    this.el['planned'].replaceChildren(
      ...planned.map((entry) => {
        const li = document.createElement('li');
        li.textContent = `${entry.id} · ${entry.name} — non ancora realizzata`;
        return li;
      }),
    );
  }

  private makeButton(entry: CatalogEntry): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'move';
    button.title = entry.description;
    const id = document.createElement('span');
    id.className = 'move-id';
    id.textContent = entry.id;
    const name = document.createElement('span');
    name.className = 'move-name';
    name.textContent = entry.name;
    button.append(id, name);
    button.addEventListener('click', () => this.callbacks.onPlay(entry));
    this.moveButtons.push(button);
    return button;
  }

  /** Durante una partita la riproduzione libera resta visibile ma inattiva. */
  /**
   * Abilita il repertorio riproducibile a mano e, con esso, la visibilità del
   * pannello di diagnostica.
   *
   * Durante la partita il pannello è inerte — i pulsanti sono disabilitati —
   * e su un telefono il solo sommario costava una trentina di punti di altezza
   * sottratti alla scena. Si nasconde del tutto mentre si gioca e torna a fine
   * partita, quando serve davvero: è lì che si va a leggere cosa ha
   * riconosciuto il motore.
   */
  setFreePlayEnabled(enabled: boolean): void {
    for (const button of this.moveButtons) button.disabled = !enabled;
    this.el['extra'].classList.toggle('is-hidden', !enabled);
  }

  renderDiagnostics(report: AvatarReport, naming: NamingResult): void {
    const rows: [string, string[]][] = [
      [
        'Bone rinominati da una convenzione esterna',
        naming.renamed.size > 0 ? [`${naming.renamed.size}`] : [],
      ],
      ['Bone non riconosciuti, non animati', naming.unrecognized],
      ['Clip riconosciute', report.availableClips],
      ['Clip del catalogo non presenti nel modello', report.missingClips],
      ['Clip nel modello ignote al catalogo', report.unknownClips],
      ['Bone richiesti mancanti', report.missingRequiredBones],
      ['Bone opzionali mancanti', report.missingOptionalBones],
      [
        'Bone delle dita mancanti',
        report.missingFingerBones.length > 0 ? [`${report.missingFingerBones.length} su 20`] : [],
      ],
    ];

    const items = rows
      .filter(([, values]) => values.length > 0)
      .map(([label, values]) => {
        const li = document.createElement('li');
        li.textContent = `${label}: ${values.join(', ')}`;
        return li;
      });

    this.el['diagnostics'].replaceChildren(...items);
  }
}
