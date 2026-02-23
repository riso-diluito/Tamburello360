/**
 * genera-classifiche.js
 * Legge tutti i risultati in content/risultati/ e rigenera i file
 * di classifica in content/classifiche/ automaticamente.
 * 
 * Sistema punti:
 *   INDOOR: Vittoria = 2 | Pareggio = 1 | Sconfitta = 0
 *   OUTDOOR: Vittoria 2-0 = 3/0 | Vittoria 2-1 (tiebreak) = 2/1
 */

const fs = require('fs');
const path = require('path');

const RISULTATI_DIR = path.join(__dirname, '..', 'content', 'risultati');
const CLASSIFICHE_DIR = path.join(__dirname, '..', 'content', 'classifiche');

// ============================================================
// LETTURA FRONTMATTER
// ============================================================
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
    } else if (!isNaN(value) && value !== '') {
      data[key] = Number(value);
    } else {
      data[key] = value;
    }
  }
  
  return data;
}

function leggiRisultati() {
  if (!fs.existsSync(RISULTATI_DIR)) return [];
  
  const files = fs.readdirSync(RISULTATI_DIR).filter(f => f.endsWith('.md'));
  const risultati = [];
  
  for (const file of files) {
    const content = fs.readFileSync(path.join(RISULTATI_DIR, file), 'utf8');
    const data = parseFrontmatter(content);
    
    if (data.home_team && data.away_team && 
        data.home_score !== undefined && data.away_score !== undefined &&
        data.serie) {
      risultati.push(data);
    }
  }
  
  return risultati;
}

// ============================================================
// CALCOLO CLASSIFICHE
// ============================================================
function assegnaPunti(r, serieTeams) {
  const casa = r.home_team;
  const ospite = r.away_team;

  if (!serieTeams[casa]) serieTeams[casa] = { name: casa, points: 0, wins: 0, draws: 0, losses: 0, played: 0 };
  if (!serieTeams[ospite]) serieTeams[ospite] = { name: ospite, points: 0, wins: 0, draws: 0, losses: 0, played: 0 };

  serieTeams[casa].played++;
  serieTeams[ospite].played++;

  const isOutdoor = r.tipo === 'outdoor' ||
    (r.serie && r.serie.toLowerCase().includes('open')) ||
    (r.serie && r.serie.toLowerCase().includes('serie a open')) ||
    (r.serie && r.serie.toLowerCase().includes('serie b open'));

  if (isOutdoor) {
    // Sistema outdoor: set vinti (home_score/away_score = es. 2/0 o 2/1)
    const casaVince = r.home_score > r.away_score;
    const tiebreak = r.tiebreak === true || (r.home_score === 2 && r.away_score === 1) || (r.home_score === 1 && r.away_score === 2);

    if (casaVince) {
      serieTeams[casa].wins++;
      serieTeams[ospite].losses++;
      if (tiebreak) {
        serieTeams[casa].points += 2;
        serieTeams[ospite].points += 1;
      } else {
        serieTeams[casa].points += 3;
        // ospite: 0
      }
    } else {
      serieTeams[ospite].wins++;
      serieTeams[casa].losses++;
      if (tiebreak) {
        serieTeams[ospite].points += 2;
        serieTeams[casa].points += 1;
      } else {
        serieTeams[ospite].points += 3;
        // casa: 0
      }
    }
  } else {
    // Sistema indoor: punteggio diretto (es. 13-4)
    if (r.home_score > r.away_score) {
      serieTeams[casa].wins++;
      serieTeams[casa].points += 2;
      serieTeams[ospite].losses++;
    } else if (r.away_score > r.home_score) {
      serieTeams[ospite].wins++;
      serieTeams[ospite].points += 2;
      serieTeams[casa].losses++;
    } else {
      serieTeams[casa].draws++;
      serieTeams[casa].points += 1;
      serieTeams[ospite].draws++;
      serieTeams[ospite].points += 1;
    }
  }
}

function calcolaClassifiche(risultati) {
  const bySerie = {};
  
  for (const r of risultati) {
    if (!bySerie[r.serie]) bySerie[r.serie] = {};
    assegnaPunti(r, bySerie[r.serie]);
  }
  
  return bySerie;
}

function ordinaClassifica(squadre) {
  return Object.values(squadre).sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.wins !== a.wins) return b.wins - a.wins;
    return a.name.localeCompare(b.name);
  });
}

// ============================================================
// SCRITTURA FILE CLASSIFICHE
// ============================================================
function slugifySerie(serie) {
  return serie.toLowerCase()
    .replace(/[àáâã]/g, 'a').replace(/[èéêë]/g, 'e')
    .replace(/[ìíîï]/g, 'i').replace(/[òóôõ]/g, 'o')
    .replace(/[ùúûü]/g, 'u')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function generaClassificaMd(serieName, squadreOrdinati) {
  const anno = new Date().getFullYear();
  const oggi = new Date().toISOString();
  
  let teamsYaml = '';
  squadreOrdinati.forEach((team, idx) => {
    teamsYaml += `  - position: ${idx + 1}
    name: ${team.name}
    points: ${team.points}
    wins: ${team.wins}
    draws: ${team.draws}
    losses: ${team.losses}
    played: ${team.played}
`;
  });

  return `---
serie: ${serieName}
year: ${anno}
updated: ${oggi}
teams:
${teamsYaml}---
`;
}

function salvaClassifica(serieName, squadreOrdinati) {
  if (!fs.existsSync(CLASSIFICHE_DIR)) {
    fs.mkdirSync(CLASSIFICHE_DIR, { recursive: true });
  }

  const filename = `${slugifySerie(serieName)}-${new Date().getFullYear()}.md`;
  const filepath = path.join(CLASSIFICHE_DIR, filename);
  const content = generaClassificaMd(serieName, squadreOrdinati);
  
  fs.writeFileSync(filepath, content, 'utf8');
  console.log(`  ✅ Classifica salvata: ${filename} (${squadreOrdinati.length} squadre)`);
}

// ============================================================
// MAIN
// ============================================================
function main() {
  console.log('📊 Lettura risultati...');
  const risultati = leggiRisultati();
  console.log(`   ${risultati.length} risultati trovati`);

  if (risultati.length === 0) {
    console.log('⚠️  Nessun risultato trovato, classifiche non aggiornate.');
    process.exit(0);
  }

  console.log('\n📈 Calcolo classifiche...');
  const classifiche = calcolaClassifiche(risultati);

  console.log('\n💾 Salvataggio classifiche...');
  for (const [serie, squadre] of Object.entries(classifiche)) {
    const ordinati = ordinaClassifica(squadre);
    console.log(`\n  ${serie}:`);
    ordinati.forEach((t, i) => {
      console.log(`    ${i+1}. ${t.name} — ${t.points} pt (${t.wins}V ${t.draws}P ${t.losses}S)`);
    });
    salvaClassifica(serie, ordinati);
  }

  console.log('\n✅ Classifiche aggiornate con successo.');
  process.exit(0);
}

main();
