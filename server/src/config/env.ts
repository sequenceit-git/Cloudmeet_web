import dotenv from 'dotenv';
dotenv.config();

export const ENV = {
  PORT: parseInt(process.env.PORT || '5000', 10),
  NODE_ENV: process.env.NODE_ENV || 'development',
  DATABASE_URL: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/cloudmeet?schema=public',
  JWT_SECRET: process.env.JWT_SECRET || 'cloudmeet_jwt_super_secret_key_change_in_production',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  
  // Tencent TRTC Configuration
  TRTC_SDK_APP_ID: parseInt(process.env.TRTC_SDK_APP_ID || '1400000000', 10),
  TRTC_SECRET_KEY: process.env.TRTC_SECRET_KEY || 'your_tencent_trtc_secret_key_here',
  TRTC_EXPIRE_TIME: parseInt(process.env.TRTC_EXPIRE_TIME || '86400', 10), // 24 hours in seconds
};
