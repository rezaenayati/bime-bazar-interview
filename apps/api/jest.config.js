const preset = require('../../jest.preset.js');
module.exports = {
    ...preset,
    displayName: 'api',
    rootDir: '../..',
    testMatch: ['<rootDir>/apps/api/**/*.spec.ts'],
    testPathIgnorePatterns: ['/node_modules/', '/apps/api/test/'],
};
