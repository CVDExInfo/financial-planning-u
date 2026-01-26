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
      // Prevent Temporal Dead Zone (TDZ) errors by detecting use-before-define
      // - Allow function declarations (hoisted)
      // - Disallow variables/classes used before definition
      '@typescript-eslint/no-use-before-define': ['error', {
        functions: false,  // Function declarations are hoisted, so allow them
        classes: true,     // Class declarations must be defined before use
        variables: true,   // Variables (const/let) must be defined before use
        allowNamedExports: false
      }],
      // Prevent accidental backend imports in frontend code
      'no-restricted-imports': ['error', {
        paths: [
          {
            name: 'services/finanzas-api',
            message: 'Front-end must not import services/finanzas-api. Use src/api/finanzasClient.ts or shared packages instead.'
          },
          {
            name: '@/lib/rubros/canonical-taxonomy',
            message: 'Use @/lib/rubros public API instead. Import canonicalizeRubroId, getTaxonomyEntry, allRubros, etc. from @/lib/rubros.'
          }
        ],
        patterns: [
          {
            group: ['services/finanzas-api/*'],
            message: 'Front-end must not import from services/finanzas-api.'
          },
          {
            group: ['**/lib/rubros/canonical-taxonomy'],
            message: 'Use @/lib/rubros public API instead of importing canonical-taxonomy directly. See src/lib/rubros/index.ts for available functions.'
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