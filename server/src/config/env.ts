import dotenv from 'dotenv';
import path from 'path';

// Single source of truth: the root `Cloudmeet_web/.env`.
// (src/config or dist/config -> ../../../ is the repo root.)
// In Docker the variables come from docker-compose, so a missing file is fine.
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

export const ENV = {
  PORT: parseInt(process.env.PORT || '5000', 10),
  NODE_ENV: process.env.NODE_ENV || 'development',
  DATABASE_URL: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/cloudmeet?schema=public',
  JWT_SECRET: process.env.JWT_SECRET || 'cloudmeet_jwt_super_secret_key_change_in_production',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  
  // Tencent TRTC Configuration
  TRTC_SDK_APP_ID: parseInt(process.env.TRTC_SDK_APP_ID || '20049417', 10),
  TRTC_SECRET_KEY: process.env.TRTC_SECRET_KEY || '0379186cd7963687b317bcdd4e8ac72da8db4ab50303dadf9acc8276920b9c8b',
  TRTC_EXPIRE_TIME: parseInt(process.env.TRTC_EXPIRE_TIME || '86400', 10), // 24 hours in seconds
};
