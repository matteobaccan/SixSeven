# Stato del progetto

Riferimento: `SPEC.md`. Questo documento dice cosa è realizzato, quali decisioni
sono state prese e cosa resta aperto.

## Criteri di accettazione del prototipo (spec 11)

| Criterio | Stato |
| --- | --- |
| L'avatar 3D è caricato nel browser | sì |
| Il modello è dotato di uno scheletro utilizzabile | sì, 48 bone |
| Almeno tre animazioni riproducibili | sì, **quattordici**: otto mosse e sei reazioni |
| Transizioni senza salti evidenti | sì — ogni clip apre e chiude sulla posa di riposo, con crossfade |
| Il gioco alterna correttamente i turni | sì |
| La telecamera consente di stimare la fine della mossa | sì, per differenza fra fotogrammi |
| Un timeout impedisce al gioco di bloccarsi | sì, tre riserve distinte |
| Il microfono produce indicatori di intensità sonora | sì: RMS, picco, dB sopra il fondo |
| Le reazioni variano in base agli indicatori audio | sì |
| Il gioco rimane utilizzabile senza microfono | sì, ed è una scelta esplicita all'avvio |
| Video e audio non registrati né inviati a un server | sì |
| Funziona su smartphone e tablet di riferimento | **da verificare su dispositivi reali** |

L'unico criterio non spuntato richiede dispositivi fisici. Tutto il resto è
verificato: la logica dei turni da `npm run check:game`, il ciclo completo nel
browser con telecamera e microfono finti, il rilevamento del movimento con una
sorgente controllata.

## Fasi

| Fase | Stato |
| --- | --- |
| 1 — Prototipo 3D | completata |
| 2 — Ciclo di gioco | completata |
| 3 — Integrazione telecamera | completata, soglie da validare sul campo |
| 4 — Integrazione audio | completata, soglie da validare sul campo |
| 5 — Rifinitura | in corso |

## Come verificare

```bash
npm run check:game     # logica dei turni, con timer finti
npm run check:naming   # rimappatura dei nomi dei bone
npm run typecheck      # tipi di app e tool, separati
npm run build          # esegue tutto quanto sopra, più avatar e bundle
```

`check:game` è il controllo che vale di più: pilota la macchina a stati con
timer finti e verifica i percorsi di riserva — senza telecamera, senza
microfono, immobilità mai dichiarata, pausa a metà turno — cioè quelli che a
mano si proverebbero solo staccando la webcam.

## Decisioni prese

Chiudono alcuni punti aperti della specifica (§12) e restano reversibili.

**1. Modello creato da codice, non a mano in Blender.** Mesh, scheletro e clip
sono descritti in `tools/` ed esportati in GLB: versionabile e diffabile come
codice, riproducibile senza dipendenze esterne, modificabile per parametri. Non
è un vincolo: il GLB è un asset sostituibile, vedi `ASSET-CONTRACT.md`.

**2. Testa staccata dal corpo, senza collo.** Tre difetti insistevano sullo
stesso punto: il colletto della camicia dipinto nella caricatura, l'ombra
dipinta sul collo, e la giunzione fra disegno e geometria che a tre quarti si
scopriva. Tagliare la testa al mento e lasciare dell'aria — il trucco del
burattino — li elimina tutti e tre insieme.

**3. Viso disegnato, corpo modellato.** Il volto è la caricatura originale
applicata come texture a una superficie curva; il corpo è 3D riggato. Il primo
tentativo modellava anche la testa accostando primitive, e il confronto diretto
con la caricatura era impietoso: una faccia disegnata non si ottiene con sfere e
cilindri. Le mani invece devono essere vero 3D, perché le mosse sono gesti.

**4. Espressioni facciali con bone, non con shape key.** Sul viso texturizzato
agiscono per zone di influenza gaussiane, trascinando la pelle dipinta.
Restano sostituibili con morph target senza toccare il motore.

**5. Stile grafico nel renderer, non nel modello.** Il GLB conserva solo i
colori base. Resa toon, contorni e luci vivono in `AvatarRenderer` e
`ToonLinePass`: si cambia look senza rigenerare l'avatar.

**6. Contorni con rilevamento dei bordi, non a guscio invertito.** Il guscio
invertito disegna solo la sagoma esterna; il riferimento grafico ha linee anche
sui dettagli interni.

**7. Movimento per differenza fra fotogrammi, non a landmark.** La specifica
(6.1) chiede di rilevare che il giocatore si è mosso e poi è rimasto fermo, non
di riconoscere il gesto. Il confronto fra fotogrammi ridotti a una griglia
48x36 non scarica modelli, non richiede rete e funziona offline — chiudendo di
fatto anche il punto aperto §12.5. MediaPipe Pose darebbe in più la posizione
delle mani, utile quando si vorrà riconoscere il gesto; l'interfaccia di
`PoseDetector` non cambia se un giorno lo si sostituisce.

**8. Soglie autotaranti invece che fisse.** Sia il movimento sia l'audio
misurano un riferimento e ragionano in rapporto a quello: il livello di quiete
nei primi mezzo secondo di ogni turno, il rumore di fondo inseguito in continuo.
Una soglia fissa dipenderebbe da luce, rumore del sensore, distanza e frame
rate, cioè le variabili che la specifica stessa (§6.2, §7.3) segnala come
incognite. Restano minimi assoluti come rete di sicurezza.

**9. Il repertorio si consuma come un mazzo** (punto aperto §12.6). La prima
versione evitava solo la ripetizione immediata, e non bastava: con otto mosse e
una partita di quattro-otto turni si poteva rivedere la stessa mossa tre volte
mentre altre non comparivano mai, e il repertorio sembrava più povero di quanto
fosse. Ora una mossa non torna finché non sono uscite tutte le altre; esaurito
il giro si rimescola, escludendo l'ultima uscita perché il passaggio fra un giro
e il successivo sarebbe altrimenti l'unico punto in cui una mossa potrebbe
ripetersi di fila. Le sequenze decise a mano si aggiungono sostituendo
`pickMove` senza toccare il resto.

**10. Punteggio: l'aura dell'avatar** (punto aperto §12.7). La prima versione
non aveva punteggio, per non trasformare una sfida comica in una gara. L'aura
lo introduce senza perdere quel registro, perché non misura il giocatore ma una
risorsa dell'avatar: parte a 60 su 100 e si muove a ogni turno secondo
l'agitazione rilevata dalla telecamera e l'approvazione del pubblico misurata
dal microfono. Il passo è di 10 punti, e il valore non è scelto a caso: divide
esattamente il massimo, così la barra si divide in dieci tacche da un turno
ciascuna e quanti ne restano si legge a colpo d'occhio invece di doverli
contare. Una partita dura fra i quattro e gli otto turni. I due esiti sono opposti e voluti — a zero il giocatore ha
smontato l'avatar e vince, al massimo vuol dire che nessuno ha ribattuto e
l'avatar se la gode. Il conteggio vive in `src/game/Aura.ts`, separato dalla
macchina a stati e come quella privo di dipendenze dal browser.

**11. Niente Rust/WebAssembly**, come indicato dalla specifica (§8.3). Nessun
collo di bottiglia misurato lo giustifica.

## Note tecniche non ovvie

**La texture esporta solo la regione usata.** Dei 540x773 pixel disegnati, la
faccia ne usa meno della metà: il resto erano 278 kB scaricati per niente. Il
ritaglio è l'**ultimo** passo della costruzione, perché tutte le elaborazioni
— righe del colletto, uniformatura del collo, contorno della mascella — sono
misurate nel sistema di coordinate dell'originale e lì devono restare. Le UV
sono riferite alla regione esportata, e il margine di 3 pixel attorno serve
perché ai bordi il filtraggio bilineare campiona appena fuori.

**Il GLB è compresso con meshopt.** Misurato su questo modello: meshopt 334 kB,
Draco 688 kB, sola quantizzazione 909 kB, non compresso 1233 kB. Una nota
precedente diceva che Draco «servirebbe poco» perché comprime la geometria
mentre qui un terzo del file sono animazioni: era troppo netta — Draco toglie
il 44%, solo che meshopt ne toglie il 73% e il suo decodificatore arriva con
three e pesa una ventina di kB contro i circa 200 del wasm di Draco. La
compressione è deterministica, verificata su build ripetute, quindi il
controllo in CI sull'avatar versionato continua a valere.

**Il rumore di fondo non si insegue durante il turno del giocatore.** La stima
del fondo serve a misurare quanto una reazione *si stacca* dall'ambiente, e
inseguirla in continuo sembrava giusto. Non lo era: durante il turno è il
giocatore a fare rumore, e con la costante di salita di 0,25/s dodici secondi
bastano a coprire il 95% della distanza fra il fondo e il livello che sta
producendo lui. Il campionamento subito dopo trovava quindi un guadagno vicino
a zero e classificava `low` anche una reazione forte: l'avatar faceva la faccia
delusa proprio a chi si era sbracciato di più. Ora la stima si congela per
tutta la fase del giocatore, non solo durante la finestra di campionamento.

**Il contesto audio si riprende all'avvio, non al primo campionamento.**
L'`AudioContext` nasce dopo l'`await` di `getUserMedia`, quindi fuori dal gesto
dell'utente che ha premuto «gioca»: su iOS può restare sospeso. Finché lo è, il
segnale letto è muto, il fondo viene stimato sul silenzio, e al primo
`resume()` qualunque suono risulta un'esplosione. Il `resume()` è stato
spostato dentro `request()`, e l'indicatore a schermo dice «fermo» invece di
mostrare zero se il contesto non gira.

**L'indicatore audio mostra il guadagno sul fondo, non il volume.** È quel
numero a decidere la reazione, ed è l'unico che dica qualcosa in una stanza
rumorosa. Porta due tacche fisse dove cominciano MEDIUM e HIGH, perché la
domanda del giocatore non è «mi sente?» ma «è bastato?»; le soglie arrivano
dall'analizzatore e non sono riscritte nel foglio di stile.

**Il rilevamento analizza i fotogrammi, non i tick dell'orologio.** Il
campionamento gira a 20 Hz, ma una telecamera può consegnare molto meno: poca
luce, un telefono che risparmia batteria, un flusso a scatti. Analizzando a
ogni tick, un campione su due confrontava due fotogrammi **identici** e
misurava zero movimento; siccome `startFrames` chiede campioni consecutivi
sopra soglia, l'alternanza «valore buono, zero, valore buono» azzerava il
conteggio a ogni giro e l'inizio del gesto non veniva **mai** dichiarato. Ora
`sample` salta i fotogrammi già visti confrontando `video.currentTime`. Era un
difetto vero — con una telecamera lenta il gioco non si sarebbe accorto di
niente — e l'ha trovato `tools/visual/motion.mjs`, non un controllo headless.

**L'immobilità si giudica dall'evento, non dal numero.** L'aura riconosce il
giocatore che non ha giocato da `movementSeen`, cioè dal fatto che il
rilevamento abbia dichiarato l'inizio del movimento, non dall'agitazione
misurata. L'agitazione dice *quanto* è stato ampio il gesto e può non arrivare
affatto — nessun campione in quel turno, telecamera negata, rilevamento spento —
e confondere «non misurato» con «fermo» regalerebbe all'avatar il massimo
dell'aura per un difetto di misura. Per questo l'agitazione è `number | null` e
non un numero con lo zero come ripiego.

**L'aura non è additiva.** Il primo tentativo usava `AdditiveBlending`, che su
un fondo scuro è la scelta giusta per qualcosa che rappresenta luce. Qui il
fondo della scena è crema: sommare luce su un fondo già chiaro satura verso il
bianco e l'alone spariva del tutto. Con la fusione normale è il colore a
coprire, e l'alfa della texture a tenerlo morbido ai bordi.

**I gesti alti devono salire in diagonale.** Un braccio allargato di lato esce
dal campo, e la mano con esso. Le pose che alzano una mano la portano su in
diagonale accompagnata dalla torsione del busto, che è ciò che la riporta dentro
la sagoma. Vale per `ToDiWorld` e `SixFootSeven`, ed è il vincolo da rispettare
per le prossime.

**L'inquadratura si adatta a entrambe le dimensioni, non solo all'altezza.** Il
`fov` di three è verticale: la larghezza inquadrata vale `altezza × aspect`.
Fissando solo l'altezza, su schermo stretto — un telefono, e ancora di più il
browser dentro un'app, che toglie spazio sopra e sotto — le spalle finivano
fuori campo e nelle mosse i gomiti sparivano del tutto. Ora si calcola la
distanza necessaria a ciascuna delle due dimensioni e si prende la maggiore.

**Il bordo inferiore è inchiodato all'orlo del maglione.** Quando a comandare è
la larghezza, in altezza ci sta più del voluto: quell'eccedenza va sopra la
testa, dove galleggiano la striscia dell'aura e la fascia di stato, non sotto,
dove scoprirebbe le gambe e aprirebbe un vuoto sotto il personaggio. La soglia
è una frazione dell'altezza totale, non un valore in metri, perché il modello si
può sostituire.

**La distanza si misura dal piano del soggetto.** La prima versione sommava
l'intera profondità del personaggio (`distanza + size.z`), allontanando la
camera oltre il calcolo: l'inquadratura usciva più alta e più larga del voluto,
ed era così che ricomparivano le gambe anche dopo aver fissato il bordo
all'orlo.

**Le animazioni sono ricampionate in fase di build.** glTF trasporta solo
interpolazione lineare o a gradini: con poche pose il movimento risulta
meccanico. `tools/avatar/timeline.ts` ricampiona a 32 Hz applicando una curva di
easing a ogni transizione, e aggiunge un ritardo di inseguimento per bone
(*overlapping action*) che rientra a zero a fine clip, perché la posa finale
resti esattamente quella di riposo.

**La posa di riposo ha le braccia a 20° dalla verticale.** Con l'A-pose larga
che si usa di solito, le rotazioni che servono per la bilancia lasciavano le
mani ai lati del corpo invece che davanti al petto.

**I palmi guardano verso il corpo a riposo**: per rivoltarli in alto serve una
supinazione dell'avambraccio di circa 68°. **Le dita si chiudono su Z e si
aprono a ventaglio su X.**

**I micro-movimenti sono procedurali, non nelle clip.** `IdleLife` somma
battito di palpebre, saccadi, respiro e deriva della testa sopra qualunque
clip, quindi valgono anche per le animazioni aggiunte in seguito.

**Il canvas è ancorato, non a `height: 100%`.** Su un flex item l'altezza
percentuale non si risolve: il canvas restava alla propria proporzione
predefinita di 2:1 e la camera sceglieva l'inquadratura orizzontale. L'
inquadratura viene inoltre ricalcolata a ogni ridimensionamento, non solo al
caricamento, così la rotazione del telefono funziona.

## Punti aperti

Della specifica (§12):

- **dispositivi di riferimento e target prestazionale** — il contatore fps in
  alto a destra serve a questo;
- **livello di dettaglio grafico definitivo**;
- **soglie e timeout definitivi** del rilevamento: i valori attuali sono
  ragionati e autotaranti, ma nessuno li ha ancora provati con una persona vera
  davanti alla telecamera, in una stanza vera.

Noti dal lavoro fatto, da rifinire:

- la testa regge rotazioni fino a circa 30°: oltre, la natura piatta si vede;
- niente bocca spalancata e niente sguardo che si sposta davvero: servirebbero
  altri disegni o un volto modellato;
- la mano chiusa legge come un blocco unico: va separata meglio nelle falangi;
- le gambe restano lunghe per una proporzione pienamente caricaturale;
- il primo caricamento è sceso da ~1,7 MB a **720 kB in transito**, ma la voce
  più pesante è ora `face.png` con 221 kB, che il PNG non comprime oltre.
  Quantizzarla a 255 colori la porterebbe a 24 kB — misurato — con un errore
  medio di 1,9 su 255, invisibile. Il problema è l'**alfa**: l'errore arriva a
  25, e con `alphaTest` a 0,5 significa spostare il contorno del viso di un
  pixel, cioè il dettaglio su cui si è lavorato di più. Si farebbe quantizzando
  il solo RGB e lasciando l'alfa intatta, il che richiede un quantizzatore in
  Node — `pngjs` non ne ha uno. Da valutare se i 197 kB valgono quel codice.

## Prossimo passo

Provarlo su uno smartphone e un tablet reali, con una persona davanti alla
telecamera: è l'unica cosa che non si può verificare da qui, ed è quella che
deciderà le soglie definitive.
