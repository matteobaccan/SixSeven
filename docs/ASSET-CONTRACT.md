# Contratto dell'asset avatar

Questo documento è quanto serve per realizzare un modello 3D sostitutivo senza
toccare il motore di gioco. Il motore non conosce la pipeline che ha prodotto il
file: conosce solo i nomi elencati qui.

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
| S7-02 | `ReverseWeighing` | da fare | |
| S7-03 | `FingerSixSeven` | da fare | richiede le dita |
| S7-04 | `Handshake67` | da fare | |
| S7-05 | `ExtremeSixSeven` | da fare | |
| RX-03 | `Celebration` | da fare | |
| RX-04 | `Disappointed` | da fare | |
| RX-06 | `TurnTransition` | da fare | |

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
- **Nomi diversi dai nostri**: si aggiunge una tabella di rimappatura al
  caricamento, è una modifica di poche righe. Meglio comunque evitarla.
