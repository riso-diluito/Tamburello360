const { buildTeamDatabase, buildTeamLookup } = require('./lib/team-database');
const { buildEnrichedMatches } = require('./lib/partite');

module.exports = function(eleventyConfig) {
  let cachedTeamLookup = null;

  function getTeamLookup(collectionApi) {
    // Eleventy collections non possono dipendere in modo affidabile tra loro:
    // usiamo quindi un helper memoizzato per evitare il doppio calcolo.
    if (cachedTeamLookup) {
      return cachedTeamLookup;
    }

    const entries = collectionApi.getFilteredByGlob("content/squadre/*.md");
    const db = buildTeamDatabase(entries);
    cachedTeamLookup = buildTeamLookup(db);
    return cachedTeamLookup;
  }

  // Mappa il contenuto di public alla radice del sito finale.
  // Questo rende i percorsi più semplici: /css/style.css invece di /public/css/style.css
  eleventyConfig.addPassthroughCopy({ "public": "/" });

  // ============================================================
  // FILTRI
  // ============================================================
  eleventyConfig.addFilter("readableDate", dateObj => {
    return new Date(dateObj).toLocaleDateString('it-IT', {
      year: 'numeric', month: 'long', day: 'numeric'
    });
  });

  eleventyConfig.addFilter("shortDate", dateObj => {
    return new Date(dateObj).toLocaleDateString('it-IT', {
      year: 'numeric', month: 'short', day: 'numeric'
    });
  });

  eleventyConfig.addFilter("limit", function(arr, count) {
    if (!Array.isArray(arr)) return arr;
    return arr.slice(0, count);
  });

  eleventyConfig.addFilter("striptags", function(str) {
    if (!str) return '';
    return str.replace(/<[^>]*>/g, '');
  });

  eleventyConfig.addFilter("truncate", function(str, length) {
    if (!str) return '';
    if (str.length <= length) return str;
    return str.substring(0, length) + '...';
  });

  eleventyConfig.addFilter("findTeam", (teamName, teamDatabase) => {
    if (!teamDatabase) return null;
    return teamDatabase.find(t => t.name === teamName);
  });

  eleventyConfig.addFilter("toPartiteClientData", function(matches) {
    return (matches || []).map(m => ({
      id: m.id,
      giornata: m.giornata,
      is_played: m.is_played,
      is_recommended: m.is_recommended,
      score_label: m.score_label,
      date_day_label: m.date_day_label,
      date_time_label: m.date_time_label,
      map_url: m.map_url,
      info_url: m.info_url,
      gradient: m.gradient,
      stato: m.stato,
      home_team: {
        name: m.home_team.name,
        logo: m.home_team.logo,
        initial: m.home_team.initial
      },
      away_team: {
        name: m.away_team.name,
        logo: m.away_team.logo,
        initial: m.away_team.initial
      }
    }));
  });

  eleventyConfig.addFilter("isCurrentGiornata", function(matches) {
    if (!matches || matches.length === 0) return false;
    // Basta controllare la prima partita del gruppo, dato che sono raggruppate per giornata
    return matches.some(m => m.is_recommended);
  });

  // ============================================================
  // COLLECTION BLOG
  // ============================================================
  eleventyConfig.addCollection("blog", function(collectionApi) {
    return collectionApi.getFilteredByGlob("content/blog/*.md").reverse();
  });

  eleventyConfig.addCollection("blogVisible", function(collectionApi) {
    return collectionApi.getFilteredByGlob("content/blog/*.md")
      .filter(post => !post.data.draft)
      .reverse();
  });

  // ============================================================
  // COLLECTION SQUADRE E TEAM DATABASE
  // ============================================================
  eleventyConfig.addCollection("squadre", function(collectionApi) {
    return collectionApi.getFilteredByGlob("content/squadre/*.md");
  });

  eleventyConfig.addCollection("teamDatabase", function(collectionApi) {
    const entries = collectionApi.getFilteredByGlob("content/squadre/*.md");
    return buildTeamDatabase(entries);
  });

  eleventyConfig.addCollection("teamLookup", function(collectionApi) {
    return getTeamLookup(collectionApi);
  });

  // ============================================================
  // COLLECTION CLASSIFICHE
  // ============================================================
  eleventyConfig.addCollection("classifiche", function(collectionApi) {
    return collectionApi.getFilteredByGlob("content/classifiche/*.md");
  });

  eleventyConfig.addCollection("classificheSerieA", function(collectionApi) {
    return collectionApi
      .getFilteredByGlob("content/classifiche/*.md")
      .filter(c => {
        const serie = String(c.data.serie || '').toLowerCase();
        return serie.includes('serie a');
      })
      .sort((a, b) => (b.data.year || 0) - (a.data.year || 0));
  });

  // ============================================================
  // COLLECTION PARTITE
  // ============================================================
  eleventyConfig.addCollection("risultati", function(collectionApi) {
    return collectionApi.getFilteredByGlob("content/risultati/*.md").reverse();
  });

  eleventyConfig.addCollection("archivio", function(collectionApi) {
    return collectionApi.getFilteredByGlob("content/archivio/*.md").reverse();
  });

  eleventyConfig.addCollection("partiteEnriched", function(collectionApi) {
    const partiteEntries = collectionApi.getFilteredByGlob("content/risultati/*.md");
    const teamLookup = getTeamLookup(collectionApi);
    return buildEnrichedMatches(partiteEntries, teamLookup);
  });

  eleventyConfig.addCollection("partiteRecenti", function(collectionApi) {
    const partiteEntries = collectionApi.getFilteredByGlob("content/risultati/*.md");
    const teamLookup = getTeamLookup(collectionApi);
    const enriched = buildEnrichedMatches(partiteEntries, teamLookup);

    return enriched
      .filter(m => m.is_played)
      .sort((a, b) => b.sort_timestamp - a.sort_timestamp)
      .slice(0, 10);
  });

  // ============================================================
  // CONFIG
  // ============================================================
  return {
    dir: {
      input: ".", output: "_site",
      includes: "_includes", data: "_data"
    },
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk",
    templateFormats: ["html", "njk", "md"]
  };
};
