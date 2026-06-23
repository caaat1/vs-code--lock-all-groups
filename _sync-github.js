'use strict';
const { execFileSync } = require('child_process');
const { description, repository } = require('./package.json');

const gh = process.platform === 'win32'
  ? 'C:\\Program Files\\GitHub CLI\\gh.exe'
  : 'gh';

const repo = repository.url.replace('https://github.com/', '');
execFileSync(gh, ['repo', 'edit', repo, '--description', description], { stdio: 'inherit' });
