# Fleet Management System

A robust fleet management and vehicle telemetry platform built with TypeScript, Express, PostgreSQL, and Redis. Designed for real-time tracking, alerts, secure ingestion, and fleet-wide analytics.

---

## Key Features

- **Real-Time Telemetry Ingestion**: Capture vehicle data including GPS, speed, fuel, engine status, and distance.
- **Fleet and Owner Management**: Register owners and organize vehicles into categorized fleets (Corporate, Rental, Personal).
- **Sliding Window Rate Limiting**: Redis-backed, efficient rate limiting with custom logic for critical endpoints.
- **API Key-Based Vehicle Authentication**: Secure per-vehicle access using hashed API keys and custom middleware.
- **Automated Alerting**: Detects and notifies for speed violations, low fuel, engine issues, and maintenance events.
- **Redis Caching Layer**: TTL-based caching for analytics, telemetry, and alert data.
- **Administrative APIs**: Provisioning, cache management, authentication status, and alert resolution.

---

## System Architecture

### PostgreSQL Schema Overview

| Table | Description |
|-------|-------------|
| `owners` | Fleet owner information |
| `fleets` | Grouping of vehicles under owners |
| `vehicles` | Vehicle inventory with unique VINs |
| `telemetry` | Time-series vehicle telemetry data |
| `alerts` | Alerts with severity, metadata, and timestamps |
| `vehicle_auth` | API key management using SHA-256 hash |
| `vehicle_request_logs` | Tracks vehicle requests for rate limiting |

---

## Directory Structure

```
motorqts/
├── src/
│   ├── app.ts                    # Main Express application setup
│   ├── index.ts                  # Application entry point
│   ├── database/
│   │   └── connection.ts         # PostgreSQL connection pool
│   ├── middleware/
│   │   ├── rateLimiter.ts        # Sliding window rate limiting
│   │   └── vehicleAuth.ts        # Vehicle API key authentication
│   ├── routes/                   # Express route handlers
│   │   ├── admin.ts              # Admin endpoints (provisioning, monitoring)
│   │   ├── alert.ts              # Alert management routes
│   │   ├── fleet.ts              # Fleet management and analytics
│   │   ├── owner.ts              # Owner management
│   │   ├── telemetry.ts          # Telemetry data ingestion
│   │   └── vehicle.ts            # Vehicle management
│   ├── services/                 # Business logic layer
│   │   ├── alertComputationService.ts  # Automated alert generation
│   │   ├── alertService.ts       # Alert management service
│   │   ├── backgroundJobService.ts     # Background task management
│   │   ├── cacheService.ts       # Redis caching service
│   │   ├── fleetService.ts       # Fleet operations
│   │   ├── motorq.ts             # Core business logic service
│   │   ├── ownerService.ts       # Owner management
│   │   ├── telemetryService.ts   # Telemetry data handling
│   │   └── vehicleService.ts     # Vehicle operations
│   └── types/                    # TypeScript type definitions
│       ├── Alert.ts              # Alert types and interfaces
│       ├── Fleet.ts              # Fleet data structures
│       ├── Owner.ts              # Owner entity definitions
│       ├── Telemetry.ts          # Telemetry data types
│       └── Vehicle.ts            # Vehicle entity definitions
├── tests/                        # Test suite
│   ├── setup.ts                  # Test configuration
│   ├── app.test.ts               # Application integration tests
│   ├── middleware/               # Middleware tests
│   └── services/                 # Service layer tests
├── scripts/                      # Utility scripts
│   ├── check_db.ts               # Database connection verification
│   ├── init_database.ts          # Database schema initialization
│   ├── generate_fleets.ts        # Test data generation and simulation
│   ├── test_rate_limiting.ts     # Rate limiting verification
│   └── test_sliding_window.ts    # Sliding window algorithm testing
├── docker-compose.yml            # Multi-container orchestration
├── Dockerfile                    # Application containerization
├── package.json                  # Dependencies and scripts
├── tsconfig.json                 # TypeScript configuration
├── jest.config.js                # Testing framework setup
└── .env                          # Environment variables
```

---

## Getting Started

### Prerequisites

- Node.js v18+
- Docker & Docker Compose

### Installation

```bash
# 1. Clone the repository
git clone <repository-url>
cd motorqts

# 2. Install Node dependencies
npm install

# 3. Set up environment variables
cp .env.example .env
# Edit .env with your configuration

# 4. Start Redis and PostgreSQL using Docker
docker compose up -d

# 5. Initialize the database schema
npm run init-db

# 6. Start the application
npm run dev
```

---

## REST API Endpoints

### Public
- `GET /` – Health check
- `GET /status` – System and job status  
- `GET /data` – Internal telemetry and state snapshot

### Owner & Fleet
- `POST /owner/add`
- `GET /owner/`
- `POST /fleet/add`
- `GET /fleet/:fleetId/analytics`
- `GET /fleet/:fleetId/distance/24h`
- `GET /fleet/:fleetId/alerts`
- `GET /fleet/:fleetId/vehicles`

### Vehicle & Telemetry
- `POST /vehicle/add`
- `GET /vehicle/`
- `GET /vehicle/:vehicleVin/alerts`
- `GET /vehicle/:vehicleId/telemetry`
- `GET /vehicle/:vehicleId/telemetry/latest`
- `POST /telemetry/capture` (Authenticated)
- `POST /telemetry/capture/batch` (Authenticated)

### Alerts & Admin
- `POST /alert/:alertId/resolve`
- `POST /admin/vehicle/provision`
- `POST /admin/vehicle/revoke`
- `GET /admin/vehicles/auth-status`
- `GET /admin/vehicle/:vehicleVin/rate-stats`
- `GET /admin/vehicles/top-requesters`
- `GET /admin/cache/stats`
- `DELETE /admin/cache/:pattern`
- `DELETE /admin/cache`

---

## Authentication

Vehicle telemetry ingestion requires a valid API key:

1. Provision API key via `/admin/vehicle/provision`
2. Include in headers:
   ```
   X-Vehicle-API-Key: veh_<vin>_<random>
   ```
3. Verified against SHA-256 hash in `vehicle_auth` table

---

## Rate Limiting

Redis-backed sliding window limiter per vehicle:

| Endpoint | Limit |
|----------|-------|
| `/telemetry/capture` | 5 requests / 10 seconds |
| `/telemetry/capture/batch` | 2 requests / minute |
| General endpoints | 10 requests / 30 seconds |

Logs are stored in `vehicle_request_logs`.

---

## Alert Engine

Alerts computed every 30 seconds:

- **Speed** > 80 km/h
- **Fuel** < 15%
- **Engine status** anomalies
- **Scheduled maintenance** reminders

Severity levels: `info`, `warning`, `critical`

---

## Caching Strategy

| Data | TTL |
|------|-----|
| Fleet Analytics | 5 minutes |
| Vehicle Telemetry | 10 minutes |
| Distance | 2 minutes |
| Alerts | 2 minutes |
| Vehicle List | 10 minutes |

---

## Testing

```bash
# Run all tests
npm test

# With coverage
npm run coverage

# Run specific pattern
npm test -- --testPathPattern=services
```

---

## Available Scripts

```bash
# Development
npm run dev              # Start with hot reload
npm run build           # Compile TypeScript
npm start               # Run production build

# Database
npm run init-db         # Initialize database schema
npm run check-db        # Verify database connection
npm run generate-data   # Generate test data

# Docker
npm run docker:up       # Start all services
npm run docker:down     # Stop all services  
npm run docker:logs     # View PostgreSQL logs

# Testing
npm test                # Run test suite
npm run coverage        # Test with coverage report
```

---

## Docker Deployment

```bash
# Build image
docker build -t motorq .

# Start complete stack
docker run motorq
```

---

## Environment Configuration

```env
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=mydb
DB_USER=user
DB_PASSWORD=password

# Redis
REDIS_URL=redis://localhost:6379

# Application  
PORT=5000
NODE_ENV=production
```

---

## Future Work

- WebSocket support for real-time telemetry streams
- Anomaly detection using machine learning
