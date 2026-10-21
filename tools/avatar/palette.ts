/**
 * Palette ricavata dalla caricatura di riferimento (docs/reference-avatar.md).
 * I colori sono i base color del GLB: il renderer può applicare uno stile
 * diverso (toon, cel, outline) senza che il modello vada rigenerato.
 */
export const PALETTE = {
  skin: 0xf2a479,
  skinDark: 0xe08c60,
  ear: 0xeb9d72,
  nose: 0xf0a176,
  browHair: 0x4a3122,
  ink: 0x3a2a20,
  eyeWhite: 0xfbfaf6,
  pupil: 0x241a14,
  mouth: 0x8c4436,
  teeth: 0xf7f4ee,
  sweater: 0x40703a,
  sweaterRib: 0x335a2d,
  shirtWhite: 0xf0efea,
  shirtBlue: 0x7b9bc6,
  shirtPurple: 0x9185c2,
  trousers: 0x3a4150,
  shoes: 0x26282e,
  outline: 0x141414,
} as const;

export type PaletteKey = keyof typeof PALETTE;

/** Materiali distinti esportati nel GLB, uno per primitive. */
export const MATERIAL_KEYS: PaletteKey[] = [
  'skin',
  'skinDark',
  'ear',
  'nose',
  'browHair',
  'ink',
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
