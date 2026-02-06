import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type Language = 'en' | 'id';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const translations = {
  en: {
    // Navbar
    'nav.title': 'Colosseum Agent Hackathon',
    'nav.subtitle': 'Agent Activity Analytics',
    'nav.dashboard': 'Dashboard',
    'nav.conversations': 'Conversations',
    'nav.analytics': 'Analytics',
    
    // Collector Control
    'collector.running': 'Collector Running',
    'collector.stopped': 'Collector Stopped',
    'collector.entries': 'entries',
    'collector.posts': 'posts',
    'collector.comments': 'comments',
    'collector.start': 'Start Collector',
    'collector.stop': 'Stop Collector',
    'collector.collectOnce': 'Collect Once',
    
    // Dashboard
    'dashboard.totalEntries': 'Total Entries',
    'dashboard.posts': 'Posts',
    'dashboard.comments': 'Comments',
    'dashboard.uniqueAgents': 'Unique Agents',
    'dashboard.topAgents': 'Top Agents',
    'dashboard.messages': 'Messages',
    'dashboard.pureAgent': 'Pure Agent',
    'dashboard.humanControl': 'Human Control',
    
    // Conversations
    'conversations.title': 'Conversations',
    'conversations.all': 'All',
    'conversations.postsOnly': 'Posts Only',
    'conversations.commentsOnly': 'Comments Only',
    'conversations.mostRecent': 'Most Recent',
    'conversations.highestPure': 'Highest Pure Score',
    'conversations.highestHuman': 'Highest Human Score',
    'conversations.post': 'post',
    'conversations.comment': 'comment',
    'conversations.pure': 'Pure',
    'conversations.human': 'Human',
    
    // Analytics
    'analytics.title': 'Analytics Dashboard',
    'analytics.topAgentsByActivity': 'Top 10 Agents by Activity',
    'analytics.behaviorDistribution': 'Agent Behavior Distribution',
    'analytics.activityTimeline': 'Activity Timeline (Last 7 Days)',
    'analytics.topTags': 'Top Tags',
    'analytics.summaryStats': 'Summary Statistics',
    'analytics.avgPureScore': 'Avg Pure Score',
    'analytics.avgHumanScore': 'Avg Human Score',
    'analytics.mostActiveAgent': 'Most Active Agent',
    'analytics.avgMessagesPerAgent': 'Avg Messages/Agent',
    
    // Footer
    'footer.note': 'NOTE',
    'footer.disclaimer': 'This project is not sponsored or affiliated with anyone and does not generate any profit. Created solely as a contribution to the community.',
    'footer.builtBy': 'Built by',
    'footer.poweredBy': 'Powered by',
    'footer.hackathon': 'Colosseum Agent Hackathon',
    
    // Loading
    'loading.text': 'Loading analytics...',
  },
  id: {
    // Navbar
    'nav.title': 'Colosseum Agent Hackathon',
    'nav.subtitle': 'Analitik Aktivitas Agent',
    'nav.dashboard': 'Dasbor',
    'nav.conversations': 'Percakapan',
    'nav.analytics': 'Analitik',
    
    // Collector Control
    'collector.running': 'Kolektor Berjalan',
    'collector.stopped': 'Kolektor Berhenti',
    'collector.entries': 'entri',
    'collector.posts': 'postingan',
    'collector.comments': 'komentar',
    'collector.start': 'Mulai Kolektor',
    'collector.stop': 'Hentikan Kolektor',
    'collector.collectOnce': 'Kumpulkan Sekali',
    
    // Dashboard
    'dashboard.totalEntries': 'Total Entri',
    'dashboard.posts': 'Postingan',
    'dashboard.comments': 'Komentar',
    'dashboard.uniqueAgents': 'Agent Unik',
    'dashboard.topAgents': 'Agent Teratas',
    'dashboard.messages': 'Pesan',
    'dashboard.pureAgent': 'Agent Murni',
    'dashboard.humanControl': 'Kontrol Manusia',
    
    // Conversations
    'conversations.title': 'Percakapan',
    'conversations.all': 'Semua',
    'conversations.postsOnly': 'Hanya Postingan',
    'conversations.commentsOnly': 'Hanya Komentar',
    'conversations.mostRecent': 'Terbaru',
    'conversations.highestPure': 'Skor Murni Tertinggi',
    'conversations.highestHuman': 'Skor Manusia Tertinggi',
    'conversations.post': 'postingan',
    'conversations.comment': 'komentar',
    'conversations.pure': 'Murni',
    'conversations.human': 'Manusia',
    
    // Analytics
    'analytics.title': 'Dasbor Analitik',
    'analytics.topAgentsByActivity': '10 Agent Teratas berdasarkan Aktivitas',
    'analytics.behaviorDistribution': 'Distribusi Perilaku Agent',
    'analytics.activityTimeline': 'Timeline Aktivitas (7 Hari Terakhir)',
    'analytics.topTags': 'Tag Teratas',
    'analytics.summaryStats': 'Statistik Ringkasan',
    'analytics.avgPureScore': 'Rata-rata Skor Murni',
    'analytics.avgHumanScore': 'Rata-rata Skor Manusia',
    'analytics.mostActiveAgent': 'Agent Paling Aktif',
    'analytics.avgMessagesPerAgent': 'Rata-rata Pesan/Agent',
    
    // Footer
    'footer.note': 'CATATAN',
    'footer.disclaimer': 'Proyek ini tidak disponsori atau berafiliasi dengan siapapun dan tidak mengambil keuntungan apapun. Dibuat semata-mata sebagai kontribusi untuk komunitas.',
    'footer.builtBy': 'Dibuat oleh',
    'footer.poweredBy': 'Didukung oleh',
    'footer.hackathon': 'Colosseum Agent Hackathon',
    
    // Loading
    'loading.text': 'Memuat analitik...',
  }
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem('language');
    return (saved as Language) || 'en';
  });

  useEffect(() => {
    localStorage.setItem('language', language);
  }, [language]);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
  };

  const t = (key: string): string => {
    return translations[language][key as keyof typeof translations.en] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }
  return context;
}
