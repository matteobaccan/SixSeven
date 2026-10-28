# Six Seven — orientamento

Questo documento serve a ripartire a memoria piena, da un'altra macchina o dopo
settimane. Non ripete quello che si legge nel codice: raccoglie **i vincoli duri
scoperti sbattendoci contro** e il perché delle scelte, che è l'unica parte che
un file sorgente non racconta.

Quale documento risponde a quale domanda:

| domanda | documento |
|---|---|
| cosa doveva fare il gioco | `docs/SPEC.md` — la specifica originale, non modificata |
| **perché** le cose sono come sono | `docs/STATO.md`, sezione «Decisioni prese»: undici scelte con la ragione per esteso |
| cosa è fatto e cosa no | `docs/STATO.md`, criteri di accettazione e punti aperti |
| cosa non si può fare, e perché | questo documento, «I vincoli duri» |
| come si committa, costruisce, rilascia | `CLAUDE.md` e `docs/RILASCIO.md` |
| cosa serve per sostituire il modello 3D | `docs/ASSET-CONTRACT.md` |
| come si verifica nel browser | `tools/visual/README.md` |

Le decisioni in `STATO.md` sono numerate e portano la ragione, non solo
l'esito: è la parte da leggere **prima** di rimettere in discussione qualcosa,
perché quasi tutte nascono da un tentativo fallito che è ancora in cronologia.

---

## Ripresa a freddo

Il progetto è **in pausa alla 1.0.0**: tag `v1.0.0` sul commit `c265c83`,
release pubblicata, sito in linea. Niente in sospeso — nessuna pull request
aperta, nessun ramo di lavoro, nessuna modifica che viva solo in una sessione
di chat. Tutto quello che serve per ripartire è qui dentro: se una cosa non si
capisce dal repository, è un difetto di questi documenti, non qualcosa da
ricordare a memoria.

I primi dieci minuti, su una macchina qualunque con Node 22:

```bash
git clone https://github.com/matteobaccan/SixSeven.git
cd SixSeven
npm ci
npm run build     # finisce con «Tutti i controlli superati»
npm run dev       # http://localhost:5173
```

Si deve vedere l'avatar inquadrato dalla testa all'orlo del maglione, che fa una
mossa, invita, e aspetta il turno del giocatore. Telecamera e microfono chiedono
il permesso: su `localhost` il browser lo concede, altrove serve HTTPS — è un
vincolo del browser, non una scelta, e il perché sta in `docs/RILASCIO.md`.

Poi, in quest'ordine: **«I vincoli duri»** qui sotto, per sapere cosa non si può
fare prima di provarci; le **undici decisioni** di `docs/STATO.md`, per sapere
perché; i **punti aperti** dello stesso documento, per sapere dove si era
arrivati.

### Le cose che si rompono col tempo, non col codice

Un progetto fermo non resta verde da solo. Tre segnali che sembrano una
regressione e non lo sono:

- **`npm audit --audit-level=moderate`, in CI, guarda il mondo e non il
  repository.** Una vulnerabilità pubblicata dopo l'ultimo commit rende rossa
  una CI che nessuno ha toccato. È già capitato con `vite` e `tsx`, alla prima
  pull request. Non è un difetto del gioco: è un aggiornamento di dipendenze da
  fare, con la build riprovata dopo.
- **Le action sono inchiodate alla versione maggiore** (`@v7`, `@v6`, `@v5`).
  Invecchiano con avvisi di deprecazione prima di rompersi: se un workflow
  fallisce nel passo di `checkout` o di `setup-node`, è lì che si guarda, non
  nel codice.
- **Il controllo sull'avatar versionato confronta un binario con la sua
  ricostruzione.** È deterministico a dipendenze ferme; se diventa rosso senza
  che nessuno abbia toccato `tools/avatar/`, il sospetto è un aggiornamento di
  `meshoptimizer` o di `pngjs`. Si risolve rigenerando e committando
  (`npm run build:avatar`), non aggirando il controllo: quel confronto è l'unica
  cosa che tiene allineati i sorgenti dell'avatar e il binario che viene
  servito.

Per gli script che aprono un browser vero serve Playwright, che di proposito non
è una dipendenza del progetto: come si installa, e la trappola di
`npm install --no-save` che lo pota, stanno in `tools/visual/README.md`.

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

## Rilasciare

Il deploy è automatico: **ogni merge in `main` ricostruisce e pubblica** su
GitHub Pages. Non c'è un comando da dare, e il tag non c'entra — serve solo ad
avere un riferimento a cui tornare. Il procedimento completo, il ripristino e
il peso effettivo sono in `docs/RILASCIO.md`.

Da un'altra macchina servono solo Node 22 e un clone. Playwright e il browser
servono unicamente per gli script di verifica visiva, non per rilasciare.

```bash
npm ci
npm run build        # è esattamente ciò che gira in CI
git tag -a v1.2.0 origin/main -m "Six Seven 1.2.0"
git push origin v1.2.0
```

Prima di alzare la versione, quattro cose che fanno fallire la CI o escono
sbagliate, tutte già successe:

1. **Se hai toccato i sorgenti dell'avatar, rigenera e committa gli asset nello
   stesso commit.** `npm run build` li riscrive; se il file versionato non
   corrisponde, la CI lo dice e si ferma. Vale anche al contrario: non lasciare
   che uno strumento esterno li ottimizzi (vedi `.imgbotconfig`).
2. **Alza `package.json` nello stesso commit che prepara il rilascio**, non
   dopo: un tag che punta a una versione precedente è una discrepanza che salta
   fuori mesi dopo.
3. **Aggiorna i numeri del peso** in `STATO.md` e `RILASCIO.md` se il
   repertorio è cambiato: ogni clip costa una decina di kB compressa, e quei
   numeri sono invecchiati tre volte.
4. **Controlla la tabella dei criteri di accettazione** in `STATO.md`: è
   l'unico posto in cui si dichiara cosa è stato provato davvero e su cosa.

Il deploy può restare in coda diversi minuti in attesa di un runner: è normale,
è successo con attese fra i due e i nove minuti, e non è un problema del
workflow. Il lavoro vero dura una quarantina di secondi.

Il tag non si crea da qui: lo crea il workflow **Release** (Actions → Release →
*Run workflow*, senza argomenti). È nato da un limite dell'ambiente — da un
agente in container il push dei rami funziona e quello dei tag risponde `403`,
e gli strumenti GitHub disponibili hanno le sole letture su tag e release — ma
è la strada migliore comunque: il workflow rifà la build sul commit che sta per
taggare, e si ferma se `package.json` non combacia col tag o se il tag esiste
già. Il dettaglio in `docs/RILASCIO.md`.

## I numeri da tarare, e dove stanno

La taratura è il primo punto aperto, e questi sono i numeri che la riguardano.
Nessuno di loro è stato provato con una persona che si sbraccia davvero davanti
alla telecamera: sono ragionati, non misurati sul campo.

### Rilevamento del movimento — `src/sensors/PoseDetector.ts`

| costante | ora | cosa fa | sintomo se è sbagliato |
|---|---:|---|---|
| `startFactor` | 3,2 | quante volte la quiete per dichiarare l'inizio | troppo alto: non ti vede muovere. Troppo basso: parte da solo |
| `stillFactor` | 1,8 | sotto quanto si considera fermo | troppo basso: il turno non finisce mai |
| `minStart` | 0,012 | soglia minima assoluta | protegge dalla quiete misurata a zero, in stanze molto buie |
| `stillnessMs` | 900 | quanto deve durare l'immobilità | troppo alto: il turno si trascina |
| `startFrames` | 2 | fotogrammi consecutivi sopra soglia | **non abbassarlo** senza leggere la nota sui fotogrammi duplicati |
| `sampleHz` | 20 | frequenza di analisi | più alto non aiuta: conta la frequenza della telecamera |

### Reazione sonora — `src/sensors/AudioReactionAnalyzer.ts`

| costante | ora | cosa fa | sintomo |
|---|---:|---|---|
| `mediumDb` | 6 | guadagno sul fondo per entrare in MEDIUM | l'indicatore a schermo mostra le tacche: se urlando resti sotto la prima, va abbassato |
| `highDb` | 14 | guadagno per entrare in HIGH | se la barra sfonda sempre il fondo scala, vanno alzati entrambi |
| `floorRisePerSecond` | 0,25 | quanto in fretta il fondo insegue verso l'alto | alzarlo riporta il difetto del fondo gonfiato dal giocatore |

### Aura — `src/game/Aura.ts`

| costante | ora | cosa fa |
|---|---:|---|
| `AURA_START` | 60 | valore iniziale |
| `AURA_STEP` | 10 | spostamento massimo per turno. **Deve dividere `AURA_MAX`**: la barra è divisa in tacche da un passo, una per turno |
| `AGITATION_WEIGHT` | 0,45 | quanto pesa l'agitazione rispetto all'approvazione del pubblico |

Con i valori attuali una partita dura fra i quattro e gli otto turni.

### Tempi del gioco — `src/game/GameStateMachine.ts`, `DEFAULT_CONFIG`

`invitationMs` 900, `playerTurnMs` 12 000, `stillnessFallbackMs` 6 000,
`beatMs` 600, `samplingMs` 1 500, `nextTurnMs` 900. Sono tutti timer dichiarati
dalla macchina: `npm run check:game` li fa scattare a comando, quindi cambiarli
non rompe i controlli.

## Da dove ripartire

Per ciascun punto aperto, la prima mossa concreta:

1. **Taratura.** Giocare una partita vera guardando l'indicatore della voce e la
   barra del movimento, e annotare dove stanno rispetto alle tacche. Poi toccare
   i numeri della tabella qui sopra — uno alla volta, perché si influenzano.
2. **Scambio della texture del viso.** Serve prima il disegno: la caricatura con
   un'espressione diversa, stesse dimensioni e stessa griglia di
   `tools/avatar/face-source.png`. Il meccanismo nel renderer è poca cosa:
   `AvatarRenderer` già sostituisce il materiale del viso, basta poter cambiare
   la mappa a clip in corso.
3. **Striscia di pantaloni.** Decisione, non codice: abbassare `HEM_FRACTION` in
   `AvatarRenderer` — e la striscia si vede sempre — oppure ridurre i
   sollevamenti `hips` nelle clip, smorzandole.
4. **Nuove mosse.** Partire da `tools/visual/moves.mjs` per vedere il repertorio
   affiancato: il criterio è la **sagoma** e l'**altezza**, non l'idea. Ogni
   clip costa una decina di kB compressa.

## Lavorare con git su questo repository

Lo sviluppo passa da rami `claude/*`, con il deploy agganciato al merge in
`main`. Due trappole, entrambe già scattate:

- **Prima di ripartire da `main`, controllare che il ramo non porti commit non
  ancora mergiati.** `git checkout -B <ramo> origin/main` li scarta in silenzio,
  e un force-push li cancella anche dal remoto. Si recuperano con
  `git log --oneline origin/main..origin/<ramo>` *prima* di resettare, o con un
  `cherry-pick` dopo, se ci si accorge in tempo.
- **La cancellazione di un ramo mergiato, da un agente in container, può essere
  bloccata** dall'ambiente: va fatta a mano, o dal bottone che GitHub mostra
  sulla pull request appena unita. Prima di cancellare, la verifica che il
  ramo non porti niente di nuovo è `git diff origin/main origin/<ramo>` vuoto —
  più solida di `--merged`, che risponde sulla cronologia e non sul contenuto.

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
