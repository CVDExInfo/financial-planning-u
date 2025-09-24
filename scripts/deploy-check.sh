#!/bin/bash

# Quick Build & Deploy Verification Script
# This script verifies the application can build successfully for deployment

echo "🚀 Financial Planning & Management UI - Build Verification"
echo "=========================================================="

# Check Node.js version
echo "📋 Checking environment..."
node --version
npm --version

echo ""
echo "📦 Installing dependencies..."
npm ci --silent

echo ""
echo "🔍 Running type check..."
if npm run typecheck; then
    echo "✅ TypeScript check passed"
else
    echo "❌ TypeScript errors found"
    exit 1
fi

echo ""
echo "🧹 Running linter..."
if npm run lint; then
    echo "✅ Lint check passed"
else 
    echo "❌ Lint errors found"
    exit 1
fi

echo ""
echo "🏗️ Building application..."
if npm run build; then
    echo "✅ Build successful"
else
    echo "❌ Build failed"
    exit 1
fi

echo ""
echo "📊 Build analysis..."
if [ -d "dist" ]; then
    echo "📁 Build output size:"
    du -sh dist/
    echo ""
    echo "📄 Generated files:"
    find dist/ -name "*.js" -o -name "*.css" -o -name "*.html" | head -10
else
    echo "❌ Build directory not found"
    exit 1
fi

echo ""
echo "🎉 Build verification complete!"
echo "✅ Ready for deployment to GitHub Pages"
echo ""
echo "📝 Next steps:"
echo "  1. Push to main branch to trigger GitHub Actions"
echo "  2. Enable GitHub Pages in repository settings"
echo "  3. Visit: https://[username].github.io/financial-planning-management-ui/"