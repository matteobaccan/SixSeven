# Six Seven

*[Italiano](README.md) · [English](README.en.md)*

### ▶ [Gioca ora: matteobaccan.github.io/SixSeven](https://matteobaccan.github.io/SixSeven/)

Web app interattiva con avatar 3D: un personaggio cartoon esegue una mossa
ispirata al meme *Six Seven* e invita il giocatore a replicarla davanti alla
telecamera.

L'avatar è ibrido: **corpo 3D riggato** — serve per i gesti — e **viso dalla
caricatura originale**, applicato come texture a una superficie curva e animato
per zone di influenza (palpebre, sopracciglia, mandibola).

**Stato: giocabile.** Quattordici animazioni, turni alternati, rilevamento della
fine della mossa dalla telecamera e reazioni scelte in base al rumore raccolto.
A schermo si vede che cosa l'applicazione sente e vede: anteprima della
telecamera con l'indicatore di movimento, e livello della voce con le soglie in
vista, per capire se il verso è bastato.

L'avatar ha un'**aura**, disegnata dietro di lui: sale o scende a ogni turno
secondo quanto si agita il giocatore e quanto lo approva il pubblico. A zero
vince il giocatore; al massimo nessuno ha ribattuto, e l'avatar se la gode.
Resta da provare su dispositivi reali — vedi `docs/STATO.md`.

![stato](https://img.shields.io/badge/stato-giocabile-40703a)
![licenza](https://img.shields.io/badge/licenza-MIT-blue)

## Avvio rapido

```bash
npm install
npm run build:avatar   # genera public/assets/avatar.glb
npm run dev            # http://localhost:5173
```

Il GLB è versionato nel repository, quindi `npm run dev` funziona anche senza
rigenerarlo.

**Telecamera e microfono richiedono HTTPS** (o `localhost`): è una regola del
browser, non del gioco. Senza, l'avvio propone comunque di giocare senza
periferiche e i turni passano a tempo.

## Script

| Comando | Effetto |
| --- | --- |
| `npm run dev` | server di sviluppo |
| `npm run build:avatar` | costruisce mesh, scheletro e clip, scrive `public/assets/avatar.glb` |
| `npm run typecheck` | controllo dei tipi (app e tool separati) |
| `npm run check:naming` | verifica la rimappatura dei nomi dei bone |
| `npm run check:game` | verifica la logica dei turni, con timer finti |
| `npm run build` | avatar + typecheck + controlli + bundle di produzione in `dist/` |
| `npm run preview` | serve il bundle di produzione |

## Struttura

```
src/
  avatar/
    AvatarRenderer.ts     scena, luci, camera, caricamento GLB, resa toon
    ToonLinePass.ts       contorni disegnati (rilevamento bordi in post)
    AnimationController.ts riproduzione e transizioni delle clip
    IdleLife.ts           micro-movimenti continui: palpebre, sguardo, respiro
    AuraHalo.ts           l'aura disegnata dietro al personaggio
  assets/
    AssetCatalog.ts       ID della specifica → clip del modello + metadati
    AvatarContract.ts     nomi attesi di bone e clip, con verifica del modello
    BoneNaming.ts         rimappatura dei nomi da rig di terze parti
  game/
    GameStateMachine.ts   turni ed eventi, senza dipendenze da browser o sensori
    Aura.ts               punteggio dell'avatar e condizioni di fine partita
  sensors/
    PoseDetector.ts       fine della mossa, per differenza fra fotogrammi
    AudioReactionAnalyzer.ts  intensità della reazione sonora
  ui/UIController.ts      permessi, comandi, stato del turno, diagnostica
  main.ts                 collante: intenti della macchina → moduli concreti

tools/                    pipeline di produzione dell'avatar (non va nel bundle)
  visual/                 verifica nel browser: inquadratura, aura, mosse, sensori
  build-avatar.ts         orchestratore: assembla ed esporta il GLB
  avatar/rig.ts           scheletro e posa di riposo
  avatar/mesh.ts          geometria del personaggio
  avatar/clips.ts         animazioni come elenchi di pose
  avatar/timeline.ts      compilatore: pose → curve fluide
  avatar/palette.ts       colori, ricavati dalla caricatura di riferimento

docs/
  SPEC.md                 specifica di progetto 0.1
  STATO.md                cosa è realizzato, decisioni prese e punti aperti
  ASSET-CONTRACT.md       cosa serve per sostituire il modello 3D
  RILASCIO.md             come viene pubblicato e come si torna indietro
```

## Sostituire il modello 3D

Il modello è un asset, non codice: basta rimpiazzare `public/assets/avatar.glb`
rispettando i nomi di bone e clip descritti in `docs/ASSET-CONTRACT.md`. I rig di
terze parti con nomi diversi (Mixamo, Rigify, pacchetti CC0) vengono ricondotti
automaticamente ai nomi canonici.
All'avvio l'applicazione confronta il modello con il contratto e mostra nel
pannello cosa ha riconosciuto.

## Pubblicazione

Il gioco è online su **<https://matteobaccan.github.io/SixSeven/>**: ogni merge
in `main` ricostruisce e ripubblica. Telecamera e microfono richiedono
HTTPS — è una regola del browser, non una scelta del progetto — e quindi in
locale funzionano solo su `localhost`. Il procedimento completo, la
preparazione da fare una volta sola e il peso effettivo del primo caricamento
sono in `docs/RILASCIO.md`.

## Licenza

MIT — vedi `LICENSE`.

## Crediti

Il viso dell'avatar e la palette provengono dalla caricatura del progetto
[Ritardometro](https://github.com/matteobaccan/Ritardometro) dello stesso
autore, anch'esso MIT. L'originale è `tools/avatar/face-source.png`;
`public/assets/face.png` ne è l'elaborazione prodotta dalla build.
