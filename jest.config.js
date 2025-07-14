module.exports = {
  testEnvironment: 'jsdom',
  setupFiles: ['jest-chrome'],
  moduleFileExtensions: ['js', 'json'],
  transform: {},
  testMatch: ['**/tests/**/*.test.js'],
  collectCoverage: true,
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'lib/**/*.js',
    'service-worker.js',
    'content-script.js',
    'popup.js',
    'options.js'
  ],
  coverageReporters: ['text', 'lcov'],
  testPathIgnorePatterns: ['/node_modules/']
};