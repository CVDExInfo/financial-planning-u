# Brand Logos

This directory contains corporate brand logos used in documentation generation.

## Files

- `cvdex-logo.png` - CVDex brand logo (placeholder)
- `ikusi-logo.png` - Ikusi brand logo (placeholder)

## Usage

The documentation pipeline uses these logos based on the `USE_CVDEX_BRANDING` environment variable:
- If `USE_CVDEX_BRANDING=true`, the CVDex logo is used
- Otherwise, the Ikusi logo is used (default)

## Requirements

- Logo format: PNG or SVG
- Recommended dimensions: 400x100px or similar aspect ratio
- Transparent background preferred
