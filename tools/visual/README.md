# Verifica visiva

`npm run check:game` e `npm run check:naming` provano la logica senza browser, e
sono i controlli che girano in CI. Non coprono però ciò che si è rotto davvero
in questo progetto:

- l'avatar tagliato ai lati sul telefono, perché il `fov` di three è verticale e
  la larghezza inquadrata dipende dal rapporto della scena;
- l'aura invisibile, perché la fusione additiva su un fondo chiaro satura verso
  il bianco;
- l'interfaccia che non partiva affatto, per un `id` registrato nel codice ma
  assente nell'HTML — con la build che passava lo stesso.

Tutte e tre passano per un browser vero. Questi script sono il modo per vederle.

## Prerequisiti

Playwright **non** è una dipendenza del progetto: scaricherebbe un browser a
ogni `npm install` e a ogni run di CI, per un valore che su una pipeline senza
schermo è minore. Si installa a parte, una volta:

```bash
npm install --no-save playwright
npx playwright install chromium
```

Poi serve il sito in ascolto, di solito il bundle di produzione:

```bash
npm run build && npm run preview    # http://localhost:4173
```

Tutti gli script accettano l'indirizzo come primo argomento e scrivono le
immagini in `tools/visual/out/`, che non è versionata.

Se sulla macchina c'è già un Chromium — tipico di un container predisposto — lo
si usa senza scaricarne un altro:

```bash
CHROMIUM_PATH=/percorso/a/chrome node tools/visual/smoke.mjs
```

## Gli script

| Comando | A cosa serve |
| --- | --- |
| `node tools/visual/smoke.mjs` | gioca due turni con telecamera e microfono finti; fallisce su qualunque errore in console |
| `node tools/visual/viewport.mjs` | inquadratura e ingombro del pannello a quattro misure, browser dentro un'app compreso |
| `node tools/visual/requests.mjs` | verifica che le risorse statiche escano con `?v=` |
| `node tools/visual/moves.mjs` | pose chiave di ogni mossa, per vedere se si distinguono |
| `node tools/visual/frame.mjs [clip] [secondi]` | un fotogramma a dimensione piena |
| `node tools/visual/aura.mjs` | l'aura ai tre livelli e la schermata di fine partita |
| `node tools/visual/motion.mjs` | rilevamento del movimento con un canvas animato al posto della telecamera |
| `node tools/visual/audio.mjs` | che cosa sente il microfono: contesto attivo, segnale, fondo congelato nel turno del giocatore |

`smoke`, `requests`, `motion` e `audio` escono con codice diverso da zero quando
falliscono: si possono incatenare. Gli altri producono immagini da guardare, e
il giudizio resta umano.

`motion` e `audio` hanno tre esiti invece di due: `0` coerente, `1` rilevatore incoerente,
`2` **inconcludente** — la sorgente sintetica non ha prodotto movimento perché
in quel browser `captureStream()` non aggiorna il video. Distinguere il secondo
dal terzo non è pedanteria: senza quella distinzione un difetto della sorgente
verrebbe riportato come un difetto del rilevatore, che è il modo più veloce per
smettere di fidarsi di un controllo.

## Una nota sulla fragilità

`motion.mjs` tocca campi privati di `PoseDetector`, e `aura.mjs` pilota
`halo` e `ui` dall'oggetto `window.sixSeven`. È il prezzo per provare questi
comportamenti senza aprire le classi solo per i test; in cambio, quando un
rinominamento li rompe, il fallimento è esplicito invece che silenzioso.
