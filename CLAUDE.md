# Istruzioni per Claude Code

## Commit

I commit sono firmati **solo** da Matteo Baccan:

```
git config user.name "Matteo Baccan"
git config user.email "matteo.baccan@gmail.com"
```

Niente `Co-Authored-By`, niente trailer di sessione, nessun altro riferimento
a Claude nel messaggio. L'identità git predefinita dei container di sessione è
`Claude <noreply@anthropic.com>`: va sovrascritta a livello di repository prima
del primo commit, altrimenti l'autore risulta sbagliato anche senza trailer.

## Prima di ogni push

`npm run build` deve passare: include generazione dell'avatar, typecheck e i
due controlli automatici. La CI esegue esattamente lo stesso comando, quindi
un push che fallisce in CI è un push che non era stato provato.

## L'avatar è generato ma versionato

`public/assets/avatar.glb` e `public/assets/face.png` sono prodotti da
`tools/avatar/`, ma stanno nel repository perché `npm run dev` funzioni senza
rigenerarli. La build è deterministica: chi tocca i sorgenti dell'avatar
rigenera e committa i file nello stesso commit, altrimenti la CI se ne accorge
e fallisce.

## Il GLB è compresso in fase di build

`npm run build:avatar` esporta il modello e poi lo comprime con meshopt
(`compress:avatar`). La compressione è deterministica, ed è ciò che permette al
controllo in CI di confrontare il file versionato con una ricostruzione. Il
decodificatore è agganciato in `AvatarRenderer`: un GLB non compresso continua a
caricarsi, uno compresso senza decodificatore no.

## ImgBot non tocca gli asset

`.imgbotconfig` esclude `public/assets/*` e `tools/avatar/face-source.png`.

I primi sono **generati**: una loro ottimizzazione esterna viene sovrascritta
dalla build successiva, e nel frattempo il controllo in CI che confronta il
file versionato con una ricostruzione fallisce. È già successo con la pull
request #6. La compressione di `face.png` è invece tarata dentro
`face-texture.ts`, dove resta: `deflateStrategy: 2` dà 211,7 kB contro i 213,9
a cui arrivava ImgBot.

Il secondo è l'originale della caricatura, versionato intatto per provenienza:
ricomprimerlo non cambia i pixel ma cambia il file, e quei 97 kB pesano solo
sul clone, non su chi gioca.

## Risorse statiche

Ogni risorsa caricata a runtime da `public/` passa da `assetUrl()`
(`src/assets/assetUrl.ts`), che le appende l'impronta del contenuto come
`?v=`. Niente URL costruite a mano con `import.meta.env.BASE_URL`: Vite mette
l'impronta nel nome di JS e CSS, ma i file in `public/` li copia col nome
originale, e senza query un browser che ha in cache il vecchio avatar continua
a servirlo dopo un rilascio che lo cambia.

Le impronte le calcola il plugin in `vite.config.ts` leggendo `public/`: non
vanno scritte a mano da nessuna parte. Aggiungere una risorsa significa solo
metterla in `public/` e chiederla con `assetUrl('percorso/servito')`.

## Lingua

Codice, commenti, messaggi di commit e documentazione in `docs/` sono in
italiano. `README.en.md` è l'unico documento in inglese.
