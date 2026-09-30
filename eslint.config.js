// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const eslintConfigPrettier = require('eslint-config-prettier');
const eslintPluginPrettier = require('eslint-plugin-prettier');

module.exports = defineConfig([
  expoConfig,
  {
    plugins: { prettier: eslintPluginPrettier },
    rules: {
      'prettier/prettier': 'error',
      // eslint-config-expo's react-hooks/recommended already sets these,
      // but pin them explicitly so a future upstream change can't
      // silently downgrade rules-of-hooks or upgrade exhaustive-deps.
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
  eslintConfigPrettier,
  {
    // expo-env.d.ts is auto-generated (and gitignored) by the Expo CLI, not hand-written.
    ignores: ['dist/*', 'expo-env.d.ts'],
  },
]);
