# Six Seven — Web App interattiva con avatar 3D

**Versione:** 0.1 — Specifica iniziale
**Stato:** Bozza di progetto
**Piattaforma:** Web App, mobile-first
**Destinatari:** sviluppatori, technical designer, coding agent

**Obiettivo:** realizzare un gioco basato sul meme Six Seven, in cui una persona
reale si sfida con un avatar cartoon 3D ispirato alla caricatura del creatore.

---

## 1. Visione del prodotto

Six Seven è un gioco interattivo in cui un avatar 3D esegue una serie di mosse
ispirate al meme Six Seven e invita il giocatore a riprodurle. Il giocatore
osserva l'animazione dell'avatar, imita il gesto davanti alla telecamera e
conclude il proprio turno. L'avatar osserva simbolicamente l'esecuzione,
reagisce in modo ironico e propone una nuova mossa.

Il gioco deve trasmettere la sensazione di una sfida comica tra una persona
reale e un personaggio virtuale.

### Principi fondamentali

- L'avatar deve essere riconoscibile come una caricatura del creatore.
- Il personaggio deve essere animato realmente in 3D, non una sequenza di
  immagini statiche.
- Le animazioni devono essere esagerate, fluide e divertenti.
- La telecamera serve a rilevare il movimento del giocatore e stimare quando ha
  terminato la mossa.
- Il microfono serve a misurare le reazioni sonore delle persone vicine.
- Il gioco deve funzionare nel browser, senza installare applicazioni native.
- Il repertorio delle mosse deve essere estendibile senza modificare il motore
  di gioco.

## 2. Ambito del progetto

### 2.1 Funzionalità incluse nella prima versione

1. Visualizzazione dell'avatar 3D.
2. Riproduzione delle animazioni dell'avatar.
3. Alternanza dei turni tra avatar e giocatore.
4. Acquisizione video per il rilevamento dei movimenti.
5. Rilevamento automatico della fine della mossa tramite immobilità relativa.
6. Acquisizione audio per misurare il livello di reazione ambientale.
7. Animazioni di risposta dell'avatar in funzione degli eventi.
8. Interfaccia utilizzabile da smartphone e tablet.
9. Gestione dei permessi e fallback in caso di indisponibilità di camera o
   microfono.

### 2.2 Funzionalità escluse dalla prima versione

- Riconoscimento semantico di tutte le mosse Six Seven.
- Valutazione precisa della correttezza del gesto.
- Riconoscimento vocale e trascrizione delle conversazioni.
- Classifiche online e account utente.
- Multiplayer remoto.
- Backend obbligatorio per l'esecuzione del gioco.
- Generazione AI in tempo reale delle animazioni.

Queste funzionalità potranno essere valutate successivamente.

## 3. Avatar 3D

### 3.1 Riferimento visivo

Il riferimento iniziale è la caricatura fornita dal committente.
Caratteristiche da mantenere, quando possibile: testa calva; sopracciglia
marcate; naso pronunciato; espressione ironica; maglione verde; camicia a righe
con colletto; proporzioni caricaturali.

La somiglianza esatta non è un requisito bloccante. La priorità è ottenere un
personaggio coerente, espressivo e divertente.

### 3.2 Requisiti del modello

Il personaggio deve essere un modello 3D riggato, con: mesh deformabile;
scheletro articolato; articolazioni per spalle, gomiti, polsi e dita;
articolazioni per collo, busto e gambe; controlli o shape key per le espressioni
facciali; materiali e texture compatibili con il rendering web; animazioni
riutilizzabili e indipendenti dalla logica di gioco.

Il modello deve consentire movimenti ampi delle braccia senza deformazioni
visivamente anomale.

### 3.3 Formato e produzione

Formato di distribuzione preferito: glTF 2.0 / GLB. Blender può essere
utilizzato per modellazione, rigging, materiali e animazioni. Eventuali
strumenti di generazione automatica 3D sono ammessi, ma il risultato deve essere
verificato e corretto prima dell'integrazione.

Il modello 3D e le animazioni costituiscono asset del progetto e devono poter
essere sostituiti senza riscrivere il motore di gioco.

## 4. Catalogo delle mosse

Il catalogo seguente è provvisorio. I nomi identificano le animazioni da
realizzare e non costituiscono una classificazione ufficiale del meme.

### 4.1 Mosse principali

| ID | Nome | Descrizione |
| --- | --- | --- |
| S7-01 | Classic Weighing | Alternanza delle mani, con palmi verso l'alto, come una bilancia. |
| S7-02 | Reverse Weighing | Variante più ampia, rapida e scomposta della bilancia. |
| S7-03 | Finger Six-Seven | Gesto eseguito utilizzando le dita, con pose ben leggibili. |
| S7-04 | 67 Handshake | L'avatar tende la mano al giocatore e trasforma il gesto in una provocazione. |
| S7-05 | Extreme Six Seven | Versione caricaturale con movimenti esagerati di braccia, busto e testa. |

### 4.2 Animazioni di reazione

| ID | Nome | Condizione indicativa |
| --- | --- | --- |
| RX-01 | Six Seven Face | Espressione facciale esagerata. |
| RX-02 | Taunt | Reazione provocatoria dopo la mossa del giocatore. |
| RX-03 | Celebration | Reazione festosa in presenza di una forte risposta sonora. |
| RX-04 | Disappointed | Reazione ironica in assenza di una risposta sonora significativa. |
| RX-05 | Idle | Animazione di attesa, con piccoli movimenti naturali. |
| RX-06 | Turn Transition | Animazione di passaggio tra il turno dell'avatar e quello del giocatore. |

Le reazioni non devono essere vincolate rigidamente alle singole mosse. La
logica di gioco deve poter scegliere una risposta diversa in base al contesto.

### 4.3 Requisiti delle animazioni

Ogni animazione deve: avere un identificatore stabile; avere una durata
configurabile; poter essere riprodotta indipendentemente; supportare transizioni
da e verso Idle; poter essere interrotta o sostituita in modo controllato;
evitare salti improvvisi di posizione o rotazione; essere progettata
considerando la leggibilità su schermi piccoli.

Le animazioni devono essere realizzate come clip indipendenti, eventualmente
suddivise in fasi: preparazione, esecuzione e posa finale.

## 5. Ciclo di gioco

### 5.1 Sequenza del turno

1. **Avatar turn** — l'avatar sceglie ed esegue una mossa.
2. **Invitation** — l'avatar invita il giocatore a replicare il gesto.
3. **Player turn** — il giocatore esegue la propria mossa davanti alla telecamera.
4. **Movement monitoring** — il sistema analizza il movimento e attende una
   condizione di fine gesto.
5. **Reaction sampling** — il sistema misura il livello sonoro ambientale.
6. **Avatar reaction** — l'avatar esegue una risposta ironica o festosa.
7. **Next turn** — il gioco seleziona la mossa successiva e riparte.

Il passaggio di turno deve essere determinato da eventi espliciti, non da
ritardi arbitrari sparsi nel codice.

### 5.2 Macchina a stati

```
INITIALIZING → AVATAR_TURN → PLAYER_READY → PLAYER_TURN
  → WAITING_FOR_STILLNESS → REACTION_SAMPLING → AVATAR_REACTION
  → NEXT_TURN → AVATAR_TURN
```

Ogni stato deve avere condizioni di ingresso e uscita definite. Devono essere
gestiti almeno i seguenti casi: camera non disponibile; permesso camera negato;
microfono non disponibile; perdita temporanea dei landmark; giocatore che rimane
immobile troppo a lungo; assenza di una reazione sonora; interruzione o ripresa
della partita.

## 6. Rilevamento del movimento

### 6.1 Obiettivo

Il sistema deve stimare quando il giocatore ha terminato di eseguire la propria
mossa. Non è necessario riconoscere semanticamente il gesto nella prima
versione: è sufficiente rilevare che il giocatore ha eseguito un movimento e che
successivamente è rimasto relativamente fermo.

### 6.2 Approccio tecnico

Utilizzare la telecamera del browser tramite `navigator.mediaDevices.getUserMedia()`.
Un sistema di pose estimation eseguito localmente, ad esempio MediaPipe Pose
Landmarker, può fornire coordinate dei principali punti del corpo.

Il rilevamento deve utilizzare una combinazione di: movimento dei landmark;
velocità stimata dei punti rilevanti; durata dell'immobilità; visibilità e
affidabilità dei landmark.

La fine del gesto viene dichiarata quando il movimento scende sotto una soglia
configurabile per un intervallo minimo. I valori iniziali di soglia e durata
devono essere determinati sperimentalmente, considerando frame rate,
illuminazione e distanza dalla telecamera.

### 6.3 Requisiti

Elaborazione locale nel browser. Nessuna registrazione video persistente.
Nessun invio del flusso video a un server. Gestione dei casi in cui le mani non
siano visibili. Timeout configurabile per evitare turni bloccati. Possibilità di
terminare il turno manualmente come fallback.

L'immobilità è soltanto un'indicazione della fine della mossa: non dimostra che
il gesto sia stato eseguito correttamente.

## 7. Analisi audio e reazioni ambientali

### 7.1 Obiettivo

Il microfono deve fornire un'indicazione quantitativa della reazione delle
persone vicine dopo una mossa. Il sistema non deve comprendere le parole
pronunciate: deve analizzare caratteristiche aggregate del segnale audio.

### 7.2 Approccio tecnico

Utilizzare la Web Audio API, con `getUserMedia()` per acquisire il flusso audio
e `AnalyserNode` per misurare il segnale. Indicatori utilizzabili: RMS del
segnale; picco di ampiezza; livello medio durante una finestra temporale; durata
del superamento di una soglia; variazione rispetto al rumore di fondo.

Il rumore di fondo deve essere stimato prima o durante la partita per ridurre le
false reazioni in ambienti rumorosi.

### 7.3 Classificazione iniziale

| Classe | Criterio indicativo | Reazione possibile |
| --- | --- | --- |
| LOW | Nessun incremento significativo rispetto al fondo. | Taunt o Disappointed. |
| MEDIUM | Incremento sonoro moderato. | Sorriso o reazione sorpresa. |
| HIGH | Picco o livello elevato e persistente. | Celebration. |

Le soglie devono essere calibrabili e validate con test reali.

**Limite noto:** un livello audio elevato non dimostra che il pubblico abbia
apprezzato la mossa. Il rumore potrebbe provenire da conversazioni, televisione
o altri suoni ambientali. Il sistema deve quindi parlare di *intensità della
reazione*, non di gradimento certo.

### 7.4 Privacy

Nessuna registrazione audio persistente. Nessun invio dell'audio a un backend.
Nessuna trascrizione o identificazione vocale. Analisi in tempo reale e
conservazione dei soli indicatori numerici necessari alla partita. Acquisizione
audio attivata esplicitamente dall'utente.

## 8. Architettura tecnica

### 8.1 Componenti

- **Frontend e interfaccia** — TypeScript, HTML e CSS, gestione degli stati e
  dell'interazione.
- **Rendering 3D** — Three.js, caricamento degli asset glTF/GLB, scene graph,
  luci, camera virtuale e materiali.
- **Animazioni** — `AnimationMixer` e `AnimationAction` di Three.js, controller
  dedicato per selezione e transizioni delle clip.
- **Visione artificiale** — MediaPipe Pose Landmarker o alternativa equivalente,
  elaborazione sul dispositivo, modulo indipendente dal controller di gioco.
- **Audio** — Web Audio API, modulo per estrazione delle metriche audio e
  classificazione delle reazioni.
- **Persistenza** — nessun backend obbligatorio nella prima versione;
  configurazioni e preferenze locali, ove necessario.

### 8.2 Separazione dei moduli

1. `AvatarRenderer` — caricamento e rendering del personaggio.
2. `AnimationController` — riproduzione e transizioni delle animazioni.
3. `GameStateMachine` — gestione dei turni e degli eventi.
4. `PoseDetector` — elaborazione dei landmark e rilevamento dell'immobilità.
5. `AudioReactionAnalyzer` — misurazione delle reazioni sonore.
6. `AssetCatalog` — associazione tra ID, clip e metadati.
7. `UIController` — permessi, feedback e controlli del gioco.

La macchina a stati non deve dipendere direttamente da Three.js, MediaPipe o Web
Audio API: deve ricevere eventi normalizzati dai rispettivi moduli.

### 8.3 Uso di Rust

Rust non è un requisito della prima versione. L'implementazione iniziale deve
privilegiare API web native e componenti già disponibili. Un eventuale modulo
Rust compilato in WebAssembly sarà valutato solo se profilazione e benchmark
evidenzieranno un collo di bottiglia che giustifica la complessità aggiuntiva.

## 9. Requisiti non funzionali

**Prestazioni.** Avvio del gioco senza scaricare asset non necessari.
Caricamento differito dei modelli e delle animazioni quando possibile. Frame
rate stabile sul dispositivo di riferimento. Evitare che l'elaborazione di
camera e audio blocchi il rendering. Possibilità di ridurre qualità grafica e
frequenza di elaborazione sui dispositivi meno potenti. Il target prestazionale
definitivo sarà stabilito dopo un primo prototipo su smartphone e tablet reali.

**Compatibilità.** Browser moderni con supporto WebGL. Supporto di
`getUserMedia()` e Web Audio API. Utilizzo in HTTPS, necessario per l'accesso
alle periferiche nei normali contesti web. Interfaccia responsive, con
orientamento verticale come configurazione iniziale.

**Accessibilità e usabilità.** Interfaccia comprensibile ai bambini. Feedback
visivo chiaro sul turno corrente. Controlli grandi e facilmente raggiungibili.
Nessuna dipendenza esclusiva dall'audio per comprendere il gioco. Possibilità di
proseguire senza microfono. Messaggi chiari in caso di permessi negati.

## 10. Piano di sviluppo

**Fase 1 — Prototipo 3D.** Primo modello 3D; scheletro funzionante; scena
Three.js; animazione Idle; animazione Classic Weighing; animazione Taunt;
caricamento del modello da GLB. *Criterio di uscita:* il personaggio si anima
correttamente nel browser e mantiene una qualità visiva accettabile.

**Fase 2 — Ciclo di gioco.** Macchina a stati; alternanza dei turni; selezione
delle mosse; gestione delle transizioni; interfaccia minimale. *Criterio di
uscita:* una partita completa può essere eseguita senza camera e microfono,
utilizzando una modalità simulata.

**Fase 3 — Integrazione della telecamera.** Acquisizione video; pose
estimation; rilevamento dell'immobilità; timeout e fallback; test in condizioni
reali. *Criterio di uscita:* il sistema riconosce in modo sufficientemente
stabile la fine di una mossa senza richiedere interventi manuali nella maggior
parte dei test.

**Fase 4 — Integrazione audio.** Acquisizione audio; calibrazione del rumore di
fondo; classificazione LOW, MEDIUM e HIGH; associazione alle reazioni
dell'avatar. *Criterio di uscita:* le reazioni risultano ragionevoli in diversi
ambienti e il sistema non richiede registrazione o trasmissione dell'audio.

**Fase 5 — Rifinitura.** Animazioni aggiuntive; miglioramento del modello;
ottimizzazione delle prestazioni; test cross-browser; documentazione per build e
deployment.

## 11. Criteri di accettazione del prototipo

Il prototipo è considerato valido quando:

- [ ] L'avatar 3D è caricato nel browser.
- [ ] Il modello è dotato di uno scheletro utilizzabile.
- [ ] Almeno tre animazioni sono riproducibili.
- [ ] Le transizioni tra le animazioni non producono salti evidenti.
- [ ] Il gioco alterna correttamente i turni.
- [ ] La telecamera consente di stimare la fine della mossa.
- [ ] Un timeout impedisce al gioco di bloccarsi.
- [ ] Il microfono produce indicatori di intensità sonora.
- [ ] Le reazioni dell'avatar variano in base agli indicatori audio.
- [ ] Il gioco rimane utilizzabile senza microfono.
- [ ] Il video e l'audio non vengono registrati o inviati a un server.
- [ ] Il prototipo funziona su almeno uno smartphone e un tablet di riferimento.

Lo stato aggiornato è in `PHASE1.md`.

## 12. Decisioni ancora aperte

1. Se il modello 3D sarà creato manualmente in Blender oppure generato
   automaticamente e poi corretto.
2. Quale livello di dettaglio grafico sia sufficiente per la prima versione.
3. Quali dispositivi saranno usati come riferimento prestazionale.
4. Quali soglie e timeout utilizzare per il rilevamento della fine del gesto.
5. Se il gioco debba funzionare anche senza connessione dopo il caricamento
   iniziale.
6. Se le mosse saranno selezionate casualmente oppure organizzate in sequenze.
7. Se sarà previsto un punteggio oppure se il gioco rimarrà una sfida puramente
   comica.

## 13. Priorità progettuale

La priorità assoluta è ottenere un personaggio 3D convincente e realmente
animabile nel browser. Non è necessario sviluppare subito tutta l'applicazione.
Il primo prototipo deve dimostrare che il modello può eseguire una mossa Six
Seven, tornare alla posizione di riposo e reagire con una smorfia.

Solo dopo questa verifica conviene investire nell'integrazione della telecamera,
nell'analisi audio e nel repertorio completo delle animazioni.
