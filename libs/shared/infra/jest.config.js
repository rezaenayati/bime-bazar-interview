const preset = require('../../../jest.preset.js');
const path = require('path');
const projectDir = path.relative(path.join(__dirname, '../../..'), __dirname);
module.exports = {
  ...preset,
  displayName: projectDir.replace(/\//g, '-'),
  rootDir: '../../..',
  testMatch: [`<rootDir>/${projectDir}/**/*.spec.ts`],
};
