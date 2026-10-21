/**
 * Palette campionata dall'asset originale della caricatura
 * (`src/matteo_caricatura.png` del progetto Ritardometro, stesso autore, MIT):
 * i valori sono i colori dominanti delle rispettive zone, non una stima a
 * occhio, così i due progetti mostrano lo stesso personaggio.
 * I colori sono i base color del GLB: il renderer può applicare uno stile
 * diverso (toon, cel, outline) senza che il modello vada rigenerato.
 */
export const PALETTE = {
  skin: 0xf8a878,
  skinDark: 0xf09070,
  ear: 0xf59878,
  // La punta del naso nella caricatura è nettamente più rossa del resto.
  nose: 0xf88868,
  browHair: 0x503028,
  eyeWhite: 0xfbfaf6,
  pupil: 0x1a1412,
  mouth: 0xe86058,
  teeth: 0xf7f4ee,
  sweater: 0x405838,
  sweaterRib: 0x304038,
  shirtWhite: 0xf0f0f0,
  shirtBlue: 0x608490,
  shirtPurple: 0x60546c,
  // Il viso è una texture: il materiale resta bianco e non tinge il disegno.
  face: 0xffffff,
  trousers: 0x3a4150,
  shoes: 0x26282e,
  outline: 0x0b0b0b,
} as const;

export type PaletteKey = keyof typeof PALETTE;

/** Materiali distinti esportati nel GLB, uno per primitive. */
export const MATERIAL_KEYS: PaletteKey[] = [
  'skin',
  'skinDark',
  'ear',
  'nose',
  'browHair',
  'face',
  'eyeWhite',
  'pupil',
  'mouth',
  'teeth',
  'sweater',
  'sweaterRib',
  'shirtWhite',
  'shirtBlue',
  'shirtPurple',
  'trousers',
  'shoes',
];
