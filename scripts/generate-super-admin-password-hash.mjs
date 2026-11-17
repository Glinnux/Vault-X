import { randomBytes, scryptSync } from 'node:crypto';
import { emitKeypressEvents } from 'node:readline';
import { stdin, stdout } from 'node:process';

if (!stdin.isTTY || !stdout.isTTY) {
  console.error('Run this command in an interactive terminal so the password is not echoed.');
  process.exit(1);
}

emitKeypressEvents(stdin);
stdin.setRawMode(true);
stdin.resume();
stdout.write('Enter a new Super Admin password (input hidden): ');

let password = '';
let finished = false;

function finish(exitCode = 0) {
  if (finished) return;
  finished = true;
  stdin.setRawMode(false);
  stdin.pause();
  stdin.removeAllListeners('keypress');

  if (exitCode !== 0) {
    password = '';
    stdout.write('\n');
    process.exitCode = exitCode;
    return;
  }
  if (password.length < 12) {
    password = '';
    stdout.write('\nPassword must contain at least 12 characters.\n');
    process.exitCode = 1;
    return;
  }

  const salt = randomBytes(16);
  const passwordBytes = Buffer.from(password, 'utf8');
  password = '';
  const digest = scryptSync(passwordBytes, salt, 64);
  passwordBytes.fill(0);
  stdout.write(`\nscrypt$${salt.toString('hex')}$${digest.toString('hex')}\n`);
}

stdin.on('keypress', (character, key = {}) => {
  if (key.ctrl && key.name === 'c') {
    finish(130);
    return;
  }
  if (key.name === 'return' || key.name === 'enter') {
    finish();
    return;
  }
  if (key.name === 'backspace') {
    password = Array.from(password).slice(0, -1).join('');
    return;
  }
  if (character && !key.ctrl && !key.meta && character.length === 1) {
    password += character;
  }
});
