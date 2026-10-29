# CloudNews Web & API Engine

> **CloudNews** is an enterprise-grade online video conferencing cluster management portal and backend API engine, powered by **Tencent TRTC (Tencent Real-Time Communication)** for ultra-low latency global audio/video routing, dynamic credential issuance, host administration, and end-to-end meeting orchestration.

[![Node.js](https://img.shields.io/badge/Node.js-20%2B-brightgreen.svg)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-19.2-blue.svg)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue.svg)](https://www.typescriptlang.org/)
[![Tencent TRTC](https://img.shields.io/badge/Tencent%20TRTC-TLSSigAPIv2-orange.svg)](https://trtc.io/)
[![Docker](https://img.shields.io/badge/Docker-Production%20Ready-2496ED.svg)](https://www.docker.com/)
[![Traefik](https://img.shields.io/badge/Traefik-Reverse%20Proxy-24A1C1.svg)](https://traefik.io/)

---

## 📑 Table of Contents
1. [Architecture & Features](#1-architecture--features)
2. [Project Structure](#2-project-structure)
3. [Local Development](#3-local-development)
4. [Production Deployment (Docker & Traefik)](#4-production-deployment-docker--traefik)
5. [Traefik Routing Configuration](#5-traefik-routing-configuration)
6. [API Endpoints Reference](#6-api-endpoints-reference)
7. [Environment Variables Reference](#7-environment-variables-reference)
8. [License](#8-license)

---

## 1. Architecture & Features

### 🔐 Tencent TRTC Security & Credential Center
- Server-side HMAC-SHA256 calculation for `TLSSigAPIv2` generation.
- Ephemeral tokens (`UserSig`) tied to `(SDKAppID, userId, roomId)` with configurable expiration (e.g. 24h).
- The master TRTC secret key is strictly encapsulated inside the backend `.env` and is never exposed to mobile or web clients.

### 🎥 Meeting Orchestration & Lifecycle
- Instant meeting creation with automatic 9-digit formatted room IDs (e.g. `849-210-994`).
- Streamlined 1-step guest joining via deep links (`cloudmeet://join/{code}`) or manual code entry.
- Host moderation capabilities: remote mute all participants and room termination.

### 💻 Modern Web Admin Portal
- **100% Real Live Data**: Direct REST API integration monitoring active streams, real-time participant counts, and host permissions.
- **Dedicated Login Guard**: Authenticated access control with session persistence and secure sign-out.
- **100% Mobile Responsive**: Dedicated mobile card streaming view, adaptive segmented navigation, and zero horizontal scroll overflow.
- **Bilingual Interface**: Simplified Chinese (`zh-CN`) by default with an instant English (`EN`) toggle.

### 🛡️ Resilient Data Storage
- PostgreSQL database integrated via Prisma ORM.
- Graceful in-memory cache fallback when PostgreSQL is not configured, enabling instant zero-barrier local evaluation and rapid prototyping.

---

## 2. Project Structure

```
cloudmeet_web/
├── server/                               # Backend API Engine (Node.js + Express + TypeScript)
│   ├── src/
│   │   ├── config/                       # Environment schemas & runtime configuration
│   │   ├── controllers/                  # Route controllers (auth, meeting, admin, trtc)
│   │   ├── database/                     # Prisma database client & in-memory fallback store
│   │   ├── middleware/                   # JWT authentication guards & error handling
│   │   ├── routes/                       # Express REST API route declarations
│   │   ├── services/                     # Business logic & Tencent TRTC UserSig generator
│   │   └── index.ts                      # Server bootstrap entry point
│   ├── prisma/                           # PostgreSQL schema definitions
│   ├── Dockerfile                        # Multi-stage production Node.js Alpine build
│   ├── .dockerignore
│   └── package.json
│
├── admin/                                # Web Admin Portal (React 19 + Vite + Vanilla CSS)
│   ├── src/
│   │   ├── components/                   # UI components
│   │   ├── config/                       # Frontend environment configuration
│   │   ├── services/                     # Typed Admin REST API client
│   │   ├── i18n.ts                       # Bilingual localization dictionary (zh / en)
│   │   ├── index.css                     # Glassmorphic design system & mobile media queries
│   │   ├── App.tsx                       # Main application view (Login Panel & Dashboard)
│   │   └── main.tsx
│   ├── nginx.conf                        # Production Nginx SPA fallback & Gzip compression
│   ├── Dockerfile                        # Multi-stage Vite bundle + Nginx Alpine build
│   ├── .dockerignore
│   └── package.json
│
├── docker-compose.yml                    # Production compose stack (plugs into existing Traefik)
├── .env.production.example               # Production environment variables template
├── package.json                          # Monorepo root workspace scripts
└── README.md
```

---

## 3. Local Development

### Prerequisites
- Node.js 20+ installed
- npm 9+ installed

### Installation
Install dependencies across both `server` and `admin` workspaces:

```bash
# In cloudmeet_web workspace root
npm install
npm --prefix server install
npm --prefix admin install
```

### Configure Local Environment
There is a single environment file for the whole project: the root `.env`. The backend, Docker Compose, and production all read from it.

```bash
cp .env.production.example .env
```

Fill in the values. For local development you can also add `DATABASE_URL` (optional; without a reachable PostgreSQL the API falls back to the in-memory store).

### Start Development Servers
From the `cloudmeet_web` root directory, execute:

```bash
npm run dev
```

This concurrently launches:
- **Backend API**: [http://localhost:5000/api/v1](http://localhost:5000/api/v1)
- **Web Admin Portal**: [http://localhost:5173/](http://localhost:5173/)

**Administrator login** comes from `ADMIN_EMAIL` and `ADMIN_PASSWORD` in the root `.env`. Restart the API after changing them.

---

## 4. Production Deployment (Docker & Traefik)

- **Domain**: `admin.cloudnewsmeet.com`
- **Server IP**: `69.62.75.165`

On your Linux VPS (`69.62.75.165`), clone or upload the `cloudmeet_web` repository:

```bash
cd cloudmeet_web

# 1. Create your production environment file
cp .env.production.example .env
nano .env

# 2. Find the network your running Traefik container is attached to, and set it as TRAEFIK_NETWORK in .env (default: proxy)
docker inspect traefik --format '{{range $name, $_ := .NetworkSettings.Networks}}{{$name}}{{"\n"}}{{end}}'

# 3. Build and launch containers in the background
docker compose up -d --build
```

---

## 5. Traefik Routing Configuration

All inbound HTTPS traffic to `admin.cloudnewsmeet.com` is routed by your existing Traefik reverse proxy:

| Destination | Path Rule | Priority | Internal Port | Description |
| :--- | :--- | :---: | :---: | :--- |
| **Backend API** (`server`) | `Host(`admin.cloudnewsmeet.com`) && (PathPrefix(`/api`) \|\| PathPrefix(`/health`) \|\| PathPrefix(`/join`))` | 20 | `5000` | Handles REST API calls and health probes |
| **Admin Portal** (`admin`) | `Host(`admin.cloudnewsmeet.com`)` | 10 | `80` | Serves the single-page application via Nginx |

---

## 6. API Endpoints Reference

### 6.1 Authentication (`/api/v1/auth`)
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/v1/auth/admin/login` | Administrator sign-in; returns admin JWT token |
| `POST` | `/api/v1/auth/host/login` | Mobile host authentication; returns host JWT token |

### 6.2 Meetings (`/api/v1/meetings`)
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/v1/meetings/instant` | Host creates a new instant room (returns 9-digit code) |
| `GET` | `/api/v1/meetings/:code/validate` | Validates room availability and status |
| `POST` | `/api/v1/meetings/:code/join` | Guest or attendee joins room; generates TRTC `UserSig` |
| `POST` | `/api/v1/meetings/:id/end` | Host ends meeting and dismisses room stream |

### 6.3 Administration (`/api/v1/admin`)
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/v1/admin/dashboard` | Returns active rooms count, total sessions, and registered hosts |
| `GET` | `/api/v1/admin/hosts` | Retrieves list of all authorized host accounts |
| `POST` | `/api/v1/admin/hosts` | Provisions a new host account (name, email, password) |
| `PATCH`| `/api/v1/admin/hosts/:id/status` | Toggles host status (`Active` / `Suspended`) |
| `DELETE`| `/api/v1/admin/hosts/:id` | Permanently deletes a host account |
| `GET` | `/api/v1/admin/meetings` | Real-time monitoring of active and historical sessions |

### 6.4 System Health
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/health` or `/api/v1/health` | Service uptime and status probe (Status 200 OK) |

---

## 7. Environment Variables Reference

| Variable | Default / Example | Purpose |
| :--- | :--- | :--- |
| `DOMAIN` | `admin.cloudnewsmeet.com` | Target production domain name |
| `TRAEFIK_NETWORK` | `proxy` | Docker network of your running Traefik container |
| `TRAEFIK_ENTRYPOINT` | `websecure` | Traefik HTTPS entrypoint name |
| `TRAEFIK_CERT_RESOLVER`| `letsencrypt` | Traefik ACME certificate resolver name |
| `PORT` | `5000` | Node.js backend port |
| `NODE_ENV` | `production` | Node.js environment mode |
| `JWT_SECRET` | Strong random string | Symmetric key for signing authentication tokens |
| `TRTC_SDK_APP_ID` | `1400XXXXXX` | Tencent Cloud TRTC SDKAppID |
| `TRTC_SECRET_KEY` | 32-character hex key | Tencent Cloud TRTC Secret Key (for HMAC-SHA256 signature) |
| `ADMIN_EMAIL` | `admin@cloudmeet.cn` | Default Super Administrator email |
| `ADMIN_PASSWORD` | `admin123456` | Default Super Administrator password |
| `POSTGRES_USER` | `cloudmeet` | PostgreSQL username |
| `POSTGRES_PASSWORD` | Strong password | PostgreSQL password |
| `POSTGRES_DB` | `cloudmeet_db` | PostgreSQL database name |

---

## 8. License

This project is proprietary and confidential. All rights reserved by **SequenceIT Team**.
