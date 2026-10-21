/**
 * Palette del corpo, campionata dall'asset originale della caricatura
 * (`src/matteo_caricatura.png` del progetto Ritardometro, stesso autore, MIT):
 * i valori sono i colori dominanti delle rispettive zone, non una stima a
 * occhio, così i due progetti mostrano lo stesso personaggio.
 *
 * I colori del volto non compaiono qui: il viso è il disegno originale
 * applicato come texture.
 * I colori sono i base color del GLB: il renderer può applicare uno stile
 * diverso (toon, cel, outline) senza che il modello vada rigenerato.
 */
export const PALETTE = {
  /** Il viso è una texture: il materiale resta bianco e non tinge il disegno. */
  face: 0xffffff,
  // Stesso valore dell'incarnato in luce della texture: il collo modellato
  // prolunga quello dipinto senza che si veda la giunzione.
  skin: 0xfdab7b,
  sweater: 0x405838,
  sweaterRib: 0x304038,
  trousers: 0x3a4150,
  shoes: 0x26282e,
} as const;

export type PaletteKey = keyof typeof PALETTE;
