# Rilascio

## Dove va pubblicato, e perché lì

Il gioco è un sito statico: `npm run build` produce `dist/`, che qualsiasi
hosting di file statici può servire. La scelta di GitHub Pages non è dovuta
alla comodità ma a un vincolo del browser.

`getUserMedia` — telecamera e microfono — è disponibile solo in **contesto
sicuro**: HTTPS, oppure `localhost`. Su `http://` semplice il browser non
mostra nemmeno la richiesta di permesso: la chiamata fallisce e basta. Quindi
qualunque indirizzo pubblico su cui il gioco debba funzionare davvero, e non
solo nella modalità *Gioca senza*, deve essere in HTTPS. Pages lo fornisce
senza configurazione, il repository è già su GitHub, e `vite.config.ts` usa
`base: './'`, cioè percorsi relativi: il bundle funziona anche sotto un
sottopercorso come `/SixSeven/` senza modifiche.

L'indirizzo sarà `https://matteobaccan.github.io/SixSeven/`.

## Preparazione, una volta sola

Un passaggio richiede la tua mano, perché una Action non può abilitarsi Pages
da sé: **Settings → Pages → Build and deployment → Source: GitHub Actions**.

Senza questo passaggio il workflow `deploy` fallisce con *Pages is not
enabled*; non è un errore nel codice.

## Come si rilascia

Non c'è un comando da dare: il rilascio coincide con l'ingresso in `main`.

1. La pull request viene controllata da `.github/workflows/ci.yml`:
   `npm run build` (generazione dell'avatar, typecheck, `check:naming`,
   `check:game`, bundle), più la verifica che il GLB versionato corrisponda
   davvero ai sorgenti e che `npm audit` sia pulito.
2. Al merge in `main`, `.github/workflows/deploy.yml` ricostruisce da zero e
   pubblica `dist/` su Pages.
3. Un paio di minuti dopo l'indirizzo serve la versione nuova.

`workflow_dispatch` permette di ripubblicare a mano senza un commit nuovo, per
esempio dopo aver cambiato qualcosa nelle impostazioni di Pages.

Il deploy ricostruisce invece di riusare l'artefatto della CI: sono due minuti
in più, ma il contenuto pubblicato è sempre il risultato di una build completa
e verificabile dal commit, non di un artefatto trasportato fra workflow.

## Versioni

Il progetto non ha ancora numeri di versione (`package.json` è a `0.1.0`).
Per avere una storia leggibile, al primo rilascio conviene annotare il punto:

```bash
git tag -a v0.1.0 -m "Primo prototipo giocabile"
git push origin v0.1.0
```

I tag non innescano il deploy — che segue `main` — ma danno un riferimento
preciso a cui tornare.

## Tornare indietro

Pages serve l'ultimo deploy riuscito. Per annullare un rilascio ci sono due
strade: `git revert` del commit e push in `main`, che riparte dalla CI e
ripubblica in modo pulito; oppure, se serve subito, **Actions → Deploy →** un
run precedente → *Re-run all jobs*, che ripubblica quel commit senza toccare la
storia.

## Cosa scarica chi apre il gioco

Misurato sulla build attuale:

| file | sul disco | in transito |
|---|---:|---:|
| `avatar.glb` (meshopt) | 334 kB | 334 kB |
| `face.png` (ritagliata) | 221 kB | 221 kB |
| chunk `three` | 579 kB | 144 kB |
| applicazione (JS + CSS + HTML) | 57 kB | 18 kB |

Il primo caricamento è di circa **720 kB**: Pages comprime i file di testo, non
i binari, quindi GLB e PNG viaggiano come stanno sul disco. Il GLB di suo
comprimerebbe a 136 kB, ma non è una leva che abbiamo noi.

La voce più pesante è ormai `face.png`, e il margine che resta su di lei è
descritto nei punti aperti di `STATO.md`.

Una nota sulla cache, perché è un problema che si è già presentato. I file in
`public/` vengono serviti **con il nome originale**, al contrario di JS e CSS
che Vite rinomina a ogni build mettendo l'impronta nel nome: un browser che
aveva in cache il vecchio `avatar.glb` continuava a servirlo dopo un rilascio
che lo cambiava, e il gioco mostrava le animazioni di ieri senza che niente
sembrasse rotto.

Ora ogni risorsa statica è chiesta attraverso `assetUrl()`, che le appende
l'impronta del contenuto come `?v=`; le impronte le calcola il plugin in
`vite.config.ts` leggendo `public/` in fase di build. È l'impronta del
contenuto e non la data della build: cambia quando il file cambia davvero,
quindi un rilascio che non tocca l'avatar non costringe nessuno a riscaricare
un megabyte.
