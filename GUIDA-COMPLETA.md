# 🎯 GUIDA COMPLETA TAMBURELLO360 con ELEVENTY

## 📚 COSA È CAMBIATO

**PROBLEMA PRECEDENTE**: Il sito aveva dati "finti" scritti nel codice HTML. Il CMS salvava i dati ma nessuno li leggeva.

**SOLUZIONE NUOVA**: Uso **11ty (Eleventy)** che:
- Legge automaticamente i file dal CMS
- Genera le pagine HTML
- Ogni volta che aggiungi contenuti dal CMS → Netlify rigenera il sito
- **TUTTO FUNZIONA DAVVERO!**

---

## 🚀 INSTALLAZIONE - PASSO PER PASSO

### STEP 1: Elimina il vecchio repository

1. Vai su https://github.com
2. Trova il repository `tamburello360` (quello vecchio)
3. Clicca su "Settings" in alto a destra
4. Scorri in basso fino a "Danger Zone"
5. Clicca "Delete this repository"
6. Conferma scrivendo il nome del repository

### STEP 2: Crea un NUOVO repository

1. Su GitHub, clicca il pulsante "+" in alto → "New repository"
2. Nome: `tamburello360`
3. Descrizione: "Il primo sito in Italia che parla di tamburello"
4. Lascia su **Public**
5. **NON** spuntare "Add a README file"
6. Clicca "Create repository"

### STEP 3: Carica i NUOVI file

1. **Scarica il file ZIP** che ti sto per dare
2. **Estrai tutti i file** sul tuo computer
3. Nella pagina GitHub che si è aperta, clicca "uploading an existing file"
4. **Trascina TUTTI i file e le cartelle** estratti dallo ZIP
   - Assicurati di trascinare: .eleventy.js, package.json, netlify.toml, cartelle admin/, content/, public/, _includes/, ecc.
5. Scrivi come messaggio: "Nuova versione con Eleventy"
6. Clicca "Commit changes"

### STEP 4: Collega Netlify al NUOVO repository

#### A) Elimina il vecchio sito su Netlify:
1. Vai su https://netlify.com
2. Clicca sul tuo sito `tamburello360`
3. Vai su "Site settings"
4. Scorri in basso → "Delete site"
5. Conferma

#### B) Crea un NUOVO sito:
1. Nella dashboard Netlify, clicca "Add new site" → "Import an existing project"
2. Scegli "Deploy with GitHub"
3. Seleziona il repository `tamburello360` (quello che hai appena creato)
4. **IMPORTANTE - Impostazioni di build:**
   - **Build command**: `npm install && npx @11ty/eleventy`
   - **Publish directory**: `_site`
5. Clicca "Deploy site"
6. **ASPETTA 2-3 MINUTI** - Netlify sta installando tutto e generando il sito

### STEP 5: Configura Identity (CMS)

1. Quando il deploy è finito, vai su "Site settings"
2. Nel menu a sinistra, clicca "Identity"
3. Clicca "Enable Identity"
4. Scorri giù e clicca su "Enable Git Gateway"
5. Torna alla dashboard del sito
6. Clicca "Identity" nel menu in alto
7. Clicca "Invite users"
8. Inserisci la TUA email
9. Controlla la mail e clicca sul link di conferma
10. Crea una password

### STEP 6: PROVA IL SITO!

1. Vai su `tuosito.netlify.app`
2. Il sito dovrebbe funzionare con l'articolo di esempio
3. Vai su `tuosito.netlify.app/admin`
4. Fai login
5. **Aggiungi il tuo primo contenuto!**

---

## 📝 COME USARE IL CMS (Pannello Admin)

### Aggiungere un Articolo

1. Vai su `/admin`
2. Clicca "Articoli Blog"
3. Clicca "New Articoli Blog"
4. Compila tutti i campi:
   - **Titolo**: Il titolo dell'articolo
   - **Data**: Quando pubblichi
   - **Categoria**: Scegli dalla lista
   - **Immagine**: Carica un'immagine (opzionale ma consigliato)
   - **Breve Descrizione**: Per l'anteprima (2-3 righe)
   - **Contenuto**: Scrivi l'articolo in Markdown
   - **Tempo di lettura**: Stima i minuti
5. Clicca "Publish" → "Publish now"
6. **ASPETTA 1-2 MINUTI** - Netlify sta rigenerando il sito
7. Ricarica il sito e vedrai il tuo articolo!

### Scrivere in Markdown (Contenuto Articoli)

Markdown è semplicissimo:

```markdown
# Titolo grande
## Titolo medio
### Titolo piccolo

Testo normale. **Grassetto**. *Corsivo*.

- Lista punto 1
- Lista punto 2

1. Lista numerata 1
2. Lista numerata 2

[Link al sito](https://esempio.it)
```

### Aggiungere Classifiche

1. Clicca "Classifiche"
2. Clicca "New Classifiche"
3. Scegli la Serie (A, B, C, D)
4. Inserisci l'anno
5. Per ogni squadra clicca "Add teams":
   - Posizione (1, 2, 3...)
   - Nome squadra
   - Punti, Vittorie, Sconfitte
6. Clicca "Publish"
7. Aspetta 1-2 minuti → ricarica il sito!

### Aggiungere Risultati

1. Clicca "Risultati Partite"
2. Clicca "New Risultati Partite"
3. Compila:
   - Data della partita
   - Serie
   - Squadre e punteggi
   - Note (opzionale)
4. Publish
5. Aspetta → ricarica!

### Aggiungere Squadre (per la mappa)

1. Clicca "Squadre"
2. Clicca "New Squadre"
3. **IMPORTANTE** - Per Latitudine e Longitudine:
   - Vai su Google Maps
   - Cerca la città
   - Clicca destro → "Cosa c'è qui?"
   - Copia i due numeri (es. 45.4384, 10.9916)
   - Primo numero = Latitudine
   - Secondo = Longitudine
4. Compila tutti i campi
5. Publish
6. La squadra apparirà sulla mappa!

---

## ⚡ IMPORTANTE - COME FUNZIONA

### Il Ciclo di Aggiornamento

```
1. Tu aggiungi contenuti dal CMS (/admin)
   ↓
2. Il CMS salva su GitHub
   ↓
3. GitHub avvisa Netlify
   ↓
4. Netlify rigenera il sito con Eleventy (1-2 min)
   ↓
5. Il sito si aggiorna automaticamente!
```

**QUINDI**: Dopo ogni modifica nel CMS, aspetta 1-2 minuti e ricarica la pagina!

---

## 🔧 RISOLUZIONE PROBLEMI

### "Il sito non si aggiorna dopo una modifica"
- Aspetta 2-3 minuti (il build richiede tempo)
- Vai su Netlify → "Deploys" e controlla lo stato
- Se dice "Failed", guarda gli errori e scrivimi

### "Non riesco ad accedere a /admin"
- Verifica di aver abilitato Identity in Netlify
- Controlla di aver abilitato Git Gateway
- Prova a disconnetterti e riconnetterti

### "Le immagini non si vedono"
- Controlla che siano nella cartella corretta
- Nel CMS, quando carichi immagini vengono salvate automaticamente
- Aspetta che il build finisca

### "Gli articoli hanno un layout strano"
- Controlla di aver selezionato la categoria giusta
- Verifica il formato Markdown
- Ricontrolla i campi obbligatori

---

## 🎨 PERSONALIZZAZIONI

### Cambiare i Colori

1. Su GitHub, vai nel tuo repository
2. Naviga in `public/css/style.css`
3. Clicca l'icona della matita (Edit)
4. Cambia le prime righe:

```css
:root {
    --primary: #d62828;      /* Rosso principale */
    --secondary: #003049;    /* Blu scuro */
    --accent: #f77f00;       /* Arancione */
}
```

5. Scrolla in basso → "Commit changes"
6. Aspetta che Netlify rigeneri (1-2 min)

---

## 📊 DIFFERENZE CON LA VERSIONE PRECEDENTE

| Feature | Prima (Statico) | Ora (Eleventy) |
|---------|----------------|----------------|
| **Articoli** | Dati finti | Dal CMS ✅ |
| **Classifiche** | Esempi fissi | Dal CMS ✅ |
| **Risultati** | Esempi fissi | Dal CMS ✅ |
| **Mappa** | Non funzionava | Funziona ✅ |
| **Pagine articolo** | Non esistevano | Generate automaticamente ✅ |
| **Aggiornamenti** | Modifica codice | Dal pannello admin ✅ |

---

## 🎯 PROSSIMI PASSI

1. **Aggiungi i tuoi primi 3 articoli** dal blog Altervista
2. **Inserisci le classifiche reali** (almeno Serie A e B)
3. **Aggiungi 10-15 squadre** con le coordinate per la mappa
4. **Condividi il sito!**

---

## ❓ DOMANDE FREQUENTI

**Q: Devo pagare qualcosa?**
A: NO! Tutto gratuito (GitHub, Netlify, Eleventy).

**Q: Posso usare il mio dominio?**
A: Sì! In Netlify → Settings → Domain management → Add custom domain

**Q: Posso tornare alla versione vecchia?**
A: Sì, su GitHub hai la cronologia completa. Ma questa funziona meglio!

**Q: Come faccio il backup?**
A: GitHub È il backup! Tutto è salvato lì automaticamente.

**Q: Quanto tempo ci vuole per aggiornare il sito?**
A: 1-2 minuti dopo ogni modifica nel CMS.

---

## 📞 SUPPORTO

Se hai problemi:
1. Controlla questa guida
2. Vai su Netlify → Deploys e controlla gli errori
3. Scrivimi descrivendo il problema

---

**Buon lavoro con il nuovo Tamburello360!** 🎾

*Adesso hai un sito veramente professionale e funzionante!*
