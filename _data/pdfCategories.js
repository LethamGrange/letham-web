import fs from 'node:fs';
import path from 'node:path';

function mapPdfFile(basePath, relativeDir, pdfFile) {
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

  const urlPath = relativeDir ? `${relativeDir}/${pdfFile}` : pdfFile;
  return { title, description, url: `/pdfs/${urlPath}` };
}

export default function () {
  const pdfsDir = path.join(process.cwd(), 'src/file-resources');
  if (!fs.existsSync(pdfsDir)) return { uncategorized: [], categories: [] };

  const rootItems = fs.readdirSync(pdfsDir);

  const uncategorized = rootItems
    .filter(file => path.extname(file).toLowerCase() === '.pdf')
    .map(pdfFile => mapPdfFile(pdfsDir, '', pdfFile));

  const categories = rootItems
    .filter(file => fs.statSync(path.join(pdfsDir, file)).isDirectory())
    .map(categoryFolder => {
      const categoryPath = path.join(pdfsDir, categoryFolder);

      // Fallback details generated from folder name
      let categoryName = categoryFolder.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      let categoryDescription = '';

      // Look for a folder-meta json file matching the folder name (e.g. user-manuals/user-manuals.json)
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
        .map(pdfFile => mapPdfFile(categoryPath, categoryFolder, pdfFile));

      return {
        categoryName,
        description: categoryDescription,
        files,
      };
    })
    .filter(cat => cat.files.length > 0);

  return { uncategorized, categories };
}
