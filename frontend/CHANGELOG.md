# Frontend Changelog

## v2.0.0 - Simplified UI (Current)

### Changes
- ✅ **Removed Analytics Tab** - Simplified navigation
- ✅ **Removed Collector Control** - Backend manages data collection automatically
- ✅ **Simplified to 2 Tabs Only**:
  - **Dashboard**: Overview stats + Top 10 agents
  - **Conversations**: List of all conversations (posts & comments)

### Why These Changes?
- **User Feedback**: Analytics tab tidak bisa dibuka
- **Simplified UX**: User tidak perlu kontrol collector secara manual
- **Focus on Data**: Frontend hanya menampilkan data dari backend
- **Cleaner Interface**: Lebih mudah digunakan dan dipahami

### What's Included

#### Dashboard Tab
- 4 stat cards dengan animasi CountUp:
  - Total Entries
  - Posts
  - Comments
  - Unique Agents
- Top 10 Agents dengan:
  - Ranking badge
  - Message counts (posts + comments)
  - Pure Agent vs Human Control scores
  - Progress bars dengan animasi
  - Tags
  - SpotlightCard hover effect

#### Conversations Tab
- List semua conversations (posts & comments)
- Filter by type: All / Posts Only / Comments Only
- Sort by: Most Recent / Highest Pure Score / Highest Human Score
- Card untuk setiap conversation dengan:
  - Agent name
  - Content preview
  - Type badge (post/comment)
  - Scores (Pure Agent & Human Control)
  - Timestamp
  - Upvotes/Downvotes

### Features Retained
✅ Dark/Light theme toggle
✅ EN/ID language toggle
✅ Framer Motion animations
✅ React Bits components (ShinyText, SpotlightCard, CountUp)
✅ Material Symbols icons
✅ Responsive design
✅ Auto-refresh every 30 seconds
✅ Error handling with retry
✅ Loading states

### Removed Features
❌ Analytics tab (charts & graphs)
❌ Collector Control panel (start/stop/collect-once buttons)
❌ Collector status display

### Backend Integration
Frontend fetches data from backend API:
- `GET /api/agents` - List of agents
- `GET /api/analysis` - Overview statistics
- `GET /api/conversations?limit=50` - Recent conversations

Backend handles data collection automatically. No manual control needed from frontend.

### File Structure
```
frontend/src/
├── components/
│   ├── ui/
│   │   ├── CountUp.tsx
│   │   ├── ShinyText.tsx
│   │   └── SpotlightCard.tsx
│   ├── Dashboard.tsx        ✅ Active
│   ├── Conversations.tsx    ✅ Active
│   ├── Footer.tsx           ✅ Active
│   ├── Analytics.tsx        ⚠️ Not used (can be deleted)
│   └── CollectorControl.tsx ⚠️ Not used (can be deleted)
├── context/
│   ├── LanguageContext.tsx
│   └── ThemeContext.tsx
├── App.tsx                  ✅ Simplified
├── main.tsx
└── index.css
```

### How to Run
```bash
# Start backend first
cd backend
npm run dev

# Start frontend
cd frontend
npm run dev
```

Frontend akan buka di: http://localhost:5173
Backend API di: http://localhost:3000

### Environment Variables
```env
# frontend/.env
VITE_API_URL=http://localhost:3000
```

Untuk production (Railway):
```env
VITE_API_URL=https://your-backend.railway.app
```

### Next Steps
1. ✅ Frontend sudah disederhanakan
2. ✅ Hanya 2 tab: Dashboard & Conversations
3. ✅ Tidak ada kontrol collector
4. ✅ Frontend hanya display data dari backend

### Optional Cleanup
Jika ingin hapus file yang tidak dipakai:
```bash
cd frontend/src/components
rm Analytics.tsx
rm CollectorControl.tsx
```

Tapi tidak masalah jika dibiarkan, tidak akan mempengaruhi aplikasi.
