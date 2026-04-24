import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/src/lib/supabase';

export type BodyWeightLog = {
  id: string;
  user_id: string;
  weight_kg: number;
  logged_date: string;
  notes: string | null;
  created_at: string;
};

function localDateString(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function useBodyWeightLogs(userId: string | undefined, days = 30) {
  return useQuery({
    queryKey: ['body_weight_logs', userId, days],
    enabled: !!userId,
    queryFn: async () => {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - (days - 1));
      const { data, error } = await supabase
        .from('body_weight_logs')
        .select('*')
        .eq('user_id', userId!)
        .gte('logged_date', localDateString(cutoff))
        .order('logged_date', { ascending: true });
      if (error) throw error;
      return (data ?? []) as BodyWeightLog[];
    },
    staleTime: 1000 * 60 * 5,
  });
}

export function useLogBodyWeight() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { userId: string; weight_kg: number; notes?: string }) => {
      const today = localDateString();
      const { data, error } = await supabase
        .from('body_weight_logs')
        .upsert(
          { user_id: input.userId, weight_kg: input.weight_kg, logged_date: today, notes: input.notes ?? null },
          { onConflict: 'user_id,logged_date' }
        )
        .select()
        .single();
      if (error) throw error;
      return data as BodyWeightLog;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['body_weight_logs', v.userId] });
    },
  });
}

export function useDeleteBodyWeightLog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; userId: string }) => {
      const { error } = await supabase.from('body_weight_logs').delete().eq('id', input.id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['body_weight_logs', v.userId] });
    },
  });
}
