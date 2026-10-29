const { config } = require('dotenv');
const { spawn } = require('child_process');
const path = require('path');

// Prisma looks for server/.env on its own. Load the repo root file first so
// there is only one env file to maintain.
config({ path: path.resolve(__dirname, '../../.env') });

const [cmd, ...args] = process.argv.slice(2);
if (!cmd) {
  console.error('Usage: node scripts/with-root-env.cjs <command> [args...]');
  process.exit(1);
}

const child = spawn(cmd, args, { stdio: 'inherit', env: process.env });
child.on('exit', (code) => process.exit(code ?? 1));
