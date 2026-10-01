import fs from 'node:fs';
import path from 'node:path';

function mapPdfFile(basePath, relativeDir, pdfFile, subFolder) {
  const baseName = path.basename(pdfFile, '.pdf');
  const jsonPath = path.join(basePath, `${baseName}.json`);

  let title = baseName.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  let description = '';

  if (fs.existsSync(jsonPath)) {
    try {
      const meta = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
      if (meta.title) title = meta.title;
      if (meta.description) description = meta.description;
    } catch (e) {
      console.error(`Error parsing JSON for ${pdfFile}:`, e);
    }
  }

  // Ensures URLs cleanly look like /pdfs/hall/category/file.pdf
  const urlPath = relativeDir ? `${subFolder}/${relativeDir}/${pdfFile}` : `${subFolder}/${pdfFile}`;
  return { title, description, url: `/pdfs/${urlPath}` };
}

/**
 * Scan a specific community group file branch
 * @param {string} subFolder - 'hall', 'wcdt', etc.
 */
export function getFileResources(subFolder) {
  const pdfsDir = path.join(process.cwd(), 'src/file-resources', subFolder);
  if (!fs.existsSync(pdfsDir)) return { uncategorized: [], categories: [] };

  const rootItems = fs.readdirSync(pdfsDir);

  const uncategorized = rootItems
    .filter(file => path.extname(file).toLowerCase() === '.pdf')
    .map(pdfFile => mapPdfFile(pdfsDir, '', pdfFile, subFolder));

  const categories = rootItems
    .filter(file => fs.statSync(path.join(pdfsDir, file)).isDirectory())
    .map(categoryFolder => {
      const categoryPath = path.join(pdfsDir, categoryFolder);

      let categoryName = categoryFolder.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      let categoryDescription = '';

      const folderJsonPath = path.join(categoryPath, `${categoryFolder}.json`);
      if (fs.existsSync(folderJsonPath)) {
        try {
          const folderMeta = JSON.parse(fs.readFileSync(folderJsonPath, 'utf8'));
          if (folderMeta.categoryName) categoryName = folderMeta.categoryName;
          if (folderMeta.description) categoryDescription = folderMeta.description;
        } catch (e) {
          console.error(`Error parsing folder JSON for ${categoryFolder}:`, e);
        }
      }

      const files = fs
        .readdirSync(categoryPath)
        .filter(file => path.extname(file).toLowerCase() === '.pdf')
        .map(pdfFile => mapPdfFile(categoryPath, categoryFolder, pdfFile, subFolder));

      return { categoryName, description: categoryDescription, files };
    })
    .filter(cat => cat.files.length > 0);

  return { uncategorized, categories };
}
