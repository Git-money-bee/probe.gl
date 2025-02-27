const {getESLintConfig} = require('ocular-dev-tools/configuration');

module.exports = getESLintConfig({
  react: '16.8.2',
  overrides: {
    parserOptions: {
      project: ['./tsconfig.json']
    },

    env: {
      browser: true,
      es2020: true,
      node: true
    },

    rules: {
      'import/no-unresolved': 1,
      'no-console': 1,
      'no-continue': ['warn'],
      'callback-return': 0,
      'accessor-pairs': 0,
      'max-depth': ['warn', 4],
      camelcase: 'off',
      complexity: 'off',
      'max-statements': 'off',
      'default-case': ['warn'],
      'no-eq-null': ['warn'],
      eqeqeq: ['warn'],
      radix: 0
      // 'accessor-pairs': ['error', {getWithoutSet: false, setWithoutGet: false}]
    },

    overrides: [
      {
        files: ['**/*.ts', '**/*.tsx', '**/*.d.ts'],
        rules: {
          '@typescript-eslint/no-floating-promises': 0,
          // Gradually enable
          '@typescript-eslint/ban-ts-comment': 0,
          '@typescript-eslint/ban-types': 0,
          '@typescript-eslint/no-unsafe-member-access': 0,
          '@typescript-eslint/no-unsafe-assignment': 0,
          '@typescript-eslint/no-var-requires': 0,
          '@typescript-eslint/no-unused-vars': [
            'warn',
            {vars: 'all', args: 'none', ignoreRestSiblings: false}
          ],
          // We still have some issues with import resolution
          'import/named': 0,
          'import/no-extraneous-dependencies': ['error', {devDependencies: true}], // Warn instead of error
          // 'max-params': ['warn'],
          // 'no-undef': ['warn'],
          // camelcase: ['warn'],
          // '@typescript-eslint/no-floating-promises': ['warn'],
          // '@typescript-eslint/await-thenable': ['warn'],
          // '@typescript-eslint/no-misused-promises': ['warn'],
          '@typescript-eslint/no-empty-function': ['warn', {allow: ['arrowFunctions']}],
          // We use function hoisting
          '@typescript-eslint/no-use-before-define': 0,
          // We always want explicit typing, e.g `field: string = ''`
          '@typescript-eslint/no-inferrable-types': 0,
          '@typescript-eslint/restrict-template-expressions': 0,
          '@typescript-eslint/explicit-module-boundary-types': 0,
          '@typescript-eslint/require-await': 0,
          '@typescript-eslint/no-unsafe-return': 0,
          '@typescript-eslint/no-unsafe-call': 0,
          '@typescript-eslint/no-empty-interface': 0,
          '@typescript-eslint/restrict-plus-operands': 0
        }
      },
      {
        // scripts use devDependencies
        files: ['*worker*.js', '**/worker-utils/**/*.js'],
        env: {
          browser: true,
          es2020: true,
          node: true,
          worker: true
        }
      },
      // tests are run with aliases set up in node and webpack.
      // This means lint will not find the imported files and generate false warnings
      {
        // scripts use devDependencies
        files: ['**/test/**/*.js', '**/test/**/*.ts', '**/scripts/**/*.js', '*.config.js', '*.config.local.js'],
        rules: {
          'import/no-unresolved': 0,
          'import/no-extraneous-dependencies': 0
        }
      },
      {
        files: ['examples/**/*.js'],
        rules: {
          'import/no-unresolved': 0
        }
      }
    ],

    settings: {
      // Ensure eslint finds typescript files
      'import/resolver': {
        node: {
          extensions: ['.js', '.jsx', '.mjs', '.ts', '.tsx']
        }
      }
    }
  }
});
