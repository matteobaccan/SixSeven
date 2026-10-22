# Stato del progetto

Riferimento: `SPEC.md`. Questo documento dice cosa è realizzato, quali decisioni
sono state prese e cosa resta aperto.

## Criteri di accettazione del prototipo (spec 11)

| Criterio | Stato |
| --- | --- |
| L'avatar 3D è caricato nel browser | sì |
| Il modello è dotato di uno scheletro utilizzabile | sì, 48 bone |
| Almeno tre animazioni riproducibili | sì, **undici**: tutto il catalogo |
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

**9. Mosse scelte a caso, mai due volte di fila** (punto aperto §12.6). È il
comportamento che richiede meno impalcatura; le sequenze si aggiungono
sostituendo `pickMove` senza toccare il resto.

**10. Niente punteggio** (punto aperto §12.7). La sfida resta comica: il
riscontro è la reazione dell'avatar, non un numero.

**11. Niente Rust/WebAssembly**, come indicato dalla specifica (§8.3). Nessun
collo di bottiglia misurato lo giustifica.

## Note tecniche non ovvie

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
- il primo caricamento pesa circa 1,7 MB, e le due voci grosse sono il GLB
  (1077 kB: 555 di geometria, 362 di animazioni, 160 di JSON) e `face.png`
  (493 kB). Vanno affrontate in modo diverso: su `avatar.glb` **Draco servirebbe
  poco**, perché comprime la geometria e qui un terzo del file sono tracce di
  animazione — serve `meshopt`/`gltfpack`, che le comprime entrambe. Su
  `face.png` il margine è maggiore e costa meno: l'immagine è disegnata a tinte
  piatte e si usa solo il ritaglio `FACE_CROP`, quindi ritagliarla in fase di
  build o passare a WebP la ridurrebbe di molto. Il ritaglio però va in coppia
  con le UV in `tools/avatar/face.ts`, ed è il punto appena sistemato del
  contorno: da fare con una verifica visiva accanto.

## Prossimo passo

Provarlo su uno smartphone e un tablet reali, con una persona davanti alla
telecamera: è l'unica cosa che non si può verificare da qui, ed è quella che
deciderà le soglie definitive.
