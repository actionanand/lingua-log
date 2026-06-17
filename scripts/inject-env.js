const fs = require('fs');
const path = require('path');

const envFile = path.join(__dirname, '..', 'src', 'environments', 'environment.ts');
let content = fs.readFileSync(envFile, 'utf8');

const passwordHash = process.env.PASSWORD_HASH;

if (!passwordHash) {
  throw new Error('PASSWORD_HASH_PLACEHOLDER was not replaced because PASSWORD_HASH is empty.');
}

content = content.replaceAll('PASSWORD_HASH_PLACEHOLDER', passwordHash);

fs.writeFileSync(envFile, content);
console.log('Build-time environment injection complete.');
