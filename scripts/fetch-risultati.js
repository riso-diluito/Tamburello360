/**
 * fetch-risultati.js
 * Scarica i risultati da federtamburellolivescore.it e crea i file .md in content/risultati/
 * 
 * CONFIGURAZIONE: aggiorna CAMPIONATI all'inizio di ogni stagione
 * Il campo `round` è opzionale — se null non viene inviato all'API
 */

const fs = require('fs');
const path = require('path');

// ============================================================
// CONFIGURAZIONE — aggiorna questi valori ogni stagione
// ============================================================
const CAMPIONATI = [
  {
    tid: 115,
    round: 946,
    serie: 'Serie A Open',
    tipo: 'outdoor',
    giornate: 18,
  },
];

const RISULTATI_DIR = path.join(__dirname, '..', 'content', 'risultati');
const API_URL = 'https://www.federtamburellolivescore.it/system/include/ajax/public/league.php';

// ============================================================
// FETCH DA API
// ============================================================
async function fetchGiornata(tid, round, matchDay) {
  const params = {
    op: '22',
    tid: String(tid),
    match_day: String(matchDay),
  };

  // Aggiunge round solo se presente
  if (round !== null && round !== undefined) {
    params.round = String(round);
  }

  const body = new URLSearchParams(params);

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
function parsePartite(html, campionato) {
  const partite = [];

  const matchBlocks = html.split('<div class="match-element">').slice(1);

  for (const block of matchBlocks) {
    if (block.includes('Turno di riposo')) continue;

    // Estrai data
    const headerMatch = block.match(/match-header[^>]*>([\s\S]*?)<\/div>/);
    if (!headerMatch) continue;
    const headerText = headerMatch[1].replace(/<[^>]*>/g, ' ').trim();

    const dateMatch = headerText.match(/(Lun|Mar|Mer|Gio|Ven|Sab|Dom)\s+(\d{1,2})\s+(\w{3})\s+(\d{2}:\d{2})/);
    let dataPartita = new Date().toISOString().split('T')[0];
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

    // Tiebreak: se la somma dei set è 3 (es. 2-1 o 1-2)
    const tiebreak = (scoreCasa + scoreOspite) === 3;

    partite.push({
      casa,
      ospite,
      scoreCasa,
      scoreOspite,
      tiebreak,
      data: dataPartita,
      serie: campionato.serie,
      tipo: campionato.tipo,
    });
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

function generaContenuto(p) {
  return `---
date: ${p.data}T12:00:00.000+01:00
serie: ${p.serie}
tipo: ${p.tipo}
home_team: ${p.casa}
away_team: ${p.ospite}
home_score: ${p.scoreCasa}
away_score: ${p.scoreOspite}
tiebreak: ${p.tiebreak}
auto_generated: true
---
`;
}

function salvaPartita(p) {
  if (!fs.existsSync(RISULTATI_DIR)) {
    fs.mkdirSync(RISULTATI_DIR, { recursive: true });
  }

  const slug = `${p.data}-${slugify(p.casa)}-vs-${slugify(p.ospite)}`;
  const filepath = path.join(RISULTATI_DIR, `${slug}.md`);

  if (fs.existsSync(filepath)) return false;

  fs.writeFileSync(filepath, generaContenuto(p), 'utf8');
  console.log(`  ✅ ${slug}`);
  return true;
}

// ============================================================
// MAIN
// ============================================================
async function main() {
  let totaleNuovi = 0;

  for (const campionato of CAMPIONATI) {
    console.log(`\n📥 ${campionato.serie} (tid=${campionato.tid})`);

    for (let g = 1; g <= campionato.giornate; g++) {
      try {
        process.stdout.write(`  Giornata ${g}... `);
        const html = await fetchGiornata(campionato.tid, campionato.round, g);
        if (g === 1) { console.log('HTML GIORNATA 1:', html.substring(0, 500)); break; }

        if (!html || html.trim() === '') {
          console.log('vuota, stop');
          break; // giornata vuota = fine campionato
        }

        const partite = parsePartite(html, campionato);

        if (partite.length === 0) {
          console.log('nessuna partita trovata');
          continue;
        }

        console.log(`${partite.length} partite trovate`);
        for (const p of partite) {
          if (salvaPartita(p)) totaleNuovi++;
        }

        await new Promise(r => setTimeout(r, 500));

      } catch (err) {
        console.error(`❌ Errore: ${err.message}`);
      }
    }
  }

  console.log(`\n✅ Completato. ${totaleNuovi} nuovi risultati salvati.`);
  process.exit(0);
}

main().catch(err => {
  console.error('❌ Errore fatale:', err);
  process.exit(1);
});
