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

/**
 * Recursively find all markdown files in a directory
 * @param {string} dir - Directory to search
 * @param {string[]} fileList - Accumulated list of files
 * @returns {string[]} Array of markdown file paths
 */
function findMarkdownFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);

  files.forEach((file) => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      findMarkdownFiles(filePath, fileList);
    } else if (file.endsWith('.md')) {
      fileList.push(filePath);
    }
  });

  return fileList;
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
          args: ['--no-sandbox', '--disable-setuid-sandbox'],
        },
        stylesheet: [
          'https://cdnjs.cloudflare.com/ajax/libs/github-markdown-css/5.2.0/github-markdown.min.css',
        ],
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

  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // Find all markdown files
  const markdownFiles = findMarkdownFiles(DOCS_DIR);
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
