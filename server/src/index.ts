import express from 'express';
import cors from 'cors';
import { ENV } from './config/env';
import routes from './routes';
import { errorHandler } from './middleware/error.middleware';

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Root health check endpoint
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'CloudMeet API Engine' });
});

// API Version 1
app.use('/api/v1', routes);

// Global Error Handler
app.use(errorHandler);

app.listen(ENV.PORT, () => {
  console.log(`===============================================`);
  console.log(`🚀 CloudMeet Backend API running on port ${ENV.PORT}`);
  console.log(`📡 Environment: ${ENV.NODE_ENV}`);
  console.log(`🔑 TRTC SDKAppID: ${ENV.TRTC_SDK_APP_ID}`);
  console.log(`🔗 API Base: http://localhost:${ENV.PORT}/api/v1`);
  console.log(`===============================================`);
});

export default app;
