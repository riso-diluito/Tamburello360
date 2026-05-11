const ITALY_TIMEZONE = 'Europe/Rome';
const {
  MATCH_COLOR_FALLBACK,
  buildMapUrl,
  buildTeamDatabase,
  buildTeamLookup,
  normalizeKey,
  normalizeSerieCode,
  resolveTeamReference,
  slugify,
  toNumberOrNull
} = require('./team-database');

const DAY_FORMATTER = new Intl.DateTimeFormat('it-IT', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  timeZone: ITALY_TIMEZONE
});

const TIME_FORMATTER = new Intl.DateTimeFormat('it-IT', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: ITALY_TIMEZONE
});

function isValidDate(value) {
  return value instanceof Date && !Number.isNaN(value.getTime());
}

function parseDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return isValidDate(date) ? date : null;
}

function capitalizeLabel(value) {
  const cleaned = String(value || '').replace(/\./g, '').trim();
  if (!cleaned) return '';
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1, 3);
}

function formatMatchDay(dateValue) {
  const date = parseDate(dateValue);
  if (!date) return '';

  const parts = DAY_FORMATTER.formatToParts(date).reduce((acc, part) => {
    acc[part.type] = part.value;
    return acc;
  }, {});

  const weekday = capitalizeLabel(parts.weekday);
  const month = capitalizeLabel(parts.month);
  const day = String(parts.day || '').trim();

  return [weekday, day, month].filter(Boolean).join(' ');
}

function formatMatchTime(dateValue) {
  const date = parseDate(dateValue);
  if (!date) return '';

  return TIME_FORMATTER.format(date);
}

function buildGradient(homeColor, awayColor) {
  const left = homeColor || MATCH_COLOR_FALLBACK;
  const right = awayColor || MATCH_COLOR_FALLBACK;
  return `linear-gradient(135deg, ${left} 0%, ${left} 35%, ${right} 65%, ${right} 100%)`;
}

function normalizeState(data) {
  // Prima controlla il campo `giocata` aggiunto dal nuovo fetch-risultati.js
  if (data.giocata === true || data.giocata === 'true') {
    return 'giocata';
  }
  if (data.giocata === false || data.giocata === 'false') {
    return 'da_giocare';
  }

  // Poi controlla il campo `stato` (compatibilità con vecchi file)
  const explicitState = normalizeKey(data.stato || '');
  if (explicitState === 'giocata' || explicitState === 'played') {
    return 'giocata';
  }
  if (explicitState === 'da giocare' || explicitState === 'da_giocare' || explicitState === 'scheduled') {
    return 'da_giocare';
  }

  // Infine controlla se ci sono punteggi
  const homeGoals = toNumberOrNull(data.gol_casa ?? data.home_score);
  const awayGoals = toNumberOrNull(data.gol_ospite ?? data.away_score);
  if (homeGoals !== null && awayGoals !== null) {
    return 'giocata';
  }

  return 'da_giocare';
}

function buildMatchId(entry) {
  const data = entry.data || {};
  return String(data.id || entry.fileSlug || (entry.page && entry.page.fileSlug) || '').trim();
}

function enrichMatch(entry, teamLookup) {
  const data = entry.data || {};
  const id = buildMatchId(entry);

  // Mantieni il nome serie originale per il filtro, non normalizzare
  const serieRaw = String(data.serie || '').trim();
  const serie = normalizeSerieCode(serieRaw); // usato per ordinamento
  const giornata = Math.max(1, Number(data.giornata) || 1);

  const homeReference = data.squadra_casa || data.home_team || '';
  const awayReference = data.squadra_ospite || data.away_team || '';
  const homeTeam = resolveTeamReference(homeReference, teamLookup);
  const awayTeam = resolveTeamReference(awayReference, teamLookup);

  const state = normalizeState(data);
  const homeGoals = toNumberOrNull(data.gol_casa ?? data.home_score);
  const awayGoals = toNumberOrNull(data.gol_ospite ?? data.away_score);
  const matchDate = parseDate(data.data || data.date);
  const isoDate = matchDate ? matchDate.toISOString() : '';
  const sortTimestamp = matchDate ? matchDate.getTime() : Number.MAX_SAFE_INTEGER;

  const isPlayed = state === 'giocata' && homeGoals !== null && awayGoals !== null;

  return {
    id,
    serie,
    serie_raw: serieRaw,
    serie_label: serie ? `Serie ${serie}` : serieRaw,
    giornata,
    squadra_casa: homeTeam.team_code,
    squadra_ospite: awayTeam.team_code,
    home_team: homeTeam,
    away_team: awayTeam,
    data_iso: isoDate,
    stato: state,
    gol_casa: homeGoals,
    gol_ospite: awayGoals,
    sort_timestamp: sortTimestamp,
    is_played: isPlayed,
    date_day_label: formatMatchDay(matchDate),
    date_time_label: formatMatchTime(matchDate),
    score_label: isPlayed ? `${homeGoals} - ${awayGoals}` : '',
    map_url: buildMapUrl(homeTeam),
    info_url: `/partite/${encodeURIComponent(id)}/info/`,
    gradient: buildGradient(homeTeam.color_primary, awayTeam.color_primary)
  };
}

function sortMatches(left, right) {
  if (left.giornata !== right.giornata) {
    return left.giornata - right.giornata;
  }
  if (left.sort_timestamp !== right.sort_timestamp) {
    return left.sort_timestamp - right.sort_timestamp;
  }
  return left.id.localeCompare(right.id, 'it');
}

function getRecommendedGiornata(matches) {
  if (!matches || matches.length === 0) return 1;

  // Otteniamo la data e il giorno della settimana in Italia
  const oraItalia = new Date(new Date().toLocaleString("en-US", {timeZone: ITALY_TIMEZONE}));
  const oggiStr = oraItalia.toISOString().split('T')[0];
  const giornoSettimana = oraItalia.getDay(); // 0=Dom, 1=Lun, 2=Mar, 3=Mer, 4=Gio, 5=Ven, 6=Sab

  // Controlliamo se c'è una partita proprio oggi
  const cEPartitaOggi = matches.some(m => m.data_iso && m.data_iso.startsWith(oggiStr));

  // Logica richiesta:
  // Gio(4), Ven(5), Sab(6), Dom(0) -> Mostra Prossime (non giocate)
  // Mer(3) se c'è partita oggi -> Mostra Prossime
  // Altrimenti (Lun, Mar, Mer senza partite) -> Mostra Risultati (ultime giocate)
  const cercaFuture = (giornoSettimana === 0 || giornoSettimana >= 4) || (giornoSettimana === 3 && cEPartitaOggi);

  if (cercaFuture) {
    const prossime = matches.filter(m => !m.is_played);
    return prossime.length > 0 ? Math.min(...prossime.map(m => m.giornata)) : Math.max(...matches.map(m => m.giornata));
  } else {
    const passate = matches.filter(m => m.is_played);
    return passate.length > 0 ? Math.max(...passate.map(m => m.giornata)) : 1;
  }
}

function buildEnrichedMatches(matchEntries, teamLookup) {
  const enriched = (matchEntries || [])
    .map((entry) => enrichMatch(entry, teamLookup))
    .filter((match) => {
      if (!match.id) return false;
      // Mostra solo partite Serie A Open e Serie B Open, escludi test e mondiali
      const raw = match.serie_raw.toLowerCase();
      return raw.includes('serie a open') || raw.includes('serie b open');
    })
    .sort(sortMatches);

  const recommendedG = getRecommendedGiornata(enriched);
  return enriched.map(m => ({
    ...m,
    is_recommended: m.giornata === recommendedG
  }));
}

module.exports = {
  MATCH_COLOR_FALLBACK,
  buildEnrichedMatches
};
