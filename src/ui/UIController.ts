/**
 * UIController — stato dell'interfaccia: caricamento, errori, comandi, stato
 * del turno. Non conosce Three.js: riceve voci di catalogo e notifica le scelte
 * dell'utente tramite callback.
 */
import type { CatalogEntry } from '../assets/AssetCatalog.ts';
import type { AvatarReport } from '../assets/AvatarContract.ts';

export interface UICallbacks {
  onPlay: (entry: CatalogEntry) => void;
  onDemo: () => void;
  onReset: () => void;
}

export class UIController {
  private readonly loader: HTMLElement;
  private readonly loaderBar: HTMLElement;
  private readonly loaderText: HTMLElement;
  private readonly status: HTMLElement;
  private readonly moveList: HTMLElement;
  private readonly reactionList: HTMLElement;
  private readonly plannedList: HTMLElement;
  private readonly diagnostics: HTMLElement;
  private readonly demoButton: HTMLButtonElement;
  private readonly resetButton: HTMLButtonElement;
  private readonly fps: HTMLElement;
  private readonly buttons: HTMLButtonElement[] = [];

  constructor(private readonly callbacks: UICallbacks) {
    this.loader = this.require('loader');
    this.loaderBar = this.require('loader-bar');
    this.loaderText = this.require('loader-text');
    this.status = this.require('status');
    this.moveList = this.require('moves');
    this.reactionList = this.require('reactions');
    this.plannedList = this.require('planned');
    this.diagnostics = this.require('diagnostics');
    this.fps = this.require('fps');
    this.demoButton = this.require('demo') as HTMLButtonElement;
    this.resetButton = this.require('reset') as HTMLButtonElement;

    this.demoButton.addEventListener('click', () => this.callbacks.onDemo());
    this.resetButton.addEventListener('click', () => this.callbacks.onReset());
  }

  private require(id: string): HTMLElement {
    const el = document.getElementById(id);
    if (!el) throw new Error(`Elemento mancante nel DOM: #${id}`);
    return el;
  }

  setProgress(ratio: number): void {
    this.loaderBar.style.width = `${Math.round(ratio * 100)}%`;
  }

  hideLoader(): void {
    this.loader.classList.add('is-hidden');
  }

  showError(message: string): void {
    this.loader.classList.remove('is-hidden');
    this.loader.classList.add('is-error');
    this.loaderText.textContent = message;
    this.loaderBar.style.width = '100%';
  }

  /** Costruisce i comandi a partire dalle voci realizzate del catalogo. */
  renderCatalog(moves: CatalogEntry[], reactions: CatalogEntry[], planned: CatalogEntry[]): void {
    this.buttons.length = 0;
    this.moveList.replaceChildren(...moves.map((e) => this.makeButton(e)));
    this.reactionList.replaceChildren(...reactions.map((e) => this.makeButton(e)));
    this.plannedList.replaceChildren(
      ...planned.map((entry) => {
        const li = document.createElement('li');
        li.textContent = `${entry.id} · ${entry.name}`;
        return li;
      }),
    );
  }

  private makeButton(entry: CatalogEntry): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'move';
    button.title = entry.description;
    button.innerHTML = `<span class="move-id">${entry.id}</span><span class="move-name"></span>`;
    (button.querySelector('.move-name') as HTMLElement).textContent = entry.name;
    button.addEventListener('click', () => this.callbacks.onPlay(entry));
    this.buttons.push(button);
    return button;
  }

  /**
   * Referto del contratto dell'asset: serve a chi sostituisce il modello 3D per
   * vedere subito cosa il motore ha riconosciuto e cosa manca.
   */
  renderDiagnostics(report: AvatarReport): void {
    const rows: [string, string[]][] = [
      ['Clip riconosciute', report.availableClips],
      ['Clip del catalogo non presenti nel modello', report.missingClips],
      ['Clip nel modello ignote al catalogo', report.unknownClips],
      ['Bone richiesti mancanti', report.missingRequiredBones],
      ['Bone opzionali mancanti', report.missingOptionalBones],
      ['Bone delle dita mancanti', report.missingFingerBones.length > 0
        ? [`${report.missingFingerBones.length} su 20`]
        : []],
    ];

    const items = rows
      .filter(([, values]) => values.length > 0)
      .map(([label, values]) => {
        const li = document.createElement('li');
        li.textContent = `${label}: ${values.join(', ')}`;
        return li;
      });

    if (items.length === 0) {
      const li = document.createElement('li');
      li.textContent = 'Il modello rispetta il contratto: nessuna voce mancante.';
      items.push(li);
    }

    this.diagnostics.replaceChildren(...items);
  }

  setStatus(text: string): void {
    this.status.textContent = text;
  }

  /** Durante una sequenza i comandi restano visibili ma non cliccabili. */
  setBusy(busy: boolean): void {
    for (const button of this.buttons) button.disabled = busy;
    this.demoButton.disabled = busy;
  }

  setFps(value: number): void {
    this.fps.textContent = `${value} fps`;
  }
}
