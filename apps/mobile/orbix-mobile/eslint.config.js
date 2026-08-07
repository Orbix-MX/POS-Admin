// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', '.expo/*', 'node_modules/*', 'expo-env.d.ts'],
  },
  {
    // Scoped to TS files so it lands on the same config layer where
    // eslint-config-expo already registers the @typescript-eslint plugin;
    // re-declaring the plugin here would be a "cannot redefine" error.
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      'no-console': ['warn', { allow: ['warn', 'error'] }],

      // `export const Foo = {...} as const; export type Foo = ...` is the
      // standard way to mirror a Prisma enum without a TS `enum`. The value and
      // the type live in different declaration spaces, so this is not a real
      // redeclaration.
      '@typescript-eslint/no-redeclare': 'off',

      // axios and i18next are CJS default exports whose members are meant to be
      // reached through the default import (`axios.create`, `i18n.use`).
      'import/no-named-as-default-member': 'off',
    },
  },
]);
