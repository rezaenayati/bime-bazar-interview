const preset = require('../../jest.preset.js');

module.exports = {
    ...preset,
    displayName: 'api-e2e',
    rootDir: '../..',
    testMatch: ['<rootDir>/apps/api/test/**/*.e2e-spec.ts'],
    maxWorkers: 1,
    testTimeout: 30_000,
};
