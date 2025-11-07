#!/usr/bin/env node

/**
 * Script to generate PDF files from all markdown files in the docs directory.
 * Uses md-to-pdf library to convert markdown to PDF format.
 */

const { mdToPdf } = require('md-to-pdf');
const fs = require('fs');
const path = require('path');

const DOCS_DIR = path.join(__dirname, '..', 'docs');
const OUTPUT_DIR = path.join(__dirname, '..', 'docs-pdf');
const CSS_FILE = path.join(__dirname, '..', 'docs-pdf', '.github-markdown.css');

// GitHub markdown CSS content (inline to avoid external CDN dependencies)
const GITHUB_MARKDOWN_CSS = `
body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans', Helvetica, Arial, sans-serif;
  font-size: 16px;
  line-height: 1.5;
  word-wrap: break-word;
  padding: 15px;
}
.markdown-body h1 { font-size: 2em; border-bottom: 1px solid #eaecef; padding-bottom: 0.3em; }
.markdown-body h2 { font-size: 1.5em; border-bottom: 1px solid #eaecef; padding-bottom: 0.3em; }
.markdown-body h3 { font-size: 1.25em; }
.markdown-body code { background-color: rgba(175,184,193,0.2); padding: 0.2em 0.4em; border-radius: 6px; font-family: monospace; }
.markdown-body pre { background-color: #f6f8fa; padding: 16px; overflow: auto; border-radius: 6px; }
.markdown-body pre code { background-color: transparent; padding: 0; }
.markdown-body blockquote { border-left: 0.25em solid #dfe2e5; padding: 0 1em; color: #6a737d; }
.markdown-body table { border-collapse: collapse; width: 100%; }
.markdown-body table th, .markdown-body table td { border: 1px solid #dfe2e5; padding: 6px 13px; }
.markdown-body table tr:nth-child(2n) { background-color: #f6f8fa; }
.markdown-body ul, .markdown-body ol { padding-left: 2em; }
`;

/**
 * Recursively find all markdown files in a directory
 * @param {string} dir - Directory to search
 * @param {string[]} fileList - Accumulated list of files
 * @returns {string[]} Array of markdown file paths
 */
function findMarkdownFiles(dir, fileList = []) {
  try {
    if (!fs.existsSync(dir)) {
      throw new Error(`Directory does not exist: ${dir}`);
    }
    
    const files = fs.readdirSync(dir);

    files.forEach((file) => {
      try {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);

        if (stat.isDirectory()) {
          findMarkdownFiles(filePath, fileList);
        } else if (file.endsWith('.md')) {
          fileList.push(filePath);
        }
      } catch (err) {
        console.warn(`Warning: Could not process ${file}: ${err.message}`);
      }
    });

    return fileList;
  } catch (error) {
    console.error(`Error reading directory ${dir}:`, error.message);
    throw error;
  }
}

/**
 * Convert a markdown file to PDF
 * @param {string} markdownPath - Path to the markdown file
 * @returns {Promise<void>}
 */
async function convertMarkdownToPdf(markdownPath) {
  try {
    // Calculate relative path from docs directory
    const relativePath = path.relative(DOCS_DIR, markdownPath);
    const pdfPath = path.join(OUTPUT_DIR, relativePath.replace('.md', '.pdf'));
    
    // Ensure output directory exists
    const pdfDir = path.dirname(pdfPath);
    if (!fs.existsSync(pdfDir)) {
      fs.mkdirSync(pdfDir, { recursive: true });
    }

    console.log(`Converting: ${relativePath}`);
    
    // Determine if we're in a CI environment
    const isCI = process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true';
    const launchArgs = isCI ? ['--no-sandbox', '--disable-setuid-sandbox'] : [];
    
    // Convert markdown to PDF
    const pdf = await mdToPdf(
      { path: markdownPath },
      {
        dest: pdfPath,
        pdf_options: {
          format: 'A4',
          margin: {
            top: '20mm',
            right: '20mm',
            bottom: '20mm',
            left: '20mm',
          },
          printBackground: true,
        },
        launch_options: {
          args: launchArgs,
        },
        stylesheet: [CSS_FILE],
        body_class: 'markdown-body',
      }
    );

    console.log(`✓ Generated: ${path.relative(__dirname, pdfPath)}`);
  } catch (error) {
    console.error(`✗ Error converting ${markdownPath}:`, error.message);
    throw error;
  }
}

/**
 * Main function to generate all PDFs
 */
async function main() {
  console.log('Starting PDF generation for documentation files...\n');

  // Validate that docs directory exists
  if (!fs.existsSync(DOCS_DIR)) {
    console.error(`Error: Documentation directory not found: ${DOCS_DIR}`);
    console.error('Please ensure the docs directory exists before running this script.');
    process.exit(1);
  }

  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // Write CSS file for styling
  fs.writeFileSync(CSS_FILE, GITHUB_MARKDOWN_CSS);

  // Find all markdown files
  const markdownFiles = findMarkdownFiles(DOCS_DIR);
  
  if (markdownFiles.length === 0) {
    console.warn('Warning: No markdown files found in docs directory.');
    process.exit(0);
  }
  
  console.log(`Found ${markdownFiles.length} markdown files in docs directory\n`);

  // Convert each file
  let successCount = 0;
  let errorCount = 0;

  for (const markdownFile of markdownFiles) {
    try {
      await convertMarkdownToPdf(markdownFile);
      successCount++;
    } catch (error) {
      errorCount++;
    }
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`PDF Generation Complete!`);
  console.log(`${'='.repeat(60)}`);
  console.log(`✓ Successfully converted: ${successCount} files`);
  if (errorCount > 0) {
    console.log(`✗ Failed to convert: ${errorCount} files`);
  }
  console.log(`Output directory: ${OUTPUT_DIR}`);
  console.log(`${'='.repeat(60)}\n`);

  if (errorCount > 0) {
    process.exit(1);
  }
}

// Run the script
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
