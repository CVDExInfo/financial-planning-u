# GitHub Pages Deployment Setup

This document outlines the GitHub Pages deployment configuration for the Financial Planning & Management UI.

## ✅ Configured Files

### 1. GitHub Actions Workflow (`.github/workflows/deploy.yml`)
- **Trigger**: Pushes to `main` branch and pull requests
- **Build Process**: 
  - Node.js 18 setup with npm caching
  - TypeScript type checking 
  - ESLint linting
  - Vite production build
- **Deployment**: Automatic deployment to GitHub Pages on main branch pushes
- **Permissions**: Configured for GitHub Pages deployment with proper GITHUB_TOKEN permissions

### 2. Vite Configuration Updates (`vite.config.ts`)
- **Base Path**: Set to `/financial-planning-u/` for GitHub Pages compatibility
- **Build Optimization**: 
  - Source maps enabled for debugging
  - Manual chunks for better caching (react-vendor, router, query, charts, ui)
  - Output directory: `dist/`

### 3. PR Template (`.github/pull_request_template.md`)  
- Comprehensive QC checklist covering visual, data, export, navigation, and technical requirements
- Scope compliance verification (no ITSM features)
- Documentation and testing guidelines

## 🚀 Enabling GitHub Pages

### Repository Settings Required:
1. **Go to Repository Settings** → **Pages**
2. **Source**: Deploy from a branch  
3. **Branch**: Select `gh-pages` (will be created by GitHub Actions)
4. **Folder**: `/ (root)`

### Deployment Process:
1. **Push to main** → GitHub Actions triggered
2. **Build succeeds** → Artifact uploaded to `gh-pages` branch
3. **GitHub Pages** → Automatically serves content from `gh-pages`
4. **Live URL**: `https://[username].github.io/financial-planning-u/`

## 📋 Manual Setup Steps

Since GitHub Actions cannot modify repository settings, you need to manually:

1. **Navigate to** your repository on GitHub.com
2. **Click "Settings"** tab (requires admin access)
3. **Scroll down to "Pages"** in left sidebar
4. **Select Source**: "Deploy from a branch"
5. **Select Branch**: `gh-pages` (will appear after first successful deployment)
6. **Select Folder**: `/ (root)`
7. **Click "Save"**

## 🔍 Verification

After the first successful deployment:
- Check the **Actions** tab for build status
- The **Pages** section in Settings will show the live URL
- Visit the URL to confirm the application loads correctly

## 🛠️ Local Development

The base path configuration automatically switches:
- **Development** (`npm run dev`): Base path `/`
- **Production** (`npm run build`): Base path `/financial-planning-u/`

This ensures local development works normally while production deployment works on GitHub Pages.

## 🔧 Troubleshooting

### Common Issues:
- **404 on assets**: Verify `base` path in `vite.config.ts` matches repository name
- **Build failures**: Check GitHub Actions logs in repository's "Actions" tab  
- **Pages not updating**: Check if Pages is enabled and `gh-pages` branch exists

### Debugging:
- **Actions logs**: Full build and deployment logs available in GitHub Actions
- **Build artifact**: Download from Actions to verify contents locally
- **Production preview**: Use `npm run build && npm run preview` to test locally