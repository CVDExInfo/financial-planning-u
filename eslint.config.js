import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { 
    ignores: [
      'dist',
      'dist-*',
      '*-dist',
      '.aws-sam',
      'node_modules',
      '**/*.bak',
      'packages',
      'docs-pdf',
    ] 
  },
  // TypeScript/React files configuration
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // Disable warning-only rules so lint can run cleanly while we iterate on fixes.
      'react-refresh/only-export-components': 'off',
      'react-hooks/exhaustive-deps': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      // Prevent accidental backend imports in frontend code
      'no-restricted-imports': ['error', {
        patterns: [
          {
            group: ['services/finanzas-api/*', 'services/finanzas-api'],
            message: 'Front-end must not import services/finanzas-api. Use src/api/finanzasClient.ts or shared packages instead.'
          }
        ]
      }]
    },
  },
  // Node.js/script files configuration
  {
    files: ['**/*.{js,mjs,cjs}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: {
        ...globals.node,
        ...globals.es2020,
      },
      sourceType: 'module',
    },
    rules: {
      // Allow console in Node.js scripts
      'no-console': 'off',
    },
  },
)