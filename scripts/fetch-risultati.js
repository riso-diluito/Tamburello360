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
  // Aggiungi altri campionati qui:
  // {
  //   tid: ???,
  //   round: ???,
  //   serie: 'Serie B Open - Girone A',
  //   tipo: 'outdoor',
  //   giornate: 18,
  // },
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
// PARSING HTML — formato outdoor FIPT
// ============================================================
function parsePartite(html, campionato, giornata) {
  const partite = [];

  const matchBlocks = html.split('<div class="match-element">').slice(1);
  if (matchBlocks.length === 0) {
    console.warn(`  ⚠️  Nessun blocco partita trovato nell'HTML (giornata ${giornata}). Struttura HTML cambiata?`);
  }

  for (const block of matchBlocks) {
    if (block.includes('Turno di riposo')) continue;

    // Estrai data e ora
    const headerMatch = block.match(/match-header[^>]*>([\s\S]*?)<\/div>/);
    if (!headerMatch) continue;
    const headerText = headerMatch[1].replace(/<[^>]*>/g, ' ').trim();

    const dateMatch = headerText.match(/(Lun|Mar|Mer|Gio|Ven|Sab|Dom)\s+(\d{1,2})\s+(\w{3})\s+(\d{2}:\d{2})/);
    let dataPartita = new Date().toISOString().split('T')[0];
    let oraPartita = '00:00';

    if (dateMatch) {
      const mesi = { GEN:0, FEB:1, MAR:2, APR:3, MAG:4, GIU:5, LUG:6, AGO:7, SET:8, OTT:9, NOV:10, DIC:11 };
      const giorno = parseInt(dateMatch[2]);
      const mese = mesi[dateMatch[3].toUpperCase()];
      const anno = new Date().getFullYear();
      oraPartita = dateMatch[4];
      if (mese !== undefined) {
        dataPartita = `${anno}-${String(mese + 1).padStart(2,'0')}-${String(giorno).padStart(2,'0')}`;
      }
    }

    // Estrai nomi squadre
    const nomiMatch = [...block.matchAll(/<div class='participant-name[^']*'>\s*([^<]+?)\s*<\/div>/g)];
    if (nomiMatch.length < 2) {
      console.warn(`  ⚠️  Blocco partita saltato: nomi squadre non trovati (giornata ${giornata})`);
      continue;
    }
    const casa = nomiMatch[0][1].trim();
    const ospite = nomiMatch[1][1].trim();
    if (!casa || !ospite) continue;

    // Controlla se la partita è già giocata
    const scoreContainers = [...block.matchAll(/<div class="score-container">([\s\S]*?)<\/div>\s*<\/div>/g)]; // Contiene i set vinti

    // Partita non ancora giocata
    if (scoreContainers.length === 0) {
      partite.push({
        casa,
        ospite,
        scoreCasa: null,
        scoreOspite: null,
        tiebreak: false,
        data: dataPartita,
        ora: oraPartita,
        giocata: false,
        giornata: giornata,
        serie: campionato.serie,
        tipo: campionato.tipo,
      });
      continue;
    }

    // Partita giocata — conta set vinti da ciascuna squadra
    
    // Se ci sono scoreContainers, la partita è almeno iniziata o finita
    let setCasa = 0;
    let setOspite = 0;
    let isPlayed = false;
    let tiebreak = false;

    for (const container of scoreContainers) {
      const inner = container[1];
      const divs = [...inner.matchAll(/<div class='set([^']*)'>/g)];
      if (divs.length < 2) continue; // Un score-container deve avere almeno due div per i set
      if (divs[0][1].includes('winner')) setCasa++;
      else if (divs[1][1].includes('winner')) setOspite++;
    }
    
    // Una partita è considerata 'giocata' se una squadra ha vinto 2 set.
    if (setCasa === 2 || setOspite === 2) {
      isPlayed = true;
      tiebreak = scoreContainers.length === 3; // Il tiebreak è rilevante solo per partite finite con 3 set
    }

    partite.push({
      casa,
      ospite,
      scoreCasa: setCasa > 0 ? setCasa : null, // Salva i set attuali, o null se 0
      scoreOspite: setOspite > 0 ? setOspite : null, // Salva i set attuali, o null se 0
      tiebreak: isPlayed ? tiebreak : false, // Tiebreak è rilevante solo per partite finite
      data: dataPartita,
      ora: oraPartita,
      giocata: isPlayed, // True se 2 set vinti, false altrimenti (programmata o in corso)
      giornata: giornata,
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

// Funzione per leggere il frontmatter di un file Markdown
function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  
  const data = {};
  const lines = match[1].split('\n');
  
  for (const line of lines) {
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;
    const key = line.substring(0, colonIdx).trim();
    const value = line.substring(colonIdx + 1).trim();
    
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      data[key] = value.slice(1, -1);
    } else if (value === 'true') {
      data[key] = true;
    } else if (value === 'false') {
      data[key] = false;
    } else if (/^\d+(\.\d+)?$/.test(value)) {
      data[key] = Number(value);
    } else {
      data[key] = value;
    }
  }
  return data;
}

function generaContenuto(p) {
  const scoreHome = p.scoreCasa !== null ? p.scoreCasa : '';
  const scoreAway = p.scoreOspite !== null ? p.scoreOspite : '';

  return `---
date: ${p.data}T${p.ora}:00.000+01:00
serie: ${p.serie}
tipo: ${p.tipo}
giornata: ${p.giornata}
home_team: ${p.casa}
away_team: ${p.ospite}
home_score: ${scoreHome}
away_score: ${scoreAway}
tiebreak: ${p.tiebreak}
giocata: ${p.giocata}
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

  const newContent = generaContenuto(p);

  if (fs.existsSync(filepath)) {
    const existingContent = fs.readFileSync(filepath, 'utf8');
    
    // Se il file indica già che è finita, non caricarlo più se il contenuto non cambia
    const isAlreadyPlayed = existingContent.includes('giocata: true');
    if (isAlreadyPlayed && !newContent.includes('giocata: true')) return false; 
    
    // Se il nuovo contenuto è identico a quello esistente, non c'è bisogno di scrivere.
    if (newContent === existingContent) {
      return false;
    }

    // Se il contenuto è diverso, sovrascriviamo. Questo copre:
    // - Partita da "da giocare" a "in corso" (con punteggi parziali)
    // - Partita "in corso" con aggiornamento punteggi
    // - Partita da "in corso" a "giocata" (con punteggi finali)
    // - Correzioni a partite già giocate.
    fs.writeFileSync(filepath, newContent, 'utf8');
    let logMessage = `  🔄 ${slug} (giornata ${p.giornata}`;
    if (p.giocata) {
      logMessage += `, ${p.scoreCasa}-${p.scoreOspite} - FINITA)`;
    } else if (p.scoreCasa !== null || p.scoreOspite !== null) {
      logMessage += `, ${p.scoreCasa || '0'}-${p.scoreOspite || '0'} - IN CORSO)`;
    } else {
      logMessage += `, da giocare)`;
    }
    console.log(logMessage);
    return true;
  }

  // Se il file non esiste, scrivilo sempre
  fs.writeFileSync(filepath, newContent, 'utf8');
  console.log(`  ✅ ${slug} (giornata ${p.giornata}, ${p.giocata ? `${p.scoreCasa}-${p.scoreOspite}` : 'da giocare'})`);
  return true;
}

// Decide se avviare il fetch in base all'orario e alle partite locali
function shouldRunFetch() {
  const now = new Date();
  // Ora locale italiana (GitHub usa UTC)
  const oraItalia = new Date(now.toLocaleString("en-US", {timeZone: "Europe/Rome"}));
  const currentHour = oraItalia.getHours();

  // 1. Manutenzione: Alle 3 di notte e alle 10 di mattina scarichiamo tutto per sicurezza/sincronizzazione
  if (currentHour === 3 || currentHour === 10) {
    console.log("⏰ Finestra di sincronizzazione quotidiana. Avvio fetch...");
    return true;
  }

  if (!fs.existsSync(RISULTATI_DIR)) return true;

  const files = fs.readdirSync(RISULTATI_DIR).filter(f => f.endsWith('.md'));
  if (files.length === 0) return true;

  for (const file of files) {
    const content = fs.readFileSync(path.join(RISULTATI_DIR, file), 'utf8');
    const data = parseFrontmatter(content);

    // Consideriamo solo partite non ancora concluse
    if (data.giocata === true) continue;

    const matchDate = new Date(data.date);
    const diffMs = now - matchDate;
    const diffHours = diffMs / (1000 * 60 * 60);

    // Se la partita è prevista tra 1 ora o è iniziata da meno di 12 ore (catch-up dei risultati)
    if (diffHours >= -1 && diffHours <= 12) {
      console.log(`🎯 Partita attiva rilevata: ${file}. Avvio fetch...`);
      return true;
    }
  }

  console.log("💤 Nessuna partita imminente o in corso. Esecuzione saltata per risparmiare risorse.");
  return false;
}

// ============================================================
// MAIN
// ============================================================
async function main() {
  if (!shouldRunFetch()) process.exit(0);

  let totaleNuovi = 0;

  for (const campionato of CAMPIONATI) {
    console.log(`\n📥 ${campionato.serie} (tid=${campionato.tid}, round=${campionato.round})`);

    for (let g = 1; g <= campionato.giornate; g++) {
      try {
        process.stdout.write(`  Giornata ${g}... `);
        const html = await fetchGiornata(campionato.tid, campionato.round, g);

        if (!html || html.trim() === '') {
          console.log('vuota, stop');
          break;
        }

        const partite = parsePartite(html, campionato, g);

        if (partite.length === 0) {
          console.log('nessuna partita trovata');
          continue;
        }
        
        // Ottimizzazione: se tutte le partite di questa giornata sono ancora "da giocare"
        // e non ci sono punteggi parziali, assumiamo che le giornate successive siano anch'esse da giocare e fermiamo il ciclo.
        const allDaGiocareNoScores = partite.every(p => !p.giocata && p.scoreCasa === null && p.scoreOspite === null);
        if (allDaGiocareNoScores && g > 1) { // Non fermare alla prima giornata se è vuota
          console.log('tutte da giocare senza punteggi, stop');
          break; 
        }

        console.log(`${partite.length} partite`);
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
