import { useEffect, useState } from 'react';
import { createClient, RealtimeChannel } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Hook for real-time metrics
export function useRealtimeMetrics(metricType: string) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let channel: RealtimeChannel | null = null;

    const fetchInitial = async () => {
      try {
        const { data: metric, error: fetchError } = await supabase
          .from('realtime_metrics')
          .select('value, updated_at')
          .eq('metric_type', metricType)
          .single();

        if (fetchError) throw fetchError;

        if (metric) {
          setData(metric.value);
          setLoading(false);
        }
      } catch (err: any) {
        console.error(`Error fetching ${metricType}:`, err);
        setError(err.message);
        setLoading(false);
      }
    };

    fetchInitial();

    // Subscribe to real-time updates
    channel = supabase
      .channel(`metric-${metricType}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'realtime_metrics',
          filter: `metric_type=eq.${metricType}`
        },
        (payload) => {
          console.log(`📊 ${metricType} updated!`, payload.new);
          setData(payload.new.value);
        }
      )
      .subscribe();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [metricType]);

  return { data, loading, error };
}

// Hook for suspicious patterns
export function useSuspiciousPatterns() {
  const [patterns, setPatterns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let channel: RealtimeChannel | null = null;

    const fetchInitial = async () => {
      try {
        const { data, error } = await supabase
          .from('suspicious_patterns')
          .select('*')
          .eq('status', 'active')
          .order('detected_at', { ascending: false })
          .limit(10);

        if (error) throw error;

        if (data) {
          setPatterns(data);
          setLoading(false);
        }
      } catch (err) {
        console.error('Error fetching suspicious patterns:', err);
        setLoading(false);
      }
    };

    fetchInitial();

    // Subscribe to new patterns
    channel = supabase
      .channel('suspicious-patterns')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'suspicious_patterns'
        },
        (payload) => {
          console.log('🚨 New suspicious pattern detected!', payload.new);
          setPatterns((prev) => [payload.new, ...prev]);

          // Show browser notification
          if (Notification.permission === 'granted') {
            new Notification('Suspicious Pattern Detected!', {
              body: payload.new.description,
              icon: '/logo_white_transparent.png'
            });
          }
        }
      )
      .subscribe();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, []);

  return { patterns, loading };
}

// Hook for network graph
export function useNetworkGraph(minStrength: number = 3) {
  const [graph, setGraph] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let channel: RealtimeChannel | null = null;

    const fetchGraph = async () => {
      try {
        const { data, error } = await supabase
          .from('agent_interactions')
          .select('*')
          .gte('strength', minStrength)
          .order('strength', { ascending: false })
          .limit(100);

        if (error) throw error;

        if (data) {
          // Transform to graph format
          const nodes = new Set<number>();
          const edges: any[] = [];

          data.forEach((interaction) => {
            nodes.add(interaction.source_agent_id);
            nodes.add(interaction.target_agent_id);
            edges.push({
              source: interaction.source_agent_id,
              target: interaction.target_agent_id,
              weight: interaction.strength,
              type: interaction.interaction_type
            });
          });

          setGraph({
            nodes: Array.from(nodes).map((id) => ({ id })),
            edges,
            lastUpdate: new Date().toISOString()
          });
          setLoading(false);
        }
      } catch (err) {
        console.error('Error fetching network graph:', err);
        setLoading(false);
      }
    };

    fetchGraph();

    // Subscribe to updates
    channel = supabase
      .channel('network-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'agent_interactions'
        },
        () => {
          // Refetch on any change
          fetchGraph();
        }
      )
      .subscribe();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [minStrength]);

  return { graph, loading };
}

// Hook for agent growth tracking
export function useAgentGrowth() {
  const [growth, setGrowth] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let channel: RealtimeChannel | null = null;

    const fetchGrowth = async () => {
      try {
        const { data, error } = await supabase
          .from('agent_growth_tracking')
          .select('*')
          .order('date', { ascending: false })
          .limit(30);

        if (error) throw error;

        if (data) {
          setGrowth(data);
          setLoading(false);
        }
      } catch (err) {
        console.error('Error fetching growth data:', err);
        setLoading(false);
      }
    };

    fetchGrowth();

    // Subscribe to updates
    channel = supabase
      .channel('growth-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'agent_growth_tracking'
        },
        () => {
          fetchGrowth();
        }
      )
      .subscribe();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, []);

  return { growth, loading };
}

// Request notification permission
export function requestNotificationPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
}
