/**
 * fetch-archivio.js
 * Scarica le stagioni outdoor passate dall'API e crea i file .md in content/archivio/
 * 
 * Stagioni configurate: 2022, 2023, 2024, 2025
 * Sistema punti outdoor: 2-0 = 3pt/0pt | 2-1 = 2pt/1pt
 */

const fs = require('fs');
const path = require('path');

const STAGIONI = [
  {
    anno: 2025,
    campionati: [
      { tid: 90, round: 719, serie: 'Serie A Open 2025', giornate: 18 },
      { tid: 91, round: 720, serie: 'Serie B Open 2025', giornate: 18 },
    ]
  },
  {
    anno: 2024,
    campionati: [
      { tid: 71, round: 595, serie: 'Serie A Open 2024', giornate: 18 },
      { tid: 72, round: 597, serie: 'Serie B Open 2024', giornate: 22 },
    ]
  },
  {
    anno: 2023,
    campionati: [
      { tid: 45, round: 398, serie: 'Serie A Open 2023', giornate: 22 },
      { tid: 46, round: 399, serie: 'Serie B Open 2023', giornate: 22 },
    ]
  },
  {
    anno: 2022,
    campionati: [
      { tid: 22, round: 255, serie: 'Serie A Open 2022', giornate: 22 },
      { tid: 23, round: 260, serie: 'Serie B Open 2022', giornate: 22 },
    ]
  },
];

const ARCHIVIO_DIR = path.join(__dirname, '..', 'content', 'archivio');
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

  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  return json.html || '';
}

// ============================================================
// PARSING HTML — formato outdoor
// ============================================================
function parsePartite(html, serie, anno) {
  const partite = [];
  const matchBlocks = html.split('<div class="match-element">').slice(1);

  for (const block of matchBlocks) {
    if (block.includes('Turno di riposo')) continue;

    // Data
    const headerMatch = block.match(/match-header[^>]*>([\s\S]*?)<\/div>/);
    let dataPartita = `${anno}-01-01`;
    if (headerMatch) {
      const headerText = headerMatch[1].replace(/<[^>]*>/g, ' ').trim();
      const dateMatch = headerText.match(/(Lun|Mar|Mer|Gio|Ven|Sab|Dom)\s+(\d{1,2})\s+(\w{3})/);
      if (dateMatch) {
        const mesi = { GEN:1, FEB:2, MAR:3, APR:4, MAG:5, GIU:6, LUG:7, AGO:8, SET:9, OTT:10, NOV:11, DIC:12 };
        const giorno = parseInt(dateMatch[2]);
        const mese = mesi[dateMatch[3].toUpperCase()];
        if (mese) {
          dataPartita = `${anno}-${String(mese).padStart(2,'0')}-${String(giorno).padStart(2,'0')}`;
        }
      }
    }

    // Nomi squadre
    const nomiMatch = [...block.matchAll(/class='participant-name[^']*'>\s*([\s\S]*?)\s*<\/div>/g)];
    if (nomiMatch.length < 2) continue;
    const casa = nomiMatch[0][1].trim();
    const ospite = nomiMatch[1][1].trim();
    if (!casa || !ospite) continue;

    let scoreCasa, scoreOspite, tiebreak;

    // FORMATO VECCHIO: class='score' con set vinti direttamente (es. 0 e 2)
    const scoreVecchio = [...block.matchAll(/class='score'>(\d+)<\/div>/g)];
    if (scoreVecchio.length >= 2) {
      scoreCasa = parseInt(scoreVecchio[0][1]);
      scoreOspite = parseInt(scoreVecchio[1][1]);
      tiebreak = (scoreCasa === 2 && scoreOspite === 1) || (scoreCasa === 1 && scoreOspite === 2);
    } else {
      // FORMATO NUOVO: score-container con set singoli, chi ha 'winner' vince il set
      // Ogni score-container è un set, conta i winner per ciascuna squadra
      const scoreContainers = [...block.matchAll(/<div class="score-container">([\s\S]*?)<\/div>\s*<\/div>/g)];

      if (scoreContainers.length === 0) continue;

      let setCasa = 0;
      let setOspite = 0;

      for (const container of scoreContainers) {
        const contenuto = container[1];
        // I due div set: primo = casa, secondo = ospite
        const sets = [...contenuto.matchAll(/<div class='set([^']*)'>/g)];
        if (sets.length < 2) continue;
        // chi ha 'winner' nella classe vince il set
        if (sets[0][1].includes('winner')) setCasa++;
        else if (sets[1][1].includes('winner')) setOspite++;
      }

      if (setCasa === 0 && setOspite === 0) continue;
      if (setCasa !== 2 && setOspite !== 2) continue; // partita non conclusa

      scoreCasa = setCasa;
      scoreOspite = setOspite;
      tiebreak = scoreContainers.length === 3; // 3 set giocati = tie break
    }

    partite.push({ casa, ospite, scoreCasa, scoreOspite, tiebreak, data: dataPartita, serie });
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

function generaContenuto(partita) {
  return `---
date: ${partita.data}T12:00:00.000+01:00
serie: ${partita.serie}
home_team: ${partita.casa}
away_team: ${partita.ospite}
home_score: ${partita.scoreCasa}
away_score: ${partita.scoreOspite}
tiebreak: ${partita.tiebreak}
tipo: outdoor
auto_generated: true
---
`;
}

function salvaPartita(partita) {
  if (!fs.existsSync(ARCHIVIO_DIR)) {
    fs.mkdirSync(ARCHIVIO_DIR, { recursive: true });
  }

  const slug = `${partita.data}-${slugify(partita.casa)}-vs-${slugify(partita.ospite)}`;
  const filepath = path.join(ARCHIVIO_DIR, `${slug}.md`);

  if (fs.existsSync(filepath)) return false;

  fs.writeFileSync(filepath, generaContenuto(partita), 'utf8');
  console.log(`  ✅ ${slug}`);
  return true;
}

// ============================================================
// MAIN
// ============================================================
async function main() {
  let totale = 0;

  for (const stagione of STAGIONI) {
    console.log(`\n📅 Stagione ${stagione.anno}`);

    for (const campionato of stagione.campionati) {
      console.log(`  📥 ${campionato.serie}`);

      for (let g = 1; g <= campionato.giornate; g++) {
        try {
          process.stdout.write(`    Giornata ${g}... `);
          const html = await fetchGiornata(campionato.tid, campionato.round, g);

          if (!html || html.trim() === '') {
            console.log('vuota');
            continue;
          }

          const partite = parsePartite(html, campionato.serie, stagione.anno);

          if (partite.length === 0) {
            console.log('nessuna partita');
            continue;
          }

          console.log(`${partite.length} partite`);
          for (const p of partite) {
            if (salvaPartita(p)) totale++;
          }

          await new Promise(r => setTimeout(r, 400));

        } catch (err) {
          console.log(`❌ ${err.message}`);
        }
      }
    }
  }

  console.log(`\n✅ Completato. ${totale} partite salvate in content/archivio/`);
  process.exit(0);
}

main().catch(err => {
  console.error('❌ Errore fatale:', err);
  process.exit(1);
});
