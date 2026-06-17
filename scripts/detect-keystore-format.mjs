#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const file = process.argv[2];

if (!file) {
  console.error('Usage: node scripts/detect-keystore-format.mjs <keystore>');
  process.exit(1);
}

if (!existsSync(file)) {
  console.error(`File not found: ${file}`);
  process.exit(1);
}

function isPkcs12() {
  try {
    execFileSync('openssl', ['pkcs12', '-info', '-in', file, '-passin', 'pass:dummy', '-noout'], {
      stdio: 'pipe',
    });

    return true;
  } catch (error) {
    const stderr =
      error && typeof error === 'object' && 'stderr' in error ? String(error.stderr) : '';

    return stderr.includes('Mac verify error') || stderr.includes('invalid password');
  }
}

console.log(`Keystore type: ${isPkcs12() ? 'PKCS12' : 'JKS or unknown'}`);
