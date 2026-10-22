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

## Lingua

Codice, commenti, messaggi di commit e documentazione in `docs/` sono in
italiano. `README.en.md` è l'unico documento in inglese.
