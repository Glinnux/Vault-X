import { randomBytes, scryptSync } from 'node:crypto';
import { emitKeypressEvents } from 'node:readline';
import { stdin, stdout } from 'node:process';

if (!stdin.isTTY || !stdout.isTTY) {
  console.error('Run this command in an interactive terminal so the owner word is not echoed.');
  process.exit(1);
}

emitKeypressEvents(stdin);
stdin.setRawMode(true);
stdin.resume();
stdout.write('Enter a 3-letter Super Admin owner word (input hidden): ');

let ownerWord = '';
let finished = false;

function finish(exitCode = 0) {
  if (finished) return;
  finished = true;
  stdin.setRawMode(false);
  stdin.pause();
  stdin.removeAllListeners('keypress');

  if (exitCode !== 0) {
    ownerWord = '';
    stdout.write('\n');
    process.exitCode = exitCode;
    return;
  }
  if (!/^[A-Za-z]{3}$/.test(ownerWord)) {
    ownerWord = '';
    stdout.write('\nThe owner word must be exactly three letters.\n');
    process.exitCode = 1;
    return;
  }

  const salt = randomBytes(16);
  const ownerWordBytes = Buffer.from(ownerWord.toUpperCase(), 'utf8');
  ownerWord = '';
  const digest = scryptSync(ownerWordBytes, salt, 64);
  ownerWordBytes.fill(0);
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
    ownerWord = Array.from(ownerWord).slice(0, -1).join('');
    return;
  }
  if (character && !key.ctrl && !key.meta && character.length === 1) {
    ownerWord += character;
  }
});
