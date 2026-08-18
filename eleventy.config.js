/**
 * @typedef {import("@11ty/eleventy/src/UserConfig")} EleventyConfig

 *
 * @type {(eleventyConfig: EleventyConfig) => void}
 */

import { HtmlBasePlugin, InputPathToUrlTransformPlugin } from '@11ty/eleventy';
import { eleventyImageTransformPlugin } from '@11ty/eleventy-img';
import pluginNavigation from '@11ty/eleventy-navigation';
import pluginSyntaxHighlight from '@11ty/eleventy-plugin-syntaxhighlight';
import pluginWebc from '@11ty/eleventy-plugin-webc';
import browserslist from 'browserslist';
import { browserslistToTargets, bundleAsync, Features, transform } from 'lightningcss';
import markdownit from 'markdown-it';
import markdownitattrs from 'markdown-it-attrs';
import markdownitcontainer from 'markdown-it-container';
import fs from 'node:fs';
import path from 'path';
import pluginCollections from './_config/collections.js';
import pluginFilters from './_config/filters.js';

function configureMarkdownIt() {
  const md = markdownit({ html: true })
    .use(markdownitattrs)
    .use(markdownitcontainer, 'dynamic', {
      validate: function () {
        return true;
      },
      render: function (tokens, idx) {
        const token = tokens[idx];
        if (token.nesting === 1) {
          return '<div class="' + token.info.trim() + '">';
        } else {
          return '</div>';
        }
      },
    });
  md.renderer.rules.table_open = () => '<div class="custom-table-container"><table class="ui-table">';
  md.renderer.rules.table_close = () => '</table></div>';

  return md;
}

export const config = {
  dir: {
    input: 'src',
    data: '../_data', // default: "_data" (`input` relative)
    includes: './../_includes',
    layouts: './../_includes/layouts',
    output: '_site',
  },
  templateFormats: ['md', 'webc', 'liquid', 'html'],
  htmlTemplateEngine: 'liquid',
  markdownTemplateEngine: 'webc',
};

/**
 *
 * @param {EleventyConfig} eleventyConfig
 */
export default async function (eleventyConfig) {
  // Determine if the local development server is running
  const isLocalServer = process.env.ELEVENTY_RUN_MODE === 'serve' || process.env.ELEVENTY_RUN_MODE === 'watch';
  // Inject it directly into the data cascade under the "env" namespace
  eleventyConfig.addGlobalData('env', {
    isLocalServer: isLocalServer,
  });
  // Sets a global fallback layout for every single template file
  eleventyConfig.addGlobalData('layout', 'base.webc');
  //  Only copy global structural assets to the build output
  eleventyConfig.addPassthroughCopy('src/images/icons');
  eleventyConfig.addPassthroughCopy('src/images/logos');

  // Do NOT add a passthrough copy for "src/images/events/"

  // Watch CSS files
  eleventyConfig.addWatchTarget('./src/css/**/*.{css,scss}');

  let targets = browserslistToTargets(browserslist('> 0.2% and not dead'));

  eleventyConfig.addPlugin(pluginCollections);

  // Use the native HTML transform plugin
  eleventyConfig.addPlugin(eleventyImageTransformPlugin, {
    outputDir: '.cache/@11ty/images/',
    urlPath: '/img/',

    // 🚀 DROP LATEST JPEG: WebP and AVIF handle 100% of modern web layout demands!
    formats: ['avif'],
    widths: [400, 800, 'auto'],
    htmlOptions: {
      imgAttributes: {
        loading: 'lazy',
        decoding: 'async',
      },
    },
  });

  // Recognize CSS as a "template language"
  eleventyConfig.addTemplateFormats('css');

  // Process CSS with LightningCSS
  // Process CSS with LightningCSS
  eleventyConfig.addExtension('css', {
    outputFileExtension: 'css',
    useLayouts: false, // Cleanly stops Eleventy from wrapping CSS in HTML layout tags
    compile: async function (inputContent, inputPath) {
      let parsed = path.parse(inputPath);
      if (parsed.name.startsWith('_')) {
        return; // Ignore internal utility partials
      }

      // Modern regex that cleanly captures the file targets from @import statements
      // const importRuleRegex = /@import\s+(?:url\()?['"]?([^'"\);]+)['"]?\)?.*;/g;
      const importRuleRegex = /@import\s+(?:url\()?['"]?([^'"\);\s]+)['"]?\)?/g;

      const fileList = [];
      let match;

      while ((match = importRuleRegex.exec(inputContent))) {
        // Safely map the dependency path relative to the entry directory
        fileList.push(path.join(parsed.dir, match[1]));
      }

      if (fileList.length > 0) {
        this.addDependencies(inputPath, fileList); // Native 11ty watcher reload watch hook
      }

      return async () => {
        let { code } = await bundleAsync({
          filename: inputPath,
          minify: true, // Switched on for production-ready size optimizations
          sourceMap: false,
          targets,
          resolver: {
            read(filePath, from) {
              // 1. Clean browser functional syntax url() or quotes out of path names
              let cleanedPath = filePath.replace(/^url\(['"]?/, '').replace(/['"]?\)$/, '');

              const projectRoot = process.cwd();
              const localCssPrefix = path.resolve(projectRoot, 'src/css');

              // 2. Normalize package paths (e.g. removes './src/css/' prefix safely if it sneaks in)
              let normalizedSubPath = cleanedPath;
              if (cleanedPath.startsWith('./src/css/')) {
                normalizedSubPath = cleanedPath.replace('./src/css/', '');
              } else if (path.isAbsolute(cleanedPath) && cleanedPath.startsWith(localCssPrefix)) {
                normalizedSubPath = path.relative(localCssPrefix, cleanedPath);
              } else if (path.isAbsolute(cleanedPath) && cleanedPath.startsWith(projectRoot)) {
                normalizedSubPath = path.relative(projectRoot, cleanedPath);
              }

              // 3. Sequentially trace file targets across valid project structures
              const pathsToSearch = [
                path.resolve(localCssPrefix, normalizedSubPath), // Local workspace stylesheets
                path.resolve(projectRoot, 'node_modules', normalizedSubPath), // OpenProps & packages
                path.isAbsolute(cleanedPath) ? cleanedPath : null,
                from ? path.resolve(path.dirname(from), cleanedPath) : null,
              ].filter(Boolean);

              for (const absolutePath of pathsToSearch) {
                if (fs.existsSync(absolutePath) && fs.statSync(absolutePath).isFile()) {
                  return fs.readFileSync(absolutePath, 'utf8');
                }
              }

              throw new Error(`Global CSS bundle could not trace: ${normalizedSubPath}`);
            },
          },
          drafts: {
            nesting: true,
            customMedia: true,
          },
        });
        return code;
      };
    },
  });

  eleventyConfig.addPlugin(pluginWebc, {
    components: ['./_includes/components/**/*.webc', 'npm:@11ty/eleventy-img/*.webc'],

    bundlePluginOptions: {
      toFileDirectory: false,
      hoistDuplicateBundles: true,
      transforms: [
        async function (content) {
          // console.log(this.buckets[0]);

          if (this.type === 'css' && this.bucket === undefined) {
            if (!content || !content.trim()) return '';

            try {
              // Read ONLY the Open Props media tokens so component media queries function
              const mediaPath = path.resolve('./node_modules/open-props/media.min.css');
              const mediaQueries = fs.existsSync(mediaPath) ? fs.readFileSync(mediaPath, 'utf8') : '';

              let { code } = transform({
                filename: 'components.css',
                code: Buffer.from(`${mediaQueries}\n${content}`),
                minify: process.env.NODE_ENV === 'production',
                targets,
                exclude: Features.LogicalProperties | Features.LightDark | Features.LabColors,
                drafts: { customMedia: true },
              });
              return code.toString();
            } catch (e) {
              console.error(`❌ WebC Component CSS Error: ${e.message}`);
              return content;
            }
          }
          return content;
        },
      ],
    },
  });

  eleventyConfig.setLibrary('md', configureMarkdownIt());

  eleventyConfig.addPlugin(pluginSyntaxHighlight, {
    preAttributes: { tabindex: 0 },
  });
  eleventyConfig.addPlugin(pluginNavigation);
  eleventyConfig.addPlugin(HtmlBasePlugin);
  eleventyConfig.addPlugin(InputPathToUrlTransformPlugin);

  // Filters
  eleventyConfig.addPlugin(pluginFilters);

  eleventyConfig.on('eleventy.before', async () => {
    const cacheExists = fs.existsSync('.cache/@11ty/images/');
    const files = cacheExists ? fs.readdirSync('.cache/@11ty/images/').length : 0;
    console.log(`[cache check] image cache present: ${cacheExists}, files: ${files}`);
  });

  // 3. Move files from Cloudflare's cache to the final build output directory
  eleventyConfig.on('eleventy.after', async ({ dir }) => {
    const sourceDir = '.cache/@11ty/images/';
    const destDir = `${dir.output}/img/`;

    if (fs.existsSync(sourceDir)) {
      fs.mkdirSync(destDir, { recursive: true });
      fs.cpSync(sourceDir, destDir, { recursive: true });
    }
  });
  eleventyConfig.addPassthroughCopy({ './public': '/' });
}
