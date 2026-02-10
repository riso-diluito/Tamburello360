module.exports = function(eleventyConfig) {
  eleventyConfig.addPassthroughCopy({"public": "."});
  eleventyConfig.addPassthroughCopy("admin/**/*");
  
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
