# Contratto dell'asset avatar

Questo documento è quanto serve per realizzare un modello 3D sostitutivo senza
toccare il motore di gioco. Il motore non conosce la pipeline che ha prodotto il
file: conosce solo i nomi elencati qui.

> **Il viso non è modellato.** L'avatar attuale è ibrido: corpo 3D riggato e
> volto costituito dalla caricatura originale applicata come texture a una
> superficie curva agganciata al bone `Head` (vedi §9). Una caricatura disegnata
> non si riproduce accostando primitive 3D — il naso, gli occhi socchiusi e il
> tratto sono scelte di disegno — mentre le mani hanno bisogno di essere vero 3D
> per i gesti Six Seven. Chi realizza un modello completo può sostituire anche
> il viso: in quel caso valgono i requisiti di §3 e basta non dichiarare il
> materiale `face`.

Il riferimento in codice è `src/assets/AvatarContract.ts`, che contiene gli
stessi nomi e una funzione di verifica. All'avvio l'applicazione confronta il
modello caricato con il contratto e mostra il referto nel pannello
*"Contratto dell'asset: cosa ha riconosciuto il motore"*: è il modo più rapido
per capire se un modello nuovo è compatibile.

## 1. File e consegna

| Voce | Valore |
| --- | --- |
| Formato | glTF 2.0 binario (`.glb`), file unico, texture incorporate |
| Percorso | `public/assets/avatar.glb` |
| Unità | 1 unità = 1 metro |
| Orientamento | Y verso l'alto, **+Z verso l'osservatore** (il personaggio guarda in camera) |
| Posizione | piedi a `y = 0`, personaggio centrato su `x = 0` |
| Altezza | indicativa 1,8 – 2,0 m; la camera inquadra da sola, quindi non è vincolante |
| Budget | ≤ 25.000 triangoli, texture ≤ 1024×1024 |

Il modello attuale, generato da `tools/`, sta in circa 12.000 vertici e 880 kB:
è un riferimento, non un limite.

## 2. Posa di riposo

Requisito più importante di tutti:

> **Nella posa di riposo tutte le rotazioni dei bone devono essere a zero.**

Il motore riporta il personaggio a riposo azzerando le rotazioni, e tutte le
clip iniziano e finiscono su quella posa. Se il riposo contiene già rotazioni,
le transizioni verso `Idle` producono salti.

Posa consigliata: in piedi, braccia in giù a circa **20° dalla verticale**
(A-pose stretta), palmi rivolti verso il corpo, dita leggermente aperte.

Perché 20° e non la solita A-pose larga a 40°: con il braccio quasi verticale,
una rotazione della spalla su Y orienta il piano in cui si piega il gomito e una
rotazione dell'avambraccio su X lo porta davanti al corpo. Sono le due rotazioni
con cui si scrivono a mano pose come la bilancia. Con l'A-pose larga le stesse
rotazioni lasciano le mani ai lati del corpo.

## 3. Scheletro

Nomi **esatti**, maiuscole comprese. `_L` e `_R` sono sinistra e destra
anatomiche del personaggio (`_L` sta a `x` positivo).

### Obbligatori

```
Hips → Spine → Chest → Neck → Head
Chest → Shoulder_L → UpperArm_L → LowerArm_L → Hand_L
Chest → Shoulder_R → UpperArm_R → LowerArm_R → Hand_R
```

Senza questi l'avatar non si anima.

### Opzionali (degradano senza errori)

| Bone | A cosa serve |
| --- | --- |
| `Jaw` | apertura della bocca nelle smorfie |
| `Brow_L`, `Brow_R` | sopracciglia, la parte più espressiva del viso |
| `Eye_L`, `Eye_R` | direzione dello sguardo e micro-saccadi |
| `Lid_L`, `Lid_R` | battito di palpebre |
| `UpperLeg_*`, `LowerLeg_*`, `Foot_*`, `Toe_*` | gambe |
| `Thumb1_*`, `Thumb2_*`, `Index1_*`, `Index2_*`, `Middle1_*`, `Middle2_*`, `Ring1_*`, `Ring2_*`, `Pinky1_*`, `Pinky2_*` | dita (necessarie per S7-03 Finger Six-Seven) |

Nota sulle palpebre: il perno va **dietro** al bulbo oculare, non sul bordo
della palpebra. Così una rotazione su X di circa 45° chiude l'occhio.

Nota sul viso: le espressioni possono essere realizzate con bone (come adesso)
oppure con **morph target / shape key**. Se preferisci le shape key va bene:
servono i nomi dei target e li colleghiamo noi, è una modifica contenuta a
`IdleLife` e alle clip.

### Skinning

- massimo 4 influenze per vertice, pesi normalizzati;
- niente deformazioni anomale con il braccio alzato oltre l'orizzontale: le
  mosse portano gli avambracci davanti al petto e in alto.

## 4. Materiali

Il motore **sostituisce i materiali** con una resa toon a colore piatto e
disegna i contorni in post-produzione (`src/avatar/ToonLinePass.ts`). Quindi:

- servono solo i **colori base** (`baseColorFactor`), anche senza texture;
- niente illuminazione, ombre o occlusione ambientale cotte nelle texture: il
  motore fa colore piatto e il volume lo raccontano le linee;
- più materiali distinti sono utili (pelle, maglione, camicia, pantaloni,
  scarpe, sopracciglia, occhi): restano separati e ricolorabili;
- le linee del viso (rughe, pieghe naso-labiali) nel modello attuale sono
  geometria in un materiale dedicato (`ink`). Puoi farle allo stesso modo oppure
  lasciarle al rilevamento dei bordi.

Se nel modello ci sono già contorni disegnati come geometria, si può abbassare o
azzerare lo spessore del tratto con `AvatarRenderer.setLineWidth(0)`.

## 5. Animazioni

Le clip vanno **dentro il GLB**, con questi nomi esatti:

| ID specifica | Nome clip | Stato | Note |
| --- | --- | --- | --- |
| RX-05 | `Idle` | realizzata | in ciclo continuo, deve chiudere dove apre |
| S7-01 | `ClassicWeighing` | realizzata | la bilancia |
| RX-02 | `Taunt` | realizzata | provocazione |
| RX-01 | `SixSevenFace` | realizzata | smorfia |
| S7-02 | `ReverseWeighing` | realizzata | la bilancia scomposta |
| S7-03 | `FingerSixSeven` | realizzata | richiede le dita |
| S7-04 | `Handshake67` | realizzata | la mano tesa e ritirata |
| S7-05 | `ExtremeSixSeven` | realizzata | tutto il corpo |
| S7-06 | `ToDiWorld` | realizzata | braccio teso al cielo |
| S7-07 | `SixFootSeven` | realizzata | la mano che misura l'altezza |
| S7-08 | `ThreePointer` | realizzata | tiro da tre, poi la bilancia |
| RX-03 | `Celebration` | realizzata | |
| RX-04 | `Disappointed` | realizzata | |
| RX-06 | `TurnTransition` | realizzata | |

I nomi non realizzati sono già previsti in `src/assets/AssetCatalog.ts`: appena
una clip con quel nome compare nel GLB, il bottone corrispondente appare da solo
nell'interfaccia. Non serve modificare codice per aggiungere una mossa.

Requisiti di ogni clip:

1. **inizia e finisce sulla posa di riposo** (rotazioni a zero);
2. nessun *root motion*: `Hips` può traslare di pochi centimetri per il peso e
   il respiro, ma deve tornare al punto di partenza;
3. interpolazione lineare o a gradini (glTF non trasporta le curve di Blender in
   modo affidabile: conviene **campionare le curve in keyframe**, 24–32 fps);
4. durata indicativa: mosse 3–5 s, reazioni 2–3 s, `Idle` 4–6 s.

Il punto 3 è lo stesso motivo per cui la pipeline attuale ricampiona le proprie
curve: vedi `tools/avatar/timeline.ts`.

## 6. Cosa resta comunque al motore

Non serve che siano nel modello: sono aggiunti a runtime sopra qualunque clip.

- battito di palpebre, micro-saccadi oculari, respiro, deriva della testa che
  insegue lo sguardo (`src/avatar/IdleLife.ts`);
- resa toon, contorni, luci, inquadratura, ombra di contatto.

## 7. Alternative accettate

- **Modello non riggato** (per esempio generato automaticamente): va bene, il
  rigging e lo skinning li facciamo noi; in quel caso serve solo la mesh in posa
  di riposo, pulita e con le normali coerenti.
- **Solo la testa**: si innesta sul corpo attuale, purché condivida le
  proporzioni del collo.
- **Nomi diversi dai nostri**: già gestiti, vedi sotto.


## 8. Rig di terze parti: rimappatura automatica dei nomi

Un modello non deve per forza usare i nostri nomi. Al caricamento
`src/assets/BoneNaming.ts` riconduce i nomi noti a quelli canonici e riscrive di
conseguenza le track delle clip già presenti nel file, così le animazioni di
origine continuano a funzionare insieme alle nostre.

Convenzioni riconosciute:

| Convenzione | Esempio | Diventa |
| --- | --- | --- |
| Mixamo | `mixamorig:LeftForeArm` | `LowerArm_L` |
| Mixamo | `mixamorig:LeftUpLeg` | `UpperLeg_L` |
| Mixamo | `mixamorig:RightHandIndex1` | `Index1_R` |
| Rigify / Blender | `upper_arm.L`, `DEF-upper_arm.L` | `UpperArm_L` |
| Rigify / Blender | `spine.001` | `Chest` |
| Pacchetti CC0 | `Left_Hand`, `L_Hand`, `arm_r` | `Hand_L`, `Hand_L`, `UpperArm_R` |

Due avvertenze di merito, non di forma:

- `Arm` per Mixamo è il **braccio** e `ForeArm` l'avambraccio; `UpLeg` è la
  **coscia** e `Leg` la gamba. La tabella lo tiene conto: sono gli scambi che
  rovinano più spesso una rimappatura fatta a mano.
- Il nostro rig ha **due falangi per dito**, Mixamo ne ha tre: la terza resta
  non mappata e semplicemente non viene animata.

Quando più bone finirebbero sullo stesso nome canonico (`Spine1` e `Spine2` di
Mixamo sono entrambi candidati a `Chest`) vince il primo nella gerarchia; gli
altri restano com'erano.

I nomi non riconosciuti non sono un errore: restano invariati e compaiono nel
pannello di diagnostica, dove si vede subito cosa il motore guiderà e cosa no.

La rimappatura è verificata da `npm run check:naming`, che costruisce scheletri
sintetici nelle varie convenzioni e controlla nomi e track.

### Nota sulle licenze

Il repository è MIT e il GLB è versionato al suo interno, quindi l'asset viene
**ridistribuito**. Questo esclude le sorgenti i cui termini vietano la
ridistribuzione dei file grezzi, Mixamo compreso: usarne i personaggi dentro un
progetto è una cosa, pubblicarli in un repository è un'altra. Per materiale da
committare servono licenze CC0 o CC-BY (con attribuzione in `README`).


## 9. Il viso come texture

Il volto è `public/assets/face.png` — la caricatura originale del progetto
[Ritardometro](https://github.com/matteobaccan/Ritardometro) (stesso autore,
MIT) — applicata a una griglia curvata a parabola, agganciata al bone `Head`.

Come funziona:

- `tools/avatar/face.ts` contiene i riferimenti misurati sull'immagine (occhi,
  sopracciglia, bocca, mento, ritaglio) e la conversione da pixel a coordinate
  mondo. Se la texture cambia, si rimisurano quei punti e il resto segue.
- la superficie è ritagliata dal canale alfa della texture, quindi la sagoma è
  quella disegnata: non serve modellare un contorno;
- **la testa finisce al mento: niente collo, e un po' d'aria fra testa e
  maglione.** È il trucco del burattino, e risolve in un colpo solo tre
  problemi che insistevano tutti sullo stesso punto: il colletto della camicia
  dipinto nella caricatura (le cui punte risalgono fino alla mascella, quindi
  nessun taglio orizzontale le escludeva), l'ombra dipinta sul collo (presente
  su ogni riga, quindi inevitabile spostando il taglio) e la giunzione fra
  disegno e geometria, che a tre quarti si scopriva;
- il bordo inferiore (`chinBottomAt`) segue il **contorno nero disegnato della
  mascella**, misurato colonna per colonna sui pixel dell'asset: scende fino a
  y≈466 al centro e risale ai lati, perché il viso è leggermente girato. Non può
  essere un taglio arbitrario, perché con la testa staccata quel bordo è una
  linea di contorno a tutti gli effetti — il filtro dei bordi gli disegna
  attorno il tratto;
- il bordo laterale segue l'estensione dell'incarnato misurata riga per riga
  sull'asset (`FACE_EDGE`);
- il maglione è **chiuso in cima**: senza il collo a tapparla, l'apertura
  lascerebbe vedere lo sfondo attraverso il petto;
- `CHIN_Y` e l'altezza della costina del girocollo regolano insieme quanta aria
  resta fra testa e corpo;
- il materiale si chiama `face` nel GLB; a runtime `AvatarRenderer` gli applica
  la texture e lo rende **non illuminato**, perché luci e ombre sono già
  dipinte. Illuminarlo aggiungerebbe un secondo chiaroscuro.
- il filtro dei bordi tratta il viso come **solo profondità**: il disegno porta
  già i propri contorni, e senza questo accorgimento i bordi del collo e del
  colletto finirebbero stampati sopra la faccia.

### Espressioni su un viso disegnato

I pesi di skinning del viso non si calcolano per distanza dai bone come per il
resto del corpo: lì le articolazioni sono volumi, qui sono tratti disegnati.
Si usano **zone di influenza gaussiane** centrate sui punti misurati, come nel
rig 2D del Ritardometro. Ruotando `Lid_L` la pelle dipinta scende sopra
l'occhio: è così che il personaggio sbatte le palpebre pur essendo un disegno.

I bone facciali stanno *dietro* alla superficie, e la distanza è il braccio di
leva: 5 cm per le palpebre (una rotazione di 52° le chiude), 2,8 cm per la
mandibola. La mandibola è il movimento più delicato — trascinare troppo allunga
il mento invece di aprire le labbra — e per lo stesso motivo non c'è una vera
apertura della bocca: servirebbe disegnarla.

### Limiti dichiarati

- la testa regge rotazioni fino a circa 30°; oltre, la natura piatta si vede.
  Per questo gioco va bene: l'avatar guarda il giocatore. Con la testa staccata
  il margine è migliorato, perché non c'è più una giunzione da scoprire.
- niente bocca spalancata, niente sguardo che si sposta davvero: per quelli
  servono più disegni, o un viso modellato in 3D.
