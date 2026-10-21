# Six Seven

Web app interattiva con avatar 3D: un personaggio cartoon esegue una mossa
ispirata al meme *Six Seven* e invita il giocatore a replicarla davanti alla
telecamera.

**Stato: prototipo Fase 1.** L'avatar 3D è riggato, animato e caricato nel
browser come GLB. Il ciclo di gioco completo (turni, telecamera, microfono)
appartiene alle fasi successive — vedi `docs/PHASE1.md`.

![stato](https://img.shields.io/badge/fase-1%20prototipo%203D-40703a)

## Avvio rapido

```bash
npm install
npm run build:avatar   # genera public/assets/avatar.glb
npm run dev            # http://localhost:5173
```

Il GLB è versionato nel repository, quindi `npm run dev` funziona anche senza
rigenerarlo. Serve HTTPS solo per telecamera e microfono, che in Fase 1 non sono
ancora usati.

## Script

| Comando | Effetto |
| --- | --- |
| `npm run dev` | server di sviluppo |
| `npm run build:avatar` | costruisce mesh, scheletro e clip, scrive `public/assets/avatar.glb` |
| `npm run typecheck` | controllo dei tipi (app e tool separati) |
| `npm run build` | avatar + typecheck + bundle di produzione in `dist/` |
| `npm run preview` | serve il bundle di produzione |

## Struttura

```
src/
  avatar/
    AvatarRenderer.ts     scena, luci, camera, caricamento GLB, resa toon
    ToonLinePass.ts       contorni disegnati (rilevamento bordi in post)
    AnimationController.ts riproduzione e transizioni delle clip
    IdleLife.ts           micro-movimenti continui: palpebre, sguardo, respiro
  assets/
    AssetCatalog.ts       ID della specifica → clip del modello + metadati
    AvatarContract.ts     nomi attesi di bone e clip, con verifica del modello
  ui/UIController.ts      permessi, comandi, stato, diagnostica
  main.ts                 collante dei moduli (la macchina a stati arriva in Fase 2)

tools/                    pipeline di produzione dell'avatar (non va nel bundle)
  build-avatar.ts         orchestratore: assembla ed esporta il GLB
  avatar/rig.ts           scheletro e posa di riposo
  avatar/mesh.ts          geometria del personaggio
  avatar/clips.ts         animazioni come elenchi di pose
  avatar/timeline.ts      compilatore: pose → curve fluide
  avatar/palette.ts       colori, ricavati dalla caricatura di riferimento

docs/
  SPEC.md                 specifica di progetto 0.1
  PHASE1.md               cosa è stato realizzato, decisioni e punti aperti
  ASSET-CONTRACT.md       cosa serve per sostituire il modello 3D
```

## Sostituire il modello 3D

Il modello è un asset, non codice: basta rimpiazzare `public/assets/avatar.glb`
rispettando i nomi di bone e clip descritti in `docs/ASSET-CONTRACT.md`.
All'avvio l'applicazione confronta il modello con il contratto e mostra nel
pannello cosa ha riconosciuto.

## Licenza

MIT — vedi `LICENSE`.
