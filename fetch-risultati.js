/**
 * fetch-risultati.js
 * Scarica i risultati da federtamburellolivescore.it e crea i file .md in content/risultati/
 * 
 * CONFIGURAZIONE: aggiorna CAMPIONATI all'inizio di ogni stagione
 */

const fs = require('fs');
const path = require('path');

// ============================================================
// CONFIGURAZIONE — aggiorna questi valori ogni stagione
// ============================================================
const CAMPIONATI = [
  {
    tid: 114,
    round: 971,
    serie: 'Mondiali Indoor - Gruppo A',
    giornate: 6,
  },
  {
    tid: 114,
    round: 962,
    serie: 'Mondiali Indoor - Gruppo B',
    giornate: 6,
  },
  {
    tid: 114,
    round: 963,
    serie: 'Mondiali Indoor - Gruppo C',
    giornate: 10,
  },
  // Aggiungi campionati outdoor qui quando inizia la stagione:
  // { tid: ???, round: ???, serie: 'Serie A Open', giornate: ?? },
];

const RISULTATI_DIR = path.join(__dirname, '..', 'content', 'risultati');
const API_URL = 'https://www.federtamburellolivescore.it/system/include/ajax/public/league.php';

// ============================================================
// FETCH DA API
// ============================================================
async function fetchGiornata(tid, round, matchDay) {
  const body = new URLSearchParams({
    op: '22',
    tid: String(tid),
    round: String(round),
    match_day: String(matchDay),
  });

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'Mozilla/5.0',
      'Referer': 'https://m.federtamburellolivescore.it/',
    },
    body: body.toString(),
  });

  if (!res.ok) throw new Error(`HTTP ${res.status} per giornata ${matchDay}`);
  const json = await res.json();
  return json.html || '';
}

// ============================================================
// PARSING HTML — estrae le partite dall'HTML restituito
// ============================================================
function parsePartite(html, serie) {
  const partite = [];

  // Trova tutti i blocchi match-element
  const matchBlocks = html.split('<div class="match-element">').slice(1);

  for (const block of matchBlocks) {
    // Salta i turni di riposo
    if (block.includes('Turno di riposo')) continue;

    // Estrai data dalla match-header
    const headerMatch = block.match(/match-header[^>]*>([\s\S]*?)<\/div>/);
    if (!headerMatch) continue;
    const headerText = headerMatch[1].replace(/<[^>]*>/g, ' ').trim();
    
    // Estrai luogo e data (es: "Monzambano - Palestra  Dom 01 FEB 11:00")
    const dateMatch = headerText.match(/(Lun|Mar|Mer|Gio|Ven|Sab|Dom)\s+(\d{1,2})\s+(\w{3})\s+(\d{2}:\d{2})/);
    let dataPartita = new Date().toISOString().split('T')[0]; // fallback oggi
    if (dateMatch) {
      const mesi = { GEN:0, FEB:1, MAR:2, APR:3, MAG:4, GIU:5, LUG:6, AGO:7, SET:8, OTT:9, NOV:10, DIC:11 };
      const giorno = parseInt(dateMatch[2]);
      const mese = mesi[dateMatch[3].toUpperCase()];
      const anno = new Date().getFullYear();
      if (mese !== undefined) {
        dataPartita = `${anno}-${String(mese + 1).padStart(2,'0')}-${String(giorno).padStart(2,'0')}`;
      }
    }

    // Estrai nomi squadre
    const nomiMatch = [...block.matchAll(/class='participant-name[^']*'>\s*([\s\S]*?)\s*<\/div>/g)];
    if (nomiMatch.length < 2) continue;
    const casa = nomiMatch[0][1].trim();
    const ospite = nomiMatch[1][1].trim();
    if (!casa || !ospite) continue;

    // Estrai punteggi
    const punteggiMatch = [...block.matchAll(/class='score'>\s*(\d+)\s*<\/div>/g)];
    if (punteggiMatch.length < 2) continue;
    const scoreCasa = parseInt(punteggiMatch[0][1]);
    const scoreOspite = parseInt(punteggiMatch[1][1]);

    partite.push({ casa, ospite, scoreCasa, scoreOspite, data: dataPartita, serie });
  }

  return partite;
}

// ============================================================
// SCRITTURA FILE .MD
// ============================================================
function slugify(str) {
  return str.toLowerCase()
    .replace(/[àáâã]/g, 'a').replace(/[èéêë]/g, 'e')
    .replace(/[ìíîï]/g, 'i').replace(/[òóôõ]/g, 'o')
    .replace(/[ùúûü]/g, 'u')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function generaFilename(partita) {
  const slug = `${partita.data}-${slugify(partita.casa)}-vs-${slugify(partita.ospite)}`;
  return `${slug}.md`;
}

function generaContenuto(partita) {
  return `---
date: ${partita.data}T12:00:00.000+01:00
serie: ${partita.serie}
home_team: ${partita.casa}
away_team: ${partita.ospite}
home_score: ${partita.scoreCasa}
away_score: ${partita.scoreOspite}
auto_generated: true
---
`;
}

function salvaPartita(partita) {
  if (!fs.existsSync(RISULTATI_DIR)) {
    fs.mkdirSync(RISULTATI_DIR, { recursive: true });
  }

  const filename = generaFilename(partita);
  const filepath = path.join(RISULTATI_DIR, filename);

  if (fs.existsSync(filepath)) {
    return false; // già esistente, salta
  }

  fs.writeFileSync(filepath, generaContenuto(partita), 'utf8');
  console.log(`  ✅ Salvato: ${filename}`);
  return true;
}

// ============================================================
// MAIN
// ============================================================
async function main() {
  let totaleNuovi = 0;

  for (const campionato of CAMPIONATI) {
    console.log(`\n📥 Campionato: ${campionato.serie}`);

    for (let giornata = 1; giornata <= campionato.giornate; giornata++) {
      try {
        console.log(`  Giornata ${giornata}...`);
        const html = await fetchGiornata(campionato.tid, campionato.round, giornata);
        
        if (!html || html.trim() === '') {
          console.log(`  ⏭️  Giornata ${giornata} vuota, skip`);
          continue;
        }

        const partite = parsePartite(html, campionato.serie);
        
        if (partite.length === 0) {
          console.log(`  ⏭️  Nessuna partita trovata alla giornata ${giornata}`);
          continue;
        }

        for (const partita of partite) {
          const nuova = salvaPartita(partita);
          if (nuova) totaleNuovi++;
        }

        // Pausa tra le richieste per non sovraccaricare il server
        await new Promise(r => setTimeout(r, 500));

      } catch (err) {
        console.error(`  ❌ Errore giornata ${giornata}: ${err.message}`);
      }
    }
  }

  console.log(`\n✅ Completato. ${totaleNuovi} nuovi risultati salvati.`);
  
  // Exit code 0 = ok, usato dalla GitHub Action
  process.exit(0);
}

main().catch(err => {
  console.error('❌ Errore fatale:', err);
  process.exit(1);
});
