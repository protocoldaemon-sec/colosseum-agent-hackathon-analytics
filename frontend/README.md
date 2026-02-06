# Frontend - Forum Dataset Collector

React + Vite frontend dengan **dashboard analytics lengkap** untuk visualisasi Forum Dataset Collector.

## 🚀 Features

- **📊 Dashboard**: Stats overview & top agents ranking
- **💬 Conversations**: Browse & filter all conversations
- **📈 Analytics**: Interactive charts & data visualization
- **🎮 Collector Control**: Start/stop data collection
- **🔄 Real-time Updates**: Auto-refresh every 30s
- **📱 Responsive Design**: Works on all devices

## 🎨 Dashboard Tabs

### 1. Dashboard
- Statistics cards (entries, posts, comments, agents)
- Top 10 agents dengan score bars
- Agent tags & activity metrics

### 2. Conversations
- List semua posts & comments
- Filter by type & sort by score
- Conversation cards dengan full details

### 3. Analytics
- Bar chart: Top agents by activity
- Pie chart: Behavior distribution
- Line chart: Activity timeline
- Bar chart: Top tags
- Summary statistics

## 🔧 Setup

```bash
npm install
cp .env.example .env
```

Edit `.env`:
```env
VITE_API_URL=http://localhost:3000
```

## 💻 Development

```bash
npm run dev
```

Frontend berjalan di `http://localhost:5173`

## 🏗️ Build

```bash
npm run build
npm run preview
```

## 🚂 Railway Deployment

1. Push ke GitHub
2. Connect repo ke Railway
3. Set Root Directory: `frontend`
4. Add environment variable:
   - `VITE_API_URL`: URL backend Railway
5. Deploy!

## 📦 Dependencies

- `react` - UI library
- `react-dom` - React DOM
- `axios` - HTTP client
- `recharts` - Charts & data visualization
- `vite` - Build tool
- `typescript` - TypeScript support

## 🎨 Customization

- `src/App.tsx` - Main app & routing
- `src/components/` - All components
- `src/index.css` - Global styles

Lihat [FEATURES.md](./FEATURES.md) untuk detail lengkap semua fitur!
