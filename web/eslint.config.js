import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
    rules: {
      'react-hooks/exhaustive-deps': 'off',
      // Permite setState síncrono al montar / en efectos (p. ej. loaders que ponen loading antes del await).
      'react-hooks/set-state-in-effect': 'off',
      // Excepción general: no bloquear por `any` explícito (se prefiere tipar en código nuevo).
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
])
