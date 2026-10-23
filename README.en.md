# Six Seven

*[Italiano](README.md) · [English](README.en.md)*

### ▶ [Play now: matteobaccan.github.io/SixSeven](https://matteobaccan.github.io/SixSeven/)

An interactive web app with a 3D avatar: a cartoon character performs a move
inspired by the *Six Seven* meme and invites the player to copy it in front of
the camera.

The avatar is a hybrid: a **rigged 3D body** — needed for the gestures — and a
**face taken from the original caricature**, applied as a texture to a curved
surface and animated through influence zones (eyelids, eyebrows, jaw).

**Status: playable.** Seventeen animations, alternating turns, end-of-move
detection from the camera, and reactions chosen from how much noise the player
makes. The screen shows what the application hears and sees: a camera preview with a
motion indicator, and a voice level with the thresholds marked, so you can tell
whether the noise was enough.

The avatar has an **aura**, drawn behind him: it rises or falls each turn
according to how much the player moves and how loudly the audience approves. At
zero the player wins; at maximum nobody answered back, and the avatar is
delighted. What remains is testing on real devices — see `docs/STATO.md`.

![status](https://img.shields.io/badge/status-playable-40703a)
![licence](https://img.shields.io/badge/licence-MIT-blue)

> The documentation under `docs/` is written in Italian: it carries the project
> specification and the reasoning behind each decision, and translating it would
> mean maintaining two sources of truth. This file is the English entry point.

## Quick start

```bash
npm install
npm run build:avatar   # generates public/assets/avatar.glb
npm run dev            # http://localhost:5173
```

The GLB is committed to the repository, so `npm run dev` works without
regenerating it.

**Camera and microphone require HTTPS** (or `localhost`): that is a browser
rule, not a choice of this project. Without them the start screen still offers
to play without devices, and turns advance on a timer instead.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | development server |
| `npm run build:avatar` | builds mesh, skeleton and clips, writes `public/assets/avatar.glb` |
| `npm run typecheck` | type checking (app and tools as separate projects) |
| `npm run check:naming` | verifies bone-name remapping |
| `npm run check:game` | verifies the turn logic, with fake timers |
| `npm run build` | avatar + typecheck + checks + production bundle in `dist/` |
| `npm run preview` | serves the production bundle |

## Structure

```
src/
  avatar/
    AvatarRenderer.ts     scene, lights, camera, GLB loading, toon shading
    ToonLinePass.ts       drawn outlines (edge detection in a post pass)
    AnimationController.ts clip playback and transitions
    IdleLife.ts           continuous micro-motion: blinks, gaze, breathing
    AuraHalo.ts           the aura drawn behind the character
  assets/
    AssetCatalog.ts       spec IDs -> model clips plus metadata
    AvatarContract.ts     expected bone and clip names, checked against the model
    BoneNaming.ts         name remapping for third-party rigs
  game/
    GameStateMachine.ts   turns and events, with no browser or sensor dependency
    Aura.ts               the avatar's score and the end-of-match conditions
  sensors/
    PoseDetector.ts       end of move, by frame differencing
    AudioReactionAnalyzer.ts  loudness of the player's reaction
  ui/UIController.ts      permissions, controls, turn state, diagnostics
  main.ts                 the glue: state-machine intents -> concrete modules

tools/                    avatar production pipeline (not part of the bundle)
  visual/                 browser checks: framing, aura, moves, sensors
  build-avatar.ts         orchestrator: assembles and exports the GLB
  avatar/rig.ts           skeleton and rest pose
  avatar/mesh.ts          character geometry
  avatar/clips.ts         animations as lists of poses
  avatar/timeline.ts      compiler: poses -> smooth curves
  avatar/palette.ts       colours, sampled from the reference caricature

docs/                     (in Italian)
  SPEC.md                 project specification 0.1
  STATO.md                what is built, decisions taken, open points
  ASSET-CONTRACT.md       what a replacement 3D model must provide
  RILASCIO.md             how it is published and how to roll back
```

## How it works

**The game loop.** `GameStateMachine` implements the turn states without
knowing anything about Three.js, the camera or Web Audio: it takes normalised
events and emits intents. Every wait is a timer the machine declares and the
outside supplies, which is what makes the whole loop testable headlessly —
`npm run check:game` drives it through a full turn and every fallback path.

**The animations** are written as lists of poses in degrees and resampled at
build time to 32 Hz with per-segment easing, because glTF only carries linear
interpolation and sparse poses read as mechanical. A procedural layer runs on
top of whichever clip is playing — blinks, eye saccades, breathing, head drift —
so it applies to any animation added later, too.

**The aura** is the avatar's own resource, not the player's score. It starts at
60 out of 100 and moves each turn on two measurements the sensors already make:
how much the player moved, and how loudly the audience approved. The two endings
are deliberately opposite — at zero the player has dismantled the avatar and
wins, at maximum nobody answered back and the avatar revels in it. The counter
lives in `src/game/Aura.ts`, apart from the state machine and, like it, free of
browser dependencies.

**The sensors** need no downloaded models and work offline. Motion is measured
by comparing consecutive frames reduced to a 48×36 grid; audio derives RMS and
peak against a continuously tracked noise floor. In both cases the thresholds
are multiples of a measured reference rather than absolute values, because a
fixed threshold would depend on lighting, sensor noise, distance and frame rate.

**Privacy.** Video and audio are never recorded and never leave the device. All
that is kept of the video is a grid of luminance values, overwritten on every
pass; of the audio, three numbers.

## Replacing the 3D model

The model is an asset, not code: replace `public/assets/avatar.glb`, respecting
the bone and clip names described in `docs/ASSET-CONTRACT.md`. Third-party rigs
that use different names (Mixamo, Rigify, CC0 packs) are mapped back to the
canonical names automatically. On startup the application compares the model
against the contract and reports in the diagnostics panel what it recognised.

## Publishing

The game is live at **<https://matteobaccan.github.io/SixSeven/>**: every merge
into `main` rebuilds and republishes it. Camera and microphone require HTTPS — a
browser rule, not a project choice — which is why locally they only work on
`localhost`. The full procedure, the one-time setup and the real weight of the
first load are in `docs/RILASCIO.md`.

## Licence

MIT — see `LICENSE`.

## Credits

The avatar's face and colour palette come from the caricature in
[Ritardometro](https://github.com/matteobaccan/Ritardometro), by the same
author and also MIT. The original is `tools/avatar/face-source.png`;
`public/assets/face.png` is the build's processed version of it.
