#!/usr/bin/env node
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

const libs = [
  { path: 'shared/kernel', tags: ['scope:shared', 'type:kernel'] },
  { path: 'shared/infra', tags: ['scope:shared', 'type:infra'] },
  { path: 'customer/domain', tags: ['scope:customer', 'type:domain'] },
  { path: 'customer/application', tags: ['scope:customer', 'type:application'] },
  { path: 'customer/infrastructure', tags: ['scope:customer', 'type:infrastructure'] },
  { path: 'product/domain', tags: ['scope:product', 'type:domain'] },
  { path: 'product/application', tags: ['scope:product', 'type:application'] },
  { path: 'product/infrastructure', tags: ['scope:product', 'type:infrastructure'] },
  { path: 'order/domain', tags: ['scope:order', 'type:domain'] },
  { path: 'order/application', tags: ['scope:order', 'type:application'] },
  { path: 'order/infrastructure', tags: ['scope:order', 'type:infrastructure'] },
  { path: 'payment/domain', tags: ['scope:payment', 'type:domain'] },
  { path: 'payment/application', tags: ['scope:payment', 'type:application'] },
  { path: 'payment/infrastructure', tags: ['scope:payment', 'type:infrastructure'] },
];

const ROOT = join(import.meta.dirname, '..');

function writeIfMissing(path, content) {
  const full = join(ROOT, path);
  if (existsSync(full)) return false;
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, content);
  return true;
}

for (const lib of libs) {
  const dir = `libs/${lib.path}`;
  const name = lib.path.replace('/', '-');

  writeIfMissing(`${dir}/project.json`, JSON.stringify({
    name,
    $schema: '../../../node_modules/nx/schemas/project-schema.json',
    sourceRoot: `${dir}/src`,
    projectType: 'library',
    tags: lib.tags,
    targets: {
      test: {
        executor: 'nx:run-commands',
        options: { command: `jest --config ${dir}/jest.config.ts --passWithNoTests` },
      },
      lint: {
        executor: 'nx:run-commands',
        options: { command: `eslint ${dir}/src` },
      },
    },
  }, null, 2) + '\n');

  writeIfMissing(`${dir}/tsconfig.json`, JSON.stringify({
    extends: '../../../tsconfig.base.json',
    compilerOptions: { outDir: '../../../dist/out-tsc', types: ['node'] },
    include: ['src/**/*.ts'],
  }, null, 2) + '\n');

  writeIfMissing(`${dir}/jest.config.ts`, `/* eslint-disable */
import preset from '../../../jest.preset.js';

export default {
  ...preset,
  displayName: '${name}',
  rootDir: '../../..',
  testMatch: ['<rootDir>/${dir}/**/*.spec.ts'],
};
`);

  writeIfMissing(`${dir}/src/index.ts`, `export {};\n`);
}

console.log('scaffolded', libs.length, 'libs');
