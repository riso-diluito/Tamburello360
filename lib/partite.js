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

function isValidDate(value) {
  return value instanceof Date && !Number.isNaN(value.getTime());
}

function parseDate(value) {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);
  return isValidDate(date) ? date : null;
}

function capitalizeLabel(value) {
  const cleaned = String(value || '').replace(/\./g, '').trim();
  if (!cleaned) {
    return '';
  }

  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1, 3);
}

function formatMatchDay(dateValue) {
  const date = parseDate(dateValue);
  if (!date) {
    return '';
  }

  const formatter = new Intl.DateTimeFormat('it-IT', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: ITALY_TIMEZONE
  });

  const parts = formatter.formatToParts(date).reduce((acc, part) => {
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
  if (!date) {
    return '';
  }

  return new Intl.DateTimeFormat('it-IT', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: ITALY_TIMEZONE
  }).format(date);
}

function buildGradient(homeColor, awayColor) {
  const left = homeColor || MATCH_COLOR_FALLBACK;
  const right = awayColor || MATCH_COLOR_FALLBACK;
  return `linear-gradient(135deg, ${left} 0%, ${left} 35%, ${right} 65%, ${right} 100%)`;
}

function normalizeState(data) {
  const explicitState = normalizeKey(data.stato);
  const homeGoals = toNumberOrNull(data.gol_casa ?? data.home_score);
  const awayGoals = toNumberOrNull(data.gol_ospite ?? data.away_score);

  if (explicitState === 'giocata' || explicitState === 'played') {
    return 'giocata';
  }

  if (explicitState === 'da giocare' || explicitState === 'da_giocare' || explicitState === 'scheduled') {
    return 'da_giocare';
  }

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
  const serie = normalizeSerieCode(data.serie);
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

  return {
    id,
    serie,
    serie_label: serie ? `Serie ${serie}` : '',
    giornata,
    squadra_casa: homeTeam.team_code,
    squadra_ospite: awayTeam.team_code,
    home_team: homeTeam,
    away_team: awayTeam,
    data_iso: isoDate,
    stato: state,
    gol_casa: homeGoals,
    gol_ospite: awayGoals,
    is_played: state === 'giocata' && homeGoals !== null && awayGoals !== null,
    date_day_label: formatMatchDay(matchDate),
    date_time_label: formatMatchTime(matchDate),
    score_label: homeGoals !== null && awayGoals !== null ? `${homeGoals} - ${awayGoals}` : '',
    map_url: buildMapUrl(homeTeam),
    info_url: `/partite/${encodeURIComponent(id)}/info/`,
    gradient: buildGradient(homeTeam.color_primary, awayTeam.color_primary)
  };
}

function sortMatches(left, right) {
  if (left.serie !== right.serie) {
    return left.serie.localeCompare(right.serie, 'it');
  }

  if (left.giornata !== right.giornata) {
    return left.giornata - right.giornata;
  }

  const leftDate = left.data_iso ? new Date(left.data_iso).getTime() : Number.MAX_SAFE_INTEGER;
  const rightDate = right.data_iso ? new Date(right.data_iso).getTime() : Number.MAX_SAFE_INTEGER;

  if (leftDate !== rightDate) {
    return leftDate - rightDate;
  }

  return left.id.localeCompare(right.id, 'it');
}

function buildEnrichedMatches(matchEntries, teamEntries) {
  const teamDatabase = buildTeamDatabase(teamEntries);
  const teamLookup = buildTeamLookup(teamDatabase);

  return (matchEntries || [])
    .map((entry) => enrichMatch(entry, teamLookup))
    .filter((match) => match.id && match.serie === 'A')
    .sort(sortMatches);
}

module.exports = {
  MATCH_COLOR_FALLBACK,
  buildEnrichedMatches
};
