#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const versionFile = path.join(__dirname, '..', 'android-version.json');
const bumpType = process.argv[2];

if (!fs.existsSync(versionFile)) {
  fs.writeFileSync(
    versionFile,
    `${JSON.stringify({ versionCode: 1, versionName: '1.0.0' }, null, 2)}\n`,
  );
}

const version = JSON.parse(fs.readFileSync(versionFile, 'utf8'));
version.versionCode = Number(version.versionCode ?? 0) + 1;

if (bumpType === '--patch' || bumpType === '--minor' || bumpType === '--major') {
  const [major = 1, minor = 0, patch = 0] = String(version.versionName ?? '1.0.0')
    .split('.')
    .map(Number);

  if (bumpType === '--patch') {
    version.versionName = `${major}.${minor}.${patch + 1}`;
  }

  if (bumpType === '--minor') {
    version.versionName = `${major}.${minor + 1}.0`;
  }

  if (bumpType === '--major') {
    version.versionName = `${major + 1}.0.0`;
  }
}

fs.writeFileSync(versionFile, `${JSON.stringify(version, null, 2)}\n`);
console.log(`Android versionCode=${version.versionCode} versionName=${version.versionName}`);
