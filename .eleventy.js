module.exports = function(eleventyConfig) {
  // Copia i file statici
  eleventyConfig.addPassthroughCopy("public");
  eleventyConfig.addPassthroughCopy("admin");
  
  // Aggiungi filtri per le date
  eleventyConfig.addFilter("readableDate", dateObj => {
    return new Date(dateObj).toLocaleDateString('it-IT', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  });

  eleventyConfig.addFilter("shortDate", dateObj => {
    return new Date(dateObj).toLocaleDateString('it-IT', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  });

  // Filtro per limitare il numero di elementi in un array
  eleventyConfig.addFilter("limit", function(arr, count) {
    if (!Array.isArray(arr)) return arr;
    return arr.slice(0, count);
  });

  // Filtro per estrarre testo dalle stringhe HTML
  eleventyConfig.addFilter("striptags", function(str) {
    if (!str) return '';
    return str.replace(/<[^>]*>/g, '');
  });

  // Filtro per troncare testo
  eleventyConfig.addFilter("truncate", function(str, length) {
    if (!str) return '';
    if (str.length <= length) return str;
    return str.substring(0, length) + '...';
  });

  // Collezioni
  eleventyConfig.addCollection("blog", function(collectionApi) {
    return collectionApi.getFilteredByGlob("content/blog/*.md").reverse();
  });

  eleventyConfig.addCollection("classifiche", function(collectionApi) {
    return collectionApi.getFilteredByGlob("content/classifiche/*.md");
  });

  eleventyConfig.addCollection("risultati", function(collectionApi) {
    return collectionApi.getFilteredByGlob("content/risultati/*.md").reverse();
  });

  eleventyConfig.addCollection("squadre", function(collectionApi) {
    return collectionApi.getFilteredByGlob("content/squadre/*.md");
  });

  return {
    dir: {
      input: ".",
      output: "_site",
      includes: "_includes",
      data: "_data"
    },
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk",
    templateFormats: ["html", "njk", "md"]
  };
};
```

5. Clicca "Commit changes"

**B) Crea `.gitignore`:**
1. Di nuovo "Add file" → "Create new file"
2. Nome: `.gitignore`
3. Contenuto:
```
node_modules/
_site/
.DS_Store
