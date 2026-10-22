/**
 * Aura — il punteggio dell'avatar.
 *
 * L'aura è una risorsa che appartiene all'avatar, non al giocatore: parte a
 * metà strada e si muove a ogni turno in base a come il giocatore ha risposto
 * alla mossa. Chi fa la mossa migliore si misura su due cose, entrambe già
 * rilevate dai sensori: **l'agitazione**, cioè quanto il giocatore si è mosso
 * davanti alla telecamera, e **l'approvazione del pubblico**, cioè il rumore
 * raccolto dal microfono.
 *
 * Le due condizioni di fine partita sono opposte e volute:
 *  - aura a zero: il giocatore ha smontato l'avatar e ha vinto;
 *  - aura al massimo: il giocatore non ha giocato, e l'avatar se la gode.
 *
 * Come `GameStateMachine`, questo modulo non conosce browser né sensori:
 * riceve due numeri normalizzati e restituisce un verdetto. È quello che
 * permette di provarne il comportamento senza telecamera (spec 8.2).
 */
import type { ReactionLevel } from './GameStateMachine.ts';

export type AuraWinner = 'player' | 'avatar';

/** Valore massimo dell'aura: raggiunto, la partita finisce. */
export const AURA_MAX = 100;
/** Valore iniziale: a metà strada, così entrambi gli esiti sono raggiungibili. */
export const AURA_START = 60;
/** Spostamento massimo in un turno solo. */
export const AURA_STEP = 15;

/** Peso dell'approvazione del pubblico per livello. */
const APPROVAL: Record<ReactionLevel, number> = {
  high: 1,
  medium: 0.6,
  low: 0.15,
  unknown: 0.5,
};

/**
 * Quanto conta l'agitazione rispetto all'approvazione. Il pubblico pesa un po'
 * di più perché è un giudizio, mentre l'agitazione misura solo l'impegno: si
 * può agitare le braccia senza strappare un applauso.
 */
const AGITATION_WEIGHT = 0.45;

export interface Performance {
  /**
   * Quanto si è mosso il giocatore, da 0 a 1, oppure `null` se la misura non
   * è arrivata. Distinguere «fermo» da «non misurato» è necessario: senza la
   * distinzione, un turno in cui il rilevamento non ha riportato valori
   * verrebbe scambiato per un giocatore che non ha giocato.
   */
  agitation: number | null;
  /** Approvazione del pubblico, dal campionamento audio. */
  approval: ReactionLevel;
  /** Se la telecamera stava effettivamente guardando. */
  watched: boolean;
  /** Se il rilevamento ha visto partire il movimento. */
  moved: boolean;
}

export type AuraReason = 'inattivo' | 'superato' | 'pari' | 'battuto';

export interface AuraVerdict {
  /** Aura dopo il turno. */
  value: number;
  /** Spostamento applicato: negativo se il giocatore ha fatto meglio. */
  delta: number;
  /** Resa del giocatore, da 0 a 1: serve all'interfaccia. */
  performance: number;
  /** Chi ha vinto la partita, se è finita. */
  winner: AuraWinner | null;
  reason: AuraReason;
}

const clamp01 = (n: number): number => (n < 0 ? 0 : n > 1 ? 1 : n);
const clampAura = (n: number): number => (n < 0 ? 0 : n > AURA_MAX ? AURA_MAX : n);

/**
 * Resa del giocatore nel turno, da 0 a 1. Senza telecamera l'agitazione non è
 * misurabile: in quel caso conta solo il pubblico, invece di dare per scontato
 * che il giocatore sia stato fermo.
 */
export function performanceOf(p: Performance): number {
  const approval = APPROVAL[p.approval];
  if (!p.watched || p.agitation === null) return approval;
  const agitation = clamp01(p.agitation);
  return AGITATION_WEIGHT * agitation + (1 - AGITATION_WEIGHT) * approval;
}

export class AuraMeter {
  private current: number;

  constructor(start: number = AURA_START) {
    this.current = clampAura(Math.round(start));
  }

  get value(): number {
    return this.current;
  }

  /** Frazione dell'aura sul massimo, da 0 a 1: comoda per la resa grafica. */
  get ratio(): number {
    return this.current / AURA_MAX;
  }

  get winner(): AuraWinner | null {
    if (this.current <= 0) return 'player';
    if (this.current >= AURA_MAX) return 'avatar';
    return null;
  }

  reset(start: number = AURA_START): void {
    this.current = clampAura(Math.round(start));
  }

  /**
   * Applica il turno e restituisce il verdetto.
   *
   * Il caso speciale è l'immobilità: se la telecamera guardava e non ha visto
   * partire nulla, il giocatore ha rinunciato, e l'aura sale del massimo
   * possibile qualunque cosa dica il microfono. Senza quel caso, un applauso
   * di sottofondo basterebbe a far scendere l'aura di chi non ha mosso un dito.
   *
   * Il giudizio sull'immobilità si fonda su `moved`, non sull'agitazione
   * misurata: è il rilevamento a dire se il movimento è partito, mentre
   * l'agitazione dice soltanto quanto è stato ampio.
   */
  apply(p: Performance): AuraVerdict {
    const idle = p.watched && !p.moved;
    const performance = idle ? 0 : performanceOf(p);

    // 0.5 è il punto di equilibrio: sopra, il giocatore erode l'aura.
    const delta = idle ? AURA_STEP : Math.round((0.5 - performance) * 2 * AURA_STEP);

    this.current = clampAura(this.current + delta);

    return {
      value: this.current,
      delta,
      performance,
      winner: this.winner,
      reason: idle ? 'inattivo' : delta < 0 ? 'superato' : delta > 0 ? 'battuto' : 'pari',
    };
  }
}
