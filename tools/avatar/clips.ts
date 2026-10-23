/**
 * Indice delle clip dell'avatar.
 *
 * Le animazioni vivono in `clips-moves.ts` (mosse S7-xx) e
 * `clips-reactions.ts` (reazioni RX-xx); le pose condivise in `poses.ts`.
 * I nomi delle clip sono il contratto con il motore: `src/assets/AssetCatalog.ts`
 * vi associa gli identificatori della specifica.
 */
import type * as THREE from 'three';
import {
  classicWeighing,
  extremeSixSeven,
  fingerSixSeven,
  handshake67,
  mindBlownMove,
  reverseWeighing,
  sixFootSeven,
  sixSevenKid,
  threePointer,
  toDiWorldMove,
  whatDoYouWantMove,
} from './clips-moves.ts';
import {
  celebration,
  disappointed,
  idle,
  sixSevenFace,
  taunt,
  turnTransition,
} from './clips-reactions.ts';

export function buildClips(): THREE.AnimationClip[] {
  return [
    idle(),
    classicWeighing(),
    reverseWeighing(),
    fingerSixSeven(),
    handshake67(),
    extremeSixSeven(),
    toDiWorldMove(),
    sixFootSeven(),
    threePointer(),
    sixSevenKid(),
    whatDoYouWantMove(),
    mindBlownMove(),
    sixSevenFace(),
    taunt(),
    celebration(),
    disappointed(),
    turnTransition(),
  ];
}
