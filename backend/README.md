# Backend API - Forum Dataset Collector

Backend API untuk Forum Dataset Collector dengan Express + TypeScript.

## 🚀 Features

- REST API untuk membaca datasets
- Collector API untuk mengumpulkan data dari forum
- CORS support
- TypeScript
- Ready untuk Railway deployment

## 📁 Struktur

```
backend/
├── src/
│   ├── server.ts      # Main server
│   └── collector.ts   # Forum data collector
├── datasets/          # Data storage (auto-created)
├── package.json
├── tsconfig.json
└── railway.json       # Railway config
```

## 🔧 Setup

```bash
npm install
cp .env.example .env
```

Edit `.env`:
```env
PORT=3000
NODE_ENV=development
CORS_ORIGIN=*
```

## 💻 Development

```bash
npm run dev
```

Server berjalan di `http://localhost:3000`

## 🏗️ Build

```bash
npm run build
npm start
```

## 📊 API Endpoints

### Data Endpoints

- `GET /api/health` - Health check
- `GET /api/conversations?limit=100&offset=0` - Get conversations
- `GET /api/agents` - Get agent profiles
- `GET /api/analysis` - Get analysis report

### Collector Endpoints

- `POST /api/collector/start` - Start continuous collection (every 1 min)
- `POST /api/collector/stop` - Stop collector
- `GET /api/collector/status` - Get collector status
- `POST /api/collector/collect-once` - Run collection once

## 🧪 Testing

```bash
# Health check
curl http://localhost:3000/api/health

# Get conversations
curl http://localhost:3000/api/conversations?limit=10

# Start collector
curl -X POST http://localhost:3000/api/collector/start

# Check status
curl http://localhost:3000/api/collector/status

# Stop collector
curl -X POST http://localhost:3000/api/collector/stop
```

## 🚂 Railway Deployment

1. Push ke GitHub
2. Connect repo ke Railway
3. Set Root Directory: `backend`
4. Add environment variables:
   - `PORT`: 3000
   - `NODE_ENV`: production
   - `CORS_ORIGIN`: your-frontend-url
5. Deploy!

Railway akan otomatis:
- Install dependencies
- Build TypeScript
- Start server

## 📝 Environment Variables

- `PORT` - Server port (default: 3000)
- `NODE_ENV` - Environment (development/production)
- `CORS_ORIGIN` - Allowed CORS origins (* untuk allow all)

## 🔄 Auto-Collection

Setelah start collector dengan `/api/collector/start`, backend akan:
1. Collect data immediately
2. Set interval untuk collect setiap 1 menit
3. Save ke `datasets/agent-conversations.jsonl`
4. Update stats real-time

## 📦 Dependencies

- `express` - Web framework
- `cors` - CORS middleware
- `axios` - HTTP client
- `dotenv` - Environment variables
- `typescript` - TypeScript support
