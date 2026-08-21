import crypto from 'node:crypto';
import readline from 'node:readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

rl.question('Enter the admin password to hash: ', password => {
  if (!password) {
    console.error('Password cannot be empty.');
    rl.close();
    process.exit(1);
  }

  const N = 4096;
  const r = 8;
  const p = 1;
  const salt = crypto.randomBytes(16);
  const derivedKey = crypto.scryptSync(password, salt, 64, { N, r, p });

  // Standard string format for the DB to read
  // const dbString = `${N}$${r}$${p}$${salt.toString('hex')}$${derivedKey.toString('hex')}`;

  // Bash-escaped version for safe copy-pasting
  const bashEscapedString = `${N}\\$${r}\\$${p}\\$${salt.toString('hex')}\\$${derivedKey.toString('hex')}`;

  console.log('\n--------------------------------------------------');
  console.log('Copy this exact string for your D1 INSERT command:');
  console.log('--------------------------------------------------\n');
  console.log(bashEscapedString);
  console.log('\n--------------------------------------------------');

  rl.close();
});
