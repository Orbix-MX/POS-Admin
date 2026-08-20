import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  // El código reutilizado del Admin Web se lintea en su propio paquete.
  // Los `.d.ts` son declaraciones, no código de la app: se comprueban con tsc.
  { ignores: ['dist', 'node_modules', 'src/**/*.d.ts'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      // Misma excepción que el Admin Web: los loaders ponen `loading` antes del
      // await, que es setState síncrono dentro del efecto de montaje.
      'react-hooks/set-state-in-effect': 'off',
    },
  },
)
