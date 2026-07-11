// audit-css.js
import fs from "node:fs";
import { globSync } from "glob";
import { PurgeCSS } from "purgecss";

async function runAudit() {
  console.log("Parsing your compiled files...");

  // 1. Gather all your hashed CSS files and compiled HTML views
  const cssFiles = globSync("_site/*.css");
  const htmlFiles = globSync("_site/**/*.html");

  // 2. Run the PurgeCSS analysis engine
  const purgecssResult = await new PurgeCSS().purge({
    css: cssFiles,
    content: htmlFiles,
    rejected: true, // Captures dead selectors natively
  });

  // 3. Construct a beautiful, clean Markdown document
  let markdownReport = "# 🎯 Unused CSS Selector Audit\n\n";
  markdownReport += `Generated on: ${new Date().toLocaleString()}\n\n`;

  for (const file of purgecssResult) {
    const fileName = file.file ? file.file.split("/").pop() : "Unknown File";
    markdownReport += `## 📄 File: ${fileName}\n`;
    
    if (file.rejected && file.rejected.length > 0) {
      markdownReport += "```css\n";
      file.rejected.forEach(selector => {
        markdownReport += `${selector}\n`;
      });
      markdownReport += "```\n\n";
    } else {
      markdownReport += "✅ Clear! No dead selectors found in this layout asset.\n\n";
    }
  }

  // 4. Output to disk
  fs.writeFileSync("purge-report.md", markdownReport);
  console.log("✨ Audit complete! Open purge-report.md in LazyVim.");
}

runAudit();
