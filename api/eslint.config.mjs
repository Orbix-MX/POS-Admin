// @ts-check
import eslint from '@eslint/js';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['eslint.config.mjs'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  eslintPluginPrettierRecommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
      sourceType: 'commonjs',
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-floating-promises': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', { varsIgnorePattern: '^_', destructuredArrayIgnorePattern: '^_', ignoreRestSiblings: true }],
      "prettier/prettier": "off",
    },
  },
  {
    // Regla 02 / ADR-0025: los módulos de negocio no conocen al proveedor de
    // IA, la configuración de routing ni los prompts. Solo dependen de
    // `AiGatewayService` (exportado por AiModule). Violarla rompe el build,
    // no solo la revisión de código — ver §02 y el criterio de aceptación
    // #1 del documento de arquitectura Orbix AI Platform.
    files: ['src/modules/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/ai/providers/**', '**/ai/config/**', '**/ai/prompts/templates/**'],
              message:
                'Los módulos de negocio no importan proveedores, configuración de routing ni plantillas de IA directamente — dependan de AiGatewayService (src/ai/ai.module.ts). Ver ADR-0025.',
            },
          ],
        },
      ],
    },
  },
);
