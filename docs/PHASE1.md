# Fase 1 — prototipo 3D

Criterio di uscita della specifica: *"il personaggio si anima correttamente nel
browser e mantiene una qualità visiva accettabile"*, e come priorità assoluta
*"il modello può eseguire una mossa Six Seven, tornare alla posizione di riposo e
reagire con una smorfia"*.

## Deliverable della fase

| Richiesto | Stato |
| --- | --- |
| Primo modello 3D | fatto — corpo 3D più viso dalla caricatura originale |
| Scheletro funzionante | fatto — 48 bone, dita e controlli facciali compresi |
| Scena Three.js | fatto — `src/avatar/AvatarRenderer.ts` |
| Animazione `Idle` | fatto |
| Animazione `Classic Weighing` | fatto |
| Animazione `Taunt` | fatto |
| Caricamento del modello da GLB | fatto |

Oltre al minimo: `SixSevenFace` (RX-01, la smorfia richiesta dalla priorità di
progetto) e uno strato di micro-movimenti continui.

## Criteri di accettazione del prototipo (spec 11)

| Criterio | Stato |
| --- | --- |
| Avatar 3D caricato nel browser | sì |
| Modello dotato di scheletro utilizzabile | sì, 48 bone |
| Almeno tre animazioni riproducibili | sì, quattro |
| Transizioni senza salti evidenti | sì — ogni clip inizia e finisce sulla posa di riposo, con crossfade |
| Alternanza dei turni | **no — Fase 2** |
| Stima della fine mossa da telecamera | **no — Fase 3** |
| Timeout contro i blocchi | **no — Fase 2/3** |
| Indicatori di intensità sonora | **no — Fase 4** |
| Reazioni variabili in base all'audio | **no — Fase 4** |
| Utilizzabile senza microfono | sì, non è ancora usato |
| Nessuna registrazione né invio di video o audio | sì, nessuna periferica è aperta |
| Funziona su smartphone e tablet di riferimento | **da verificare su dispositivi reali** |

Il prototipo non apre telecamera o microfono: non c'è alcun flusso da registrare
o trasmettere.

## Decisioni prese

Chiudono alcuni punti aperti della specifica (§12), restano reversibili.

**1. Modello creato da codice, non a mano in Blender.** La mesh, lo scheletro e
le clip sono descritti in `tools/` ed esportati in GLB. Motivi: il risultato è
versionabile e diffabile come codice, riproducibile senza dipendenze esterne, e
modificabile per parametri (un solo numero cambia la proporzione della testa).
Non è un vincolo: il GLB è un asset sostituibile, vedi `ASSET-CONTRACT.md`.

**2. Viso disegnato, corpo modellato.** Il volto è la caricatura originale
applicata come texture a una superficie curva; il corpo è 3D riggato. Il primo
tentativo modellava anche la testa accostando primitive, e il confronto diretto
con la caricatura era impietoso: una faccia disegnata non si ottiene con sfere e
cilindri, perché il naso, gli occhi socchiusi e il tratto sono scelte di
disegno. Le mani invece devono essere vero 3D, perché le mosse Six Seven sono
gesti. Dettagli in `ASSET-CONTRACT.md` §9.

**2b. Espressioni facciali con bone, non con shape key.** La specifica ammette
entrambi. I bone (`Jaw`, `Brow_*`, `Eye_*`, `Lid_*`) sono animabili con lo stesso
meccanismo del resto del corpo e non richiedono un secondo sistema. Sul viso
texturizzato agiscono per zone di influenza gaussiane, trascinando la pelle
dipinta.

**3. Stile grafico nel renderer, non nel modello.** Il GLB conserva solo i colori
base. Resa toon a colore piatto, contorni e luci vivono in
`AvatarRenderer`/`ToonLinePass`: si cambia look senza rigenerare l'avatar.

**4. Contorni con rilevamento dei bordi, non a guscio invertito.** Il guscio
invertito disegna solo la sagoma esterna; il riferimento grafico ha linee anche
sui dettagli interni. La scena è renderizzata in normali+profondità e un filtro
confronta i pixel vicini. Costa una passata di geometria in più;
`setLineWidth(0)` la disattiva sui dispositivi deboli.

**5. Niente Rust/WebAssembly**, come indicato dalla specifica (§8.3). Nessun
collo di bottiglia misurato lo giustifica.

## Note tecniche non ovvie

**Le animazioni sono ricampionate in fase di build.** glTF trasporta solo
interpolazione lineare o a gradini: con poche pose il movimento risulta
meccanico. `tools/avatar/timeline.ts` ricampiona la timeline a 32 Hz applicando
una curva di *easing* a ogni transizione, quindi il file esportato contiene già
le accelerazioni. Aggiunge anche un ritardo di inseguimento per bone (testa,
mandibola, sopracciglia, mani seguono il corpo di qualche centesimo): è il
principio di *overlapping action*, e il ritardo rientra a zero a fine clip
perché la posa finale resti esattamente quella di riposo.

**La posa di riposo ha le braccia a 20° dalla verticale.** Con l'A-pose larga
che si usa di solito, le rotazioni che servono per la bilancia lasciavano le
mani ai lati del corpo invece che davanti al petto.

**I palmi guardano verso il corpo a riposo.** Per rivoltarli verso l'alto serve
una supinazione dell'avambraccio (rotazione su Y di circa 68°): senza, le mani
restano di taglio e la bilancia non si legge.

**Le dita si chiudono su Z e si aprono a ventaglio su X**, per come sono
orientate le falangi nella posa di riposo.

**I micro-movimenti sono procedurali, non nelle clip.** `IdleLife` somma
battito di palpebre, saccadi, respiro e deriva della testa sopra qualunque clip,
quindi valgono anche per le animazioni che verranno aggiunte. L'ordine nel ciclo
di rendering conta e il motivo è documentato nel modulo.

## Punti aperti

Della specifica (§12), ancora da decidere con prove sul campo:

- dispositivi di riferimento e target prestazionale (il contatore fps in alto a
  destra serve a questo);
- livello di dettaglio grafico definitivo;
- soglie e timeout del rilevamento di fine gesto (Fase 3);
- funzionamento offline dopo il primo caricamento;
- selezione delle mosse casuale o in sequenze;
- presenza di un punteggio.

Noti dal prototipo, da rifinire:

- le gambe restano lunghe rispetto a una proporzione pienamente caricaturale:
  l'inquadratura di gioco è a mezzo busto, quindi non è prioritario;
- la mano chiusa nelle pose di provocazione legge come un blocco unico: va
  separata meglio nelle falangi;
- il viso non apre la bocca e non sposta lo sguardo: servirebbero altri disegni
  o un volto modellato;
- il GLB pesa 880 kB non compresso; con Draco o `meshopt` scende molto, ma la
  specifica chiede prima un prototipo.

## Prossimo passo

Fase 2: macchina a stati dei turni (spec 5.2). Si innesta al posto di `runDemo`
in `src/main.ts` e riceve eventi normalizzati; `AvatarRenderer`,
`AnimationController` e `AssetCatalog` non vanno modificati.
