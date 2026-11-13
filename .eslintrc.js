module.exports = {
  env: {
    browser: false,
    es6: true,
    node: true,
    jest: true,
  },
  extends: [
    'airbnb-base',
  ],
  parserOptions: {
    ecmaVersion: 2018,
    sourceType: 'module',
  },
  rules: {
    'no-console': 'off',
    'no-shadow': 'off',
    'no-underscore-dangle': 'off',
    'consistent-return': 'off',
    'import/extensions': ['error', 'ignorePackages', {
      js: 'never',
    }],
  },
  ignorePatterns: [
    'node_modules/',
    'babel.config.js',
  ],
};
