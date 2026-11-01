const { config } = require('dotenv');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Prisma looks for server/.env on its own. Load the repo root file first so
// there is only one env file to maintain.
const envCandidates = [
  path.resolve(__dirname, '../../.env'),
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), '../.env'),
];

for (const envPath of envCandidates) {
  if (fs.existsSync(envPath)) {
    config({ path: envPath });
    break;
  }
}

const [cmd, ...args] = process.argv.slice(2);
if (!cmd) {
  console.error('Usage: node scripts/with-root-env.cjs <command> [args...]');
  process.exit(1);
}

const child = spawn(cmd, args, { stdio: 'inherit', env: process.env });
child.on('exit', (code) => process.exit(code ?? 1));
