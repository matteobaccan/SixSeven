/**
 * AssetCatalog — associazione tra ID stabile, clip del modello e metadati.
 *
 * È l'unico punto che lega gli ID della specifica (S7-xx, RX-xx) ai nomi delle
 * clip presenti nel GLB. Aggiungere una mossa significa aggiungere una voce qui
 * e una clip nel modello: il motore di gioco non cambia (spec 2.1 punto 9).
 *
 * Le voci con `clip: null` sono dichiarate ma non ancora realizzate: restano
 * visibili come repertorio previsto senza finire nella UI giocabile.
 */

export type EntryKind = 'move' | 'reaction';

export interface CatalogEntry {
  /** Identificatore stabile della specifica. */
  id: string;
  /** Nome leggibile, mostrato nell'interfaccia. */
  name: string;
  kind: EntryKind;
  /** Nome della clip nel GLB, oppure null se non ancora realizzata. */
  clip: string | null;
  description: string;
  loop: boolean;
  /** Moltiplicatore di velocità: rende la durata configurabile per voce. */
  timeScale: number;
}

const ENTRIES: readonly CatalogEntry[] = [
  // --- Mosse (spec 4.1) ---
  {
    id: 'S7-01',
    name: 'Classic Weighing',
    kind: 'move',
    clip: 'ClassicWeighing',
    description: 'Alternanza delle mani, palmi verso l’alto, come una bilancia.',
    loop: false,
    timeScale: 1,
  },
  {
    id: 'S7-02',
    name: 'Reverse Weighing',
    kind: 'move',
    clip: null,
    description: 'Variante più ampia, rapida e scomposta della bilancia.',
    loop: false,
    timeScale: 1,
  },
  {
    id: 'S7-03',
    name: 'Finger Six-Seven',
    kind: 'move',
    clip: null,
    description: 'Gesto eseguito con le dita, con pose ben leggibili.',
    loop: false,
    timeScale: 1,
  },
  {
    id: 'S7-04',
    name: '67 Handshake',
    kind: 'move',
    clip: null,
    description: 'La mano tesa al giocatore che diventa una provocazione.',
    loop: false,
    timeScale: 1,
  },
  {
    id: 'S7-05',
    name: 'Extreme Six Seven',
    kind: 'move',
    clip: null,
    description: 'Versione caricaturale con braccia, busto e testa esagerati.',
    loop: false,
    timeScale: 1,
  },

  // --- Reazioni (spec 4.2) ---
  {
    id: 'RX-01',
    name: 'Six Seven Face',
    kind: 'reaction',
    clip: 'SixSevenFace',
    description: 'Smorfia facciale esagerata.',
    loop: false,
    timeScale: 1,
  },
  {
    id: 'RX-02',
    name: 'Taunt',
    kind: 'reaction',
    clip: 'Taunt',
    description: 'Reazione provocatoria dopo la mossa del giocatore.',
    loop: false,
    timeScale: 1,
  },
  {
    id: 'RX-03',
    name: 'Celebration',
    kind: 'reaction',
    clip: null,
    description: 'Reazione festosa in presenza di una forte risposta sonora.',
    loop: false,
    timeScale: 1,
  },
  {
    id: 'RX-04',
    name: 'Disappointed',
    kind: 'reaction',
    clip: null,
    description: 'Reazione ironica in assenza di risposta sonora.',
    loop: false,
    timeScale: 1,
  },
  {
    id: 'RX-05',
    name: 'Idle',
    kind: 'reaction',
    clip: 'Idle',
    description: 'Attesa con piccoli movimenti naturali.',
    loop: true,
    timeScale: 1,
  },
  {
    id: 'RX-06',
    name: 'Turn Transition',
    kind: 'reaction',
    clip: null,
    description: 'Passaggio tra il turno dell’avatar e quello del giocatore.',
    loop: false,
    timeScale: 1,
  },
];

const BY_ID = new Map(ENTRIES.map((e) => [e.id, e]));

export const IDLE_ID = 'RX-05';

export function allEntries(): readonly CatalogEntry[] {
  return ENTRIES;
}

export function getEntry(id: string): CatalogEntry {
  const entry = BY_ID.get(id);
  if (!entry) throw new Error(`ID non presente nel catalogo: ${id}`);
  return entry;
}

/** Voci realizzate, filtrate su quelle effettivamente presenti nel modello. */
export function realizedEntries(availableClips: readonly string[]): CatalogEntry[] {
  const clips = new Set(availableClips);
  return ENTRIES.filter((e) => e.clip !== null && clips.has(e.clip));
}

export function plannedEntries(availableClips: readonly string[]): CatalogEntry[] {
  const clips = new Set(availableClips);
  return ENTRIES.filter((e) => e.clip === null || !clips.has(e.clip));
}

export function entriesOfKind(
  kind: EntryKind,
  availableClips: readonly string[],
): CatalogEntry[] {
  return realizedEntries(availableClips).filter((e) => e.kind === kind);
}
