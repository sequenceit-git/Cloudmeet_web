import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

// Single source of truth: root `cloudmeet_web/.env`.
// Check multiple candidate locations so running via tsx, compiled dist, root workspace, or server/ works seamlessly.
const envCandidates = [
  path.resolve(__dirname, '../../../.env'),
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), '../.env'),
];

for (const candidate of envCandidates) {
  if (fs.existsSync(candidate)) {
    dotenv.config({ path: candidate });
    break;
  }
}

export const ENV = {
  PORT: parseInt(process.env.PORT || '5000', 10),
  NODE_ENV: process.env.NODE_ENV || 'development',
  DATABASE_URL: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/cloudmeet?schema=public',
  JWT_SECRET: process.env.JWT_SECRET || 'cloudmeet_jwt_super_secret_key_change_in_production',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  
  // Tencent TRTC Configuration
  TRTC_SDK_APP_ID: parseInt(process.env.TRTC_SDK_APP_ID || process.env.VITE_TRTC_SDK_APP_ID || '1600170349', 10),
  TRTC_SECRET_KEY: process.env.TRTC_SECRET_KEY || '8490a63f0fc629b77c80408fe9edb025c70d0f57626b0954480bfbc736c4c3fa',
  TRTC_EXPIRE_TIME: parseInt(process.env.TRTC_EXPIRE_TIME || '86400', 10), // 24 hours in seconds

  // Admin panel login. Edit these in the root .env and restart the API.
  ADMIN_EMAIL: (process.env.ADMIN_EMAIL || '').trim(),
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || '',
};
