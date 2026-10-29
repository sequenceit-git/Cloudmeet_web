import express from 'express';
import cors from 'cors';
import { ENV } from './config/env';
import routes from './routes';
import { errorHandler } from './middleware/error.middleware';
import { adminService } from './services/admin.service';
import { meetingService } from './services/meeting.service';
import { prisma } from './database/prisma';

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Root health check endpoint
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'CloudNews API Engine' });
});

// Deep link web landing & launcher for /join/:code
app.get('/join/:code', (req, res) => {
  const code = (req.params.code || '').replace(/[^a-zA-Z0-9-]/g, '');
  const deepLink = `cloudmeet://join/${code}`;

  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CloudNews - Join Meeting ${code}</title>
  <meta name="description" content="Click to join live meeting ${code} on CloudNews">
  <meta property="og:title" content="Join CloudNews: ${code}">
  <meta property="og:description" content="Ultra-low latency HD video meetings powered by Tencent TRTC">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: radial-gradient(circle at 50% 20%, #1e1b4b 0%, #030712 100%);
      color: #f8fafc;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }
    .card {
      background: rgba(30, 41, 59, 0.7);
      backdrop-filter: blur(16px);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 20px;
      padding: 36px 28px;
      max-width: 420px;
      width: 100%;
      text-align: center;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7);
    }
    .badge {
      display: inline-block;
      padding: 6px 14px;
      background: rgba(99, 102, 241, 0.15);
      border: 1px solid rgba(99, 102, 241, 0.4);
      color: #818cf8;
      border-radius: 999px;
      font-size: 0.8rem;
      font-weight: 700;
      letter-spacing: 0.05em;
      margin-bottom: 20px;
    }
    .room-code {
      font-size: 2rem;
      font-weight: 800;
      letter-spacing: 0.08em;
      color: #38bdf8;
      font-family: ui-monospace, monospace;
      margin: 14px 0 24px;
    }
    .btn {
      display: block;
      width: 100%;
      padding: 14px 20px;
      border-radius: 12px;
      background: linear-gradient(135deg, #6366f1, #06b6d4);
      color: #ffffff;
      font-weight: 700;
      text-decoration: none;
      font-size: 1rem;
      border: none;
      cursor: pointer;
      box-shadow: 0 10px 25px -5px rgba(99, 102, 241, 0.4);
      transition: transform 0.15s ease;
    }
    .btn:active {
      transform: scale(0.98);
    }
    .hint {
      margin-top: 20px;
      font-size: 0.8125rem;
      color: #94a3b8;
      line-height: 1.5;
    }
  </style>
  <script>
    // Automatically trigger app launch via deep link
    window.location.href = "${deepLink}";
  </script>
</head>
<body>
  <div class="card">
    <div class="badge">CLOUDMEET ROOM GATEWAY</div>
    <h1 style="font-size: 1.35rem; margin-bottom: 8px;">Joining Meeting</h1>
    <p style="color: #cbd5e1; font-size: 0.875rem;">Connecting you to the live video session...</p>
    <div class="room-code">${code}</div>
    <a href="${deepLink}" class="btn">Open in CloudNews App</a>
    <p class="hint">
      If the app didn't open automatically, tap the button above to launch CloudNews on your device.
    </p>
  </div>
</body>
</html>`);
});

// API Version 1
app.use('/api/v1', routes);

// Global Error Handler
app.use(errorHandler);

const HOST_CLEANUP_INTERVAL_MS = 12 * 60 * 60 * 1000;

function scheduleHostCleanup() {
  adminService.deleteExpiredHosts().catch((err) => {
    console.error('[HostCleanup] Failed to delete expired hosts:', err);
  });
}

const EMPTY_ROOM_CHECK_MS = 60 * 1000;

function scheduleEmptyRoomCleanup() {
  meetingService.endEmptyMeetings().catch((err) => {
    console.error('[MeetingCleanup] Failed to end empty meetings:', err);
  });
}

async function start() {
  // In production a failed database must stop the process. Otherwise hosts and
  // meetings are written to RAM and disappear on the next image rebuild.
  if (ENV.NODE_ENV === 'production') {
    try {
      await prisma.$queryRaw`SELECT 1`;
      console.log('PostgreSQL connected. Admin data is stored on the database volume.');
    } catch (err) {
      console.error('PostgreSQL connection failed. The API will not start, so data is not saved in memory.');
      console.error(err);
      process.exit(1);
    }
  }

  app.listen(ENV.PORT, () => {
    scheduleHostCleanup();
    scheduleEmptyRoomCleanup();
    setInterval(scheduleHostCleanup, HOST_CLEANUP_INTERVAL_MS);
    setInterval(scheduleEmptyRoomCleanup, EMPTY_ROOM_CHECK_MS);
    console.log(`===============================================`);
    console.log(`🚀 CloudNews Backend API running on port ${ENV.PORT}`);
    console.log(`📡 Environment: ${ENV.NODE_ENV}`);
    console.log(`🔑 TRTC SDKAppID: ${ENV.TRTC_SDK_APP_ID}`);
    console.log(`🔗 API Base: http://localhost:${ENV.PORT}/api/v1`);
    console.log(`===============================================`);
  });
}

start();

export default app;
