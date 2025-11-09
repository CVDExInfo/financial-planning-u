#!/usr/bin/env ts-node

/**
 * Documentation Rendering Script for Finanzas SD
 * 
 * This script converts documentation sources (Markdown, Mermaid diagrams, Draw.io diagrams)
 * into professional PDF and DOCX formats with bilingual (Spanish/English) content and
 * corporate branding (CVDex or Ikusi).
 * 
 * Features:
 * - Converts Markdown to PDF and DOCX using Pandoc
 * - Renders Mermaid diagrams (.mmd) to SVG
 * - Supports bilingual content preservation
 * - Applies corporate branding (logos, templates, styles)
 * - Generates index.html for easy navigation
 * 
 * Usage:
 *   npm run render-docs
 *   USE_CVDEX_BRANDING=true npm run render-docs
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

// Configuration
const CONFIG = {
  // Directories
  DOCS_DIR: path.join(__dirname, '../../docs'),
  DIAGRAMS_DIR: path.join(__dirname, '../../diagrams'),
  ASSETS_DIR: path.join(__dirname, '../../assets'),
  OUTPUT_DIR: path.join(__dirname, '../../public/docs/latest'),
  TEMP_DIR: path.join(__dirname, '../../public/docs/temp'),
  
  // Branding
  USE_CVDEX_BRANDING: process.env.USE_CVDEX_BRANDING === 'true',
  
  // File extensions
  MARKDOWN_EXT: '.md',
  MERMAID_EXT: '.mmd',
  DRAWIO_EXT: '.drawio',
  SVG_EXT: '.svg',
};

// Color codes for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

/**
 * Logger utility
 */
const logger = {
  info: (message: string) => console.log(`${colors.blue}ℹ${colors.reset} ${message}`),
  success: (message: string) => console.log(`${colors.green}✓${colors.reset} ${message}`),
  error: (message: string) => console.error(`${colors.red}✗${colors.reset} ${message}`),
  warn: (message: string) => console.warn(`${colors.yellow}⚠${colors.reset} ${message}`),
  section: (message: string) => console.log(`\n${colors.bright}${colors.cyan}${message}${colors.reset}\n`),
};

/**
 * Ensure required directories exist
 */
function ensureDirectories(): void {
  logger.section('Setting up directories...');
  
  const dirs = [
    CONFIG.OUTPUT_DIR,
    CONFIG.TEMP_DIR,
    path.join(CONFIG.TEMP_DIR, 'diagrams'),
  ];
  
  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      logger.success(`Created directory: ${path.relative(process.cwd(), dir)}`);
    }
  });
}

/**
 * Get the appropriate logo path based on branding configuration
 */
function getLogoPath(): string {
  const logoName = CONFIG.USE_CVDEX_BRANDING ? 'cvdex-logo.svg' : 'ikusi-logo.svg';
  return path.join(CONFIG.ASSETS_DIR, 'logo', logoName);
}

/**
 * Find all files with a specific extension in a directory recursively
 */
function findFiles(dir: string, ext: string): string[] {
  const files: string[] = [];
  
  if (!fs.existsSync(dir)) {
    logger.warn(`Directory not found: ${dir}`);
    return files;
  }
  
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    
    if (entry.isDirectory()) {
      files.push(...findFiles(fullPath, ext));
    } else if (entry.isFile() && entry.name.endsWith(ext)) {
      files.push(fullPath);
    }
  }
  
  return files;
}

/**
 * Convert Mermaid diagram to SVG
 */
function convertMermaidToSVG(mmdPath: string): string {
  const basename = path.basename(mmdPath, CONFIG.MERMAID_EXT);
  const outputPath = path.join(CONFIG.TEMP_DIR, 'diagrams', `${basename}.svg`);
  
  try {
    logger.info(`Converting Mermaid diagram: ${path.basename(mmdPath)}`);
    
    // Create puppeteer config for CI environments
    const puppeteerConfig = path.join(CONFIG.TEMP_DIR, 'puppeteer-config.json');
    fs.writeFileSync(puppeteerConfig, JSON.stringify({
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    }));
    
    // Use mermaid CLI to convert .mmd to .svg
    execSync(`npx -y mmdc -i "${mmdPath}" -o "${outputPath}" -b transparent --puppeteerConfigFile "${puppeteerConfig}"`, {
      stdio: 'pipe',
    });
    
    logger.success(`Generated SVG: ${basename}.svg`);
    return outputPath;
  } catch (error) {
    logger.error(`Failed to convert Mermaid diagram: ${mmdPath}`);
    throw error;
  }
}

/**
 * Process all diagram files
 */
function processDiagrams(): Map<string, string> {
  logger.section('Processing diagrams...');
  
  const diagramMap = new Map<string, string>();
  
  // Process Mermaid diagrams
  const mermaidFiles = findFiles(CONFIG.DIAGRAMS_DIR, CONFIG.MERMAID_EXT);
  logger.info(`Found ${mermaidFiles.length} Mermaid diagram(s)`);
  
  for (const mmdFile of mermaidFiles) {
    try {
      const svgPath = convertMermaidToSVG(mmdFile);
      const basename = path.basename(mmdFile, CONFIG.MERMAID_EXT);
      diagramMap.set(basename, svgPath);
    } catch (error) {
      logger.error(`Failed to process: ${path.basename(mmdFile)}`);
    }
  }
  
  // Note: Draw.io conversion would be added here if draw.io CLI is available
  // For now, we'll document that Draw.io files should be manually exported to SVG
  const drawioFiles = findFiles(CONFIG.DIAGRAMS_DIR, CONFIG.DRAWIO_EXT);
  if (drawioFiles.length > 0) {
    logger.warn(`Found ${drawioFiles.length} Draw.io file(s). Please export them to SVG manually.`);
  }
  
  return diagramMap;
}

/**
 * Check if Pandoc is installed
 */
function checkPandocInstalled(): boolean {
  try {
    execSync('pandoc --version', { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Convert Markdown to PDF using Pandoc
 */
function convertMarkdownToPDF(mdPath: string, metadata: DocumentMetadata): void {
  const relativePath = path.relative(CONFIG.DOCS_DIR, mdPath);
  const basename = path.basename(mdPath, CONFIG.MARKDOWN_EXT);
  const outputPath = path.join(CONFIG.OUTPUT_DIR, `${basename}.pdf`);
  
  try {
    logger.info(`Converting to PDF: ${relativePath}`);
    
    const logoPath = getLogoPath();
    const templatePath = path.join(CONFIG.ASSETS_DIR, 'branding', 'template.tex');
    
    // Pandoc command with LaTeX template and metadata
    const pandocArgs = [
      `"${mdPath}"`,
      `-o "${outputPath}"`,
      '--pdf-engine=xelatex',
      '--from=markdown',
      '--standalone',
      `--metadata title="${metadata.title}"`,
      `--metadata author="${metadata.author}"`,
      `--metadata date="${metadata.date}"`,
      `--metadata subtitle="${metadata.subtitle}"`,
      `--variable logo="${logoPath}"`,
    ];
    
    // Add template if it exists
    if (fs.existsSync(templatePath)) {
      pandocArgs.push(`--template="${templatePath}"`);
    }
    
    const command = `pandoc ${pandocArgs.join(' ')}`;
    execSync(command, { stdio: 'pipe' });
    
    logger.success(`Generated PDF: ${basename}.pdf`);
  } catch (error) {
    logger.error(`Failed to convert to PDF: ${relativePath}`);
    throw error;
  }
}

/**
 * Convert Markdown to DOCX using Pandoc
 */
function convertMarkdownToDOCX(mdPath: string, metadata: DocumentMetadata): void {
  const relativePath = path.relative(CONFIG.DOCS_DIR, mdPath);
  const basename = path.basename(mdPath, CONFIG.MARKDOWN_EXT);
  const outputPath = path.join(CONFIG.OUTPUT_DIR, `${basename}.docx`);
  
  try {
    logger.info(`Converting to DOCX: ${relativePath}`);
    
    const referencePath = path.join(CONFIG.ASSETS_DIR, 'branding', 'reference.docx');
    
    // Pandoc command for DOCX
    const pandocArgs = [
      `"${mdPath}"`,
      `-o "${outputPath}"`,
      '--from=markdown',
      '--standalone',
      `--metadata title="${metadata.title}"`,
      `--metadata author="${metadata.author}"`,
      `--metadata date="${metadata.date}"`,
    ];
    
    // Add reference doc if it exists
    if (fs.existsSync(referencePath)) {
      pandocArgs.push(`--reference-doc="${referencePath}"`);
    }
    
    const command = `pandoc ${pandocArgs.join(' ')}`;
    execSync(command, { stdio: 'pipe' });
    
    logger.success(`Generated DOCX: ${basename}.docx`);
  } catch (error) {
    logger.error(`Failed to convert to DOCX: ${relativePath}`);
    throw error;
  }
}

/**
 * Document metadata interface
 */
interface DocumentMetadata {
  title: string;
  subtitle: string;
  author: string;
  date: string;
}

/**
 * Extract metadata from markdown file
 */
function extractMetadata(mdPath: string): DocumentMetadata {
  const content = fs.readFileSync(mdPath, 'utf-8');
  const basename = path.basename(mdPath, CONFIG.MARKDOWN_EXT);
  
  // Try to extract title from first heading
  const titleMatch = content.match(/^#\s+(.+)$/m);
  const title = titleMatch ? titleMatch[1] : basename;
  
  // Default metadata
  return {
    title,
    subtitle: 'Finanzas SD Documentation / Documentación de Finanzas SD',
    author: CONFIG.USE_CVDEX_BRANDING ? 'CVDex' : 'Ikusi',
    date: new Date().toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    }),
  };
}

/**
 * Process all markdown files
 */
function processMarkdownFiles(): Array<{ name: string; pdf: string; docx: string }> {
  logger.section('Processing markdown files...');
  
  const markdownFiles = findFiles(CONFIG.DOCS_DIR, CONFIG.MARKDOWN_EXT);
  logger.info(`Found ${markdownFiles.length} markdown file(s)`);
  
  const processedDocs: Array<{ name: string; pdf: string; docx: string }> = [];
  
  for (const mdFile of markdownFiles) {
    try {
      const metadata = extractMetadata(mdFile);
      const basename = path.basename(mdFile, CONFIG.MARKDOWN_EXT);
      
      // Convert to PDF
      convertMarkdownToPDF(mdFile, metadata);
      
      // Convert to DOCX
      convertMarkdownToDOCX(mdFile, metadata);
      
      processedDocs.push({
        name: metadata.title,
        pdf: `${basename}.pdf`,
        docx: `${basename}.docx`,
      });
    } catch (err) {
      logger.error(`Failed to process: ${path.basename(mdFile)}`);
      logger.error(String(err));
    }
  }
  
  return processedDocs;
}

/**
 * Generate index.html for documentation
 */
function generateIndex(docs: Array<{ name: string; pdf: string; docx: string }>): void {
  logger.section('Generating index.html...');
  
  const brandName = CONFIG.USE_CVDEX_BRANDING ? 'CVDex' : 'Ikusi';
  const cssPath = path.join(CONFIG.ASSETS_DIR, 'branding', 'styles.css');
  const css = fs.existsSync(cssPath) ? fs.readFileSync(cssPath, 'utf-8') : '';
  
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Finanzas SD Documentation - ${brandName}</title>
  <style>${css}</style>
</head>
<body>
  <header>
    <h1>Finanzas SD Documentation</h1>
    <p>Documentación de Finanzas SD</p>
  </header>
  
  <main>
    <section>
      <h2>EN: Available Documents</h2>
      <p>Select a document to download in your preferred format (PDF or DOCX).</p>
    </section>
    
    <section>
      <h2>ES: Documentos Disponibles</h2>
      <p>Seleccione un documento para descargar en su formato preferido (PDF o DOCX).</p>
    </section>
    
    <ul class="doc-index">
      ${docs.map(doc => `
      <li>
        <a href="${doc.pdf}">${doc.name}</a>
        <div class="doc-links">
          <a href="${doc.pdf}">📄 PDF</a>
          <a href="${doc.docx}">📝 DOCX</a>
        </div>
      </li>
      `).join('\n')}
    </ul>
  </main>
  
  <footer>
    <p>Generated by ${brandName} Documentation Pipeline</p>
    <p>Last updated: ${new Date().toLocaleString()}</p>
    <p>Confidential - Internal Use Only / Confidencial - Solo Uso Interno</p>
  </footer>
</body>
</html>`;
  
  const indexPath = path.join(CONFIG.OUTPUT_DIR, 'index.html');
  fs.writeFileSync(indexPath, html, 'utf-8');
  
  logger.success('Generated index.html');
}

/**
 * Main execution function
 */
async function main(): Promise<void> {
  console.log(`
${colors.bright}${colors.cyan}╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║          Finanzas SD Documentation Pipeline                   ║
║          Bilingual PDF & DOCX Generator                       ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝${colors.reset}
`);
  
  logger.info(`Branding: ${CONFIG.USE_CVDEX_BRANDING ? 'CVDex' : 'Ikusi (default)'}`);
  logger.info(`Output directory: ${path.relative(process.cwd(), CONFIG.OUTPUT_DIR)}`);
  
  try {
    // Check prerequisites
    logger.section('Checking prerequisites...');
    
    if (!checkPandocInstalled()) {
      logger.error('Pandoc is not installed. Please install Pandoc to continue.');
      logger.info('Install Pandoc: https://pandoc.org/installing.html');
      process.exit(1);
    }
    logger.success('Pandoc is installed');
    
    // Ensure directories exist
    ensureDirectories();
    
    // Process diagrams
    const diagramMap = processDiagrams();
    logger.info(`Processed ${diagramMap.size} diagram(s)`);
    
    // Process markdown files
    const processedDocs = processMarkdownFiles();
    
    if (processedDocs.length === 0) {
      logger.warn('No documents were processed. Check if markdown files exist in docs/');
      process.exit(0);
    }
    
    // Generate index
    generateIndex(processedDocs);
    
    // Summary
    logger.section('Summary');
    logger.success(`Total documents processed: ${processedDocs.length}`);
    logger.success(`Output location: ${CONFIG.OUTPUT_DIR}`);
    logger.info(`View the documentation index at: ${path.join(CONFIG.OUTPUT_DIR, 'index.html')}`);
    
    console.log(`
${colors.green}${colors.bright}✓ Documentation pipeline completed successfully!${colors.reset}
`);
    
  } catch (err) {
    logger.error('Documentation pipeline failed');
    console.error(err);
    process.exit(1);
  }
}

// Run the script
main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
