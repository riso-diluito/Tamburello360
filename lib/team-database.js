const MATCH_COLOR_FALLBACK = '#888888';

function normalizeKey(value) {
  return String(value || '')
    .replace(/[._-]/g, ' ')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '') // Rimuove punti e simboli (A.S.D. diventa ASD)
    .replace(/\s+/g, ' ');       // Rimuove spazi doppi
}

function slugify(value) {
  return normalizeKey(value)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function normalizeSerieCode(value) {
  const n = normalizeKey(value);
  if (n === 'a' || n === 'serie a' || n.includes('serie a')) return 'A';
  if (n === 'b' || n === 'serie b' || n.includes('serie b')) return 'B';
  return '';
}

function toNumberOrNull(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function buildMapUrl(team) {
  if (!team) {
    return '';
  }

  if (team.stadium_url) {
    return team.stadium_url;
  }

  const lat = toNumberOrNull(team.lat);
  const lng = toNumberOrNull(team.lng);

  if (lat === null || lng === null) {
    return '';
  }

  return `https://maps.google.com/?q=${lat},${lng}`;
}

function buildTeamDatabase(entries) {
  return (entries || [])
    .map((entry) => {
      const data = entry.data || {};
      const name = String(data.name || '').trim();
      const fileSlug = entry.fileSlug || (entry.page && entry.page.fileSlug) || '';
      const slug = String(data.slug || '').trim() || slugify(name || fileSlug);
      const teamCode = String(data.team_code || data.code || '').trim().toUpperCase() || slug.toUpperCase();
      const serieCode = normalizeSerieCode(data.serie);

      return {
        name,
        slug,
        team_code: teamCode,
        city: String(data.city || '').trim(),
        serie: String(data.serie || '').trim(),
        serie_code: serieCode,
        lat: toNumberOrNull(data.lat),
        lng: toNumberOrNull(data.lng),
        logo: String(data.logo || '').trim(),
        color_primary: String(data.color_primary || MATCH_COLOR_FALLBACK).trim() || MATCH_COLOR_FALLBACK,
        stadium_url: String(data.stadium_url || '').trim(),
        website: String(data.website || '').trim(),
        description: String(data.description || '').trim(),
        initial: (name.charAt(0) || '?').toUpperCase(),
        foundation_year: data.foundation_year,
        president: data.president,
        coach: data.coach,
        roster: data.roster || [],
        history_content: entry.content // Recupera il testo del file .md
      };
    })
    .filter((team) => team.name && team.serie_code === 'A')
    .map((team) => ({
      ...team,
      map_url: buildMapUrl(team),
      history_url: `/squadre/${team.slug}/storia/`
    }))
    .sort((left, right) => left.name.localeCompare(right.name, 'it'));
}

function buildTeamLookup(teams) {
  const lookup = {};

  (teams || []).forEach((team) => {
    const keys = new Set([
      normalizeKey(team.name),
      normalizeKey(team.slug),
      normalizeKey(team.team_code),
      slugify(team.name),
      slugify(team.slug),
      String(team.team_code || '').trim().toUpperCase()
    ]);

    keys.forEach((key) => {
      if (key) {
        lookup[key] = team;
      }
    });
  });

  return lookup;
}

function createFallbackTeam(reference) {
  const name = String(reference || '').trim();
  const slug = slugify(name);

  return {
    name,
    slug,
    team_code: String(reference || '').trim().toUpperCase() || slug.toUpperCase(),
    city: '',
    serie: 'Serie A',
    serie_code: 'A',
    lat: null,
    lng: null,
    logo: '',
    color_primary: MATCH_COLOR_FALLBACK,
    stadium_url: '',
    website: '',
    description: '',
    initial: (name.charAt(0) || '?').toUpperCase(),
    map_url: ''
  };
}

function resolveTeamReference(reference, lookup) {
  const raw = String(reference || '').trim();
  const key = normalizeKey(raw);
  const slugKey = slugify(raw);
  const codeKey = raw.toUpperCase();

  return lookup[codeKey] || lookup[key] || lookup[slugKey] || createFallbackTeam(raw);
}

module.exports = {
  MATCH_COLOR_FALLBACK,
  normalizeKey,
  slugify,
  normalizeSerieCode,
  buildMapUrl,
  buildTeamDatabase,
  buildTeamLookup,
  resolveTeamReference,
  toNumberOrNull
};
