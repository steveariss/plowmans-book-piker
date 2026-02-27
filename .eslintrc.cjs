module.exports = {
  root: true,
  env: {
    browser: true,
    node: true,
    es2022: true,
  },
  extends: ['eslint:recommended'],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    ecmaFeatures: { jsx: true },
  },
  settings: {
    react: { version: 'detect' },
  },
  overrides: [
    {
      files: ['client/**/*.{js,jsx}'],
      env: { browser: true, node: false },
      extends: ['eslint:recommended', 'plugin:react/recommended', 'plugin:react/jsx-runtime'],
      plugins: ['react', 'react-hooks'],
      rules: {
        'react-hooks/rules-of-hooks': 'error',
        'react-hooks/exhaustive-deps': 'warn',
      },
    },
  ],
  ignorePatterns: ['node_modules/', 'client/dist/', 'data/'],
};
