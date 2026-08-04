export default function (eleventyConfig) {
  eleventyConfig.addCollection('autoContext', function (collectionApi) {
    let allPages = collectionApi.getAll();
    let contextMap = {};

    allPages.forEach(item => {
      // Split the URL to find the parent folder slug
      let urlParts = item.url ? item.url.split('/').filter(Boolean) : [];

      if (urlParts.length >= 1) {
        let folderKey = urlParts[0]; // e.g., "Westmuir Hall" or "resilience-hub"
        let isIndexPage = item.url.endsWith('/') && urlParts.length === 1;

        // Only map the page if you explicitly flag it in front matter
        if (!isIndexPage && item.data.inContextNav === true) {
          if (!contextMap[folderKey]) {
            contextMap[folderKey] = [];
          }

          contextMap[folderKey].push({
            label: item.data.title || item.fileSlug,
            url: item.url,
            exact: true,
            order: item.data.order || 0,
          });
        }
      }
    });

    // Sort every mapped folder alphabetically or by numerical order key
    for (let folder in contextMap) {
      contextMap[folder].sort((a, b) => a.order - b.order || a.label.localeCompare(b.label));
    }
    return contextMap;
  });
}
