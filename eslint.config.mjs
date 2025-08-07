import globals from "globals";
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import pluginJs from "@eslint/js";
import tseslint from "typescript-eslint";

export default [
  { files: ["**/*.{js,mjs,jsx,cjs,ts,tsx}"] },
  { languageOptions: { globals: globals.browser } },
  {
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    }
  },
  pluginJs.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      'no-duplicate-imports': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          "args": "all",
          "argsIgnorePattern": "^_",
          "destructuredArrayIgnorePattern": "^_",
          "varsIgnorePattern": "^_"
        }
      ],
      '@typescript-eslint/naming-convention': [
        'error',
        {
          "selector": "classProperty",
          "modifiers": ["private"],
          "format": null,
          "suffix": ["_"]
        }
      ],
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
    }
  },
  { ignores: ["node_modules", "**/coverage", "**/dist"] },
];
