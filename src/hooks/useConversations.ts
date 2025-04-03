import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export function useConversations() {
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const user = supabase.auth.user();
    if (!user) return;

    // Fetch initial conversations
    fetchConversations();

    // Subscribe to new conversations
    const subscription = supabase
      .from('conversations')
      .on('*', () => {
        fetchConversations();
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  async function fetchConversations() {
    try {
      const { data, error: fetchError } = await supabase
        .from('conversations')
        .select(`
          *,
          initiator:profiles!initiator_id(*),
          receiver:profiles!receiver_id(*),
          messages(
            id,
            content,
            created_at,
            sender_id
          )
        `)
        .or(`initiator_id.eq.${supabase.auth.user()?.id},receiver_id.eq.${supabase.auth.user()?.id}`)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;
      setConversations(data || []);
      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setLoading(false);
    }
  }

  return { conversations, loading, error };
}