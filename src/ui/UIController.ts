/**
 * UIController — tutto ciò che si vede e si tocca: caricamento, permessi,
 * stato del turno, riscontro dei sensori, repertorio e diagnostica.
 *
 * Non conosce Three.js né la macchina a stati: riceve stati e voci di catalogo
 * e notifica le scelte dell'utente tramite callback.
 */
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
  PAUSED: 'In pausa',
};

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
      'camera',
      'camera-slot',
      'motion-bar',
      'done',
      'pause',
      'resume',
      'outcome',
      'status',
      'moves',
      'reactions',
      'planned',
      'diagnostics',
      'reset',
      'fps',
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

  setOutcome(text: string): void {
    this.el['outcome'].textContent = text;
  }

  // --- Sensori ---

  attachCamera(video: HTMLVideoElement): void {
    this.el['camera-slot'].replaceChildren(video);
  }

  showCamera(on: boolean): void {
    this.el['camera'].classList.toggle('is-hidden', !on);
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
  setFreePlayEnabled(enabled: boolean): void {
    for (const button of this.moveButtons) button.disabled = !enabled;
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
