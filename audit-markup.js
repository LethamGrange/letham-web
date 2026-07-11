// audit-markup.js
import { globSync } from 'glob';
import fs from 'node:fs';
import { PurgeCSS } from 'purgecss';

async function findMissingCSSReferences() {
  console.log('Analyzing your HTML markup for missing CSS classes...');

  const cssFiles = globSync('_site/*.css');
  const htmlFiles = globSync('_site/**/*.html');

  // 1. Leverage PurgeCSS backwards!
  // We extract all classes that ARE actively used in the stylesheet
  const result = await new PurgeCSS().purge({
    css: cssFiles,
    content: htmlFiles,
    rejected: true,
  });

  // Gather a unique set of all CSS selectors that actually exist in your styles
  const validSelectors = new Set();
  cssFiles.forEach(file => {
    // Read the compiled CSS text
    const content = fs.readFileSync(file, 'utf-8');
    // Simple regex match to extract standard class tokens (.classname)
    const classes = content.match(/\.[a-zA-Z0-9_-]+/g) || [];
    classes.forEach(c => validSelectors.add(c.replace('.', '')));
  });

  let markdownReport = '# 🔍 Orphan HTML Class Reference Audit\n\n';
  markdownReport +=
    'The following classes exist in your WebC/Markdown markup but have **no styling definitions** in your CSS pipeline:\n\n';

  let totalOrphans = 0;

  // 2. Scan every HTML view for class names that don't match our stylesheet set
  htmlFiles.forEach(htmlPath => {
    const htmlContent = fs.readFileSync(htmlPath, 'utf-8');
    // Extract every string literal inside class="..." attributes
    const classAttributes = htmlContent.match(/class=["']([^"']+)["']/g) || [];

    const fileOrphans = new Set();

    classAttributes.forEach(attr => {
      const cleanClasses = attr.replace(/class=["']|["']/g, '').split(/\s+/);
      cleanClasses.forEach(className => {
        // Skip empty hits, numeric utilities, or active third-party frameworks
        if (!className || className.startsWith('algolia') || className.startsWith('prism')) return;

        // IF THE CLASS IS NOT IN OUR STYLESHEET DICTIONARY, IT IS AN ORPHAN!
        if (!validSelectors.has(className)) {
          fileOrphans.add(className);
        }
      });
    });

    if (fileOrphans.size > 0) {
      // Grabs the last two parts of the path so you get 'about/index.html'
      const pathSegments = htmlPath.split('/');
      const fileName = pathSegments.slice(-2).join('/');
      markdownReport += `### 📄 File: ${fileName}\n`;
      markdownReport += '```text\n';
      fileOrphans.forEach(orphan => {
        markdownReport += `${orphan}\n`;
        totalOrphans++;
      });
      markdownReport += '```\n\n';
    }
  });

  if (totalOrphans === 0) {
    markdownReport +=
      '✅ Clear! Every single class attribute on your website maps perfectly to an active styling rule.\n';
  }

  fs.writeFileSync('orphan-report.md', markdownReport);
  console.log(`✨ Markup audit complete! Found ${totalOrphans} orphan classes. Open orphan-report.md in LazyVim.`);
}

findMissingCSSReferences();
