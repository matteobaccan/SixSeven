# Six Seven — orientamento

Questo documento serve a ripartire a memoria piena, da un'altra macchina o dopo
settimane. Non ripete quello che si legge nel codice: raccoglie **i vincoli duri
scoperti sbattendoci contro** e il perché delle scelte, che è l'unica parte che
un file sorgente non racconta.

Le regole operative stanno in `CLAUDE.md` (commit, build, asset). Lo stato
puntuale e i punti aperti in `docs/STATO.md`. La specifica originale in
`docs/SPEC.md`. Qui c'è l'orientamento.

---

## Cos'è

Un gioco web mobile-first: un avatar 3D caricaturale esegue una mossa ispirata al
meme *6-7*, invita il giocatore a rifarla davanti alla telecamera, stima quando
ha finito e reagisce in base al rumore raccolto. Dodici mosse, nove reazioni,
un'aura che decide chi vince.

In linea su <https://matteobaccan.github.io/SixSeven/>, pubblicato a ogni merge
in `main`.

## L'avatar è un ibrido, e non per scelta estetica

**Il volto è la caricatura originale applicata come texture** a una superficie
curva; **il corpo è 3D riggato**. Il primo tentativo modellava anche la faccia
accostando primitive: il confronto con il disegno era impietoso, ed è in
cronologia. Le mani invece devono essere vero 3D, perché le mosse *sono* gesti.

**La testa è staccata dal corpo e non ha collo.** Il trucco del burattino
risolve in un colpo tre problemi: il colletto della camicia dipinto nella
caricatura, l'ombra sospesa sotto la mascella, e la giunzione fra disegno e
geometria. Da qui discendono quasi tutti i limiti elencati sotto.

## I vincoli duri

Questi non sono preferenze: sono misure. Ignorarli significa rifare il lavoro.

### Inquadratura

L'inquadratura è un primo piano con il **bordo inferiore inchiodato all'orlo del
maglione** (`HEM_FRACTION` in `AvatarRenderer`), perché sotto ci sono le gambe,
che sono la parte meno riuscita del modello.

- **Un braccio allargato di lato esce dal campo.** Il `fov` di three è verticale:
  la larghezza inquadrata vale `altezza × aspect`, e su un telefono — soprattutto
  dentro un'app, che toglie spazio sopra e sotto — non ci sta un busto con le
  braccia aperte. I gesti alti devono salire **in diagonale, accompagnati dalla
  torsione del busto**, che è ciò che li riporta dentro la sagoma. Ci sono
  cascato due volte: `SixFootSeven` e `MindBlown`.
- **La distanza si misura dal piano del soggetto**, non dalla sua faccia
  anteriore. Sommare l'intera profondità allontana la camera oltre il calcolo.
- Le clip che **alzano il bacino** scoprono una striscia di pantaloni di pochi
  pixel. Noto, non risolto: le due vie costano entrambe qualcosa.

### Portata del braccio

Spalla a **1,268**, due segmenti da **0,278**: la punta delle dita arriva a circa
**1,92**. Gli occhi del disegno stanno fra **1,95 e 2,05**. Quindi **la mano non
raggiunge gli occhi**, e il facepalm non è realizzabile — una mano che si ferma
al mento legge come un gesto pensieroso. È il prezzo del burattino: testa grande
e sospesa in alto, braccio di un corpo normale.

### Il viso è un disegno

Gli unici controlli espressivi sono a zone: palpebre, sopracciglia, mascella.
**La mascella non apre la bocca** — a 18° il sorriso disegnato resta identico,
l'osso stira appena il basso viso. Quindi:

- niente bocca spalancata, niente linguaccia, niente sguardo che si sposta;
- niente Blue Steel e simili: vivono tutti nella bocca.

Si sbloccherebbero con un **meccanismo di scambio della texture del viso** (una
modifica piccola al renderer) più almeno un secondo disegno allineato alla stessa
griglia. Il disegno è l'unica parte che non si può ricavare dal codice.

La testa regge rotazioni fino a **circa 30°**: oltre, la natura piatta si vede.

### Nei gesti conta la sagoma, non il dettaglio

Il criterio emerge rendendo le mosse una accanto all'altra con
`tools/visual/moves.mjs`: **le mani a dita aperte si riconoscono, quelle chiuse
su sé stesse no.** Il gesto italiano costruito a pigna leggeva come «si gratta il
mento», perché a 393 punti di larghezza i polpastrelli che convergono occupano
una quindicina di pixel. Il testone caricaturale peggiora il confronto, perché
toglie scala a tutto il resto.

Corollario, con dodici mosse: il rischio non è più la ripetizione ma la
**somiglianza**. Tre gesti «mani alte e dita aperte» leggono uguali a prescindere
dal ritmo, quindi il repertorio va tenuto bilanciato per **altezza** — basso al
petto, medio al mento, alto alla testa.

## Architettura

Sette moduli, con una separazione che la specifica chiede (§8.2) e che va
rispettata perché è ciò che rende provabile la logica senza browser.

```
src/game/GameStateMachine.ts   turni ed eventi — NON conosce Three.js,
                               telecamera né Web Audio
src/game/Aura.ts               punteggio e fine partita — stessa regola
src/avatar/                     resa, animazioni, aura disegnata
src/sensors/                    telecamera e microfono
src/ui/UIController.ts          DOM
src/main.ts                     collante: intenti → moduli, eventi → macchina
tools/avatar/                   pipeline che genera il GLB
tools/visual/                   verifica nel browser
```

La macchina riceve **eventi normalizzati** ed emette **intenti**. Tutte le attese
sono timer che dichiara lei e che riceve dall'esterno: nei controlli si fanno
scattare a comando. Non ci sono `setTimeout` sparsi nella logica.

## Come si verifica, e perché serve il browser

```bash
npm run build          # avatar + typecheck + check:naming + check:game + bundle
npm run check:game     # logica dei turni e aura, con timer finti
```

`npm run build` è esattamente quello che gira in CI: un push che fallisce in CI è
un push che non era stato provato.

**Ma i controlli headless non bastano, e questo è il punto che conta.** Le cose
che si sono rotte davvero in questo progetto sono passate tutte da un browser
vero, con la build verde:

| difetto | come si manifestava | chi l'ha preso |
|---|---|---|
| avatar tagliato ai lati | solo su schermo stretto | `viewport.mjs` |
| aura invisibile | fusione additiva su fondo crema | `aura.mjs` |
| interfaccia che non partiva | `id` nel codice, assente nell'HTML | `smoke.mjs` |
| avatar senza testa | `prune` toglieva la carta del viso | `frame.mjs` |
| movimento mai rilevato | telecamera sotto i 20 fps | `motion.mjs` |

Gli script stanno in `tools/visual/`, con il loro README. Playwright **non** è
una dipendenza: si installa a parte, e `CHROMIUM_PATH` punta a un browser già
presente.

## I difetti trovati nei sensori, che tornerebbero facilmente

Tre, tutti invisibili ai controlli headless e tutti scambiabili per «soglie da
tarare». Se qualcosa non funziona nei sensori, guardare prima qui.

1. **Si analizzano i fotogrammi, non i tick.** Il campionamento gira a 20 Hz, ma
   una telecamera può consegnare meno: analizzando a ogni tick, un campione su
   due confrontava due fotogrammi identici e misurava zero. Siccome
   `startFrames` chiede campioni **consecutivi** sopra soglia, l'inizio del gesto
   non veniva mai dichiarato. Ora `sample` salta i fotogrammi già visti.
2. **Il rumore di fondo si congela durante il turno del giocatore.** Inseguirlo
   mentre è lui a fare rumore lo alza fin quasi al suo livello: con la costante
   di salita di 0,25/s, dodici secondi bastano a coprire il 95% della distanza, e
   il campionamento successivo classificava `low` anche una reazione forte.
3. **L'`AudioContext` si riprende all'avvio**, non al primo campionamento. Nasce
   dopo un `await`, quindi fuori dal gesto dell'utente, e su iOS può restare
   sospeso: finché lo è il segnale è muto e il fondo viene stimato sul silenzio.

L'immobilità si giudica da `movementSeen`, **non** dall'agitazione misurata:
quella dice quanto è stato ampio il gesto e può non arrivare affatto. Per questo
è `number | null` e non un numero con lo zero come ripiego.

## L'aura

Risorsa dell'avatar, non punteggio del giocatore: è ciò che permette un conteggio
senza trasformare una sfida comica in una gara. Parte a 60 su 100, passo di 10 —
che **divide esattamente il massimo**, così la barra si divide in dieci tacche da
un turno ciascuna e quanti ne restano si vede invece di calcolarlo.

A zero vince il giocatore; al massimo nessuno ha ribattuto e l'avatar se la gode.
Una partita dura fra i quattro e gli otto turni.

## Asset: generati ma versionati

`public/assets/avatar.glb` e `face.png` sono prodotti da `tools/avatar/` e
committati, perché `npm run dev` funzioni senza rigenerarli. La build è
**deterministica**, e la CI confronta il file versionato con una ricostruzione.

Conseguenze che mordono:

- chi tocca i sorgenti dell'avatar **rigenera e committa nello stesso commit**;
- **nessuno strumento esterno deve ottimizzare quei file.** ImgBot ci ha provato
  (pull request #6) e la CI è andata rossa: la sua ottimizzazione viene
  sovrascritta al primo rigenero. `.imgbotconfig` ora lo esclude, e il risparmio
  è stato preso dentro `face-texture.ts`, dove sopravvive;
- la compressione del GLB (`compress:avatar`) **non deve potare**: `prune`
  rimuove la carta del viso, che dall'interno del documento glTF sembra
  inutilizzata perché il materiale glielo mette il renderer a runtime.

Primo caricamento: circa **800 kB in transito**. Misurato, non stimato — il
dettaglio è in `docs/RILASCIO.md`. Ogni clip aggiunta al repertorio costa una
decina di kB compressa: va messo in conto.

## Decisioni da non rimettere in discussione senza motivo

Sono in `docs/STATO.md` con le ragioni per esteso. In sintesi: modello generato
da codice e non scolpito; testa a burattino; viso disegnato e corpo modellato;
espressioni a bone e non morph target; stile nel renderer e non nella texture;
contorni per rilevamento di bordi e non inverted hull; rilevamento per differenza
fra fotogrammi; soglie autotaranti e non assolute; repertorio consumato come un
mazzo; aura al posto del punteggio; niente Rust.

## Cosa resta aperto

Aggiornato in `docs/STATO.md`. I tre che contano:

1. **Prova su dispositivo reale** con una persona davanti alla telecamera: è
   l'unico criterio di accettazione non spuntato, e l'unica cosa che può dire se
   le soglie sono tarate bene. Tutto il resto è rifinitura.
2. **Scambio della texture del viso**, che sbloccherebbe bocca e sguardo.
   Aspetta un disegno.
3. **Striscia di pantaloni** nelle mosse che alzano il bacino: decisione fra due
   rimedi che costano entrambi qualcosa.

## Lingua

Codice, commenti, messaggi di commit e documentazione in italiano.
`README.en.md` è l'unico documento in inglese.
