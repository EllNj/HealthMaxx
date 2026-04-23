import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/src/lib/supabase';
import type { WorkoutSet } from './types.session';

export type LastPerformance = {
  session_id: string;
  session_date: string;
  sets: WorkoutSet[];
};

export function useLastPerformance(
  exerciseId: string | undefined,
  excludeSessionId: string | undefined
) {
  return useQuery({
    queryKey: ['last_performance', exerciseId, excludeSessionId],
    enabled: !!exerciseId,
    queryFn: async (): Promise<LastPerformance | null> => {
      if (!exerciseId) return null;

      let q = supabase
        .from('workout_sets')
        .select('session_id, completed_at')
        .eq('exercise_id', exerciseId)
        .order('completed_at', { ascending: false })
        .limit(1);
      if (excludeSessionId) q = q.neq('session_id', excludeSessionId);

      const { data: latest, error: e1 } = await q.maybeSingle();
      if (e1) throw e1;
      if (!latest) return null;

      const { data: sets, error: e2 } = await supabase
        .from('workout_sets')
        .select('*')
        .eq('session_id', latest.session_id)
        .eq('exercise_id', exerciseId)
        .order('set_number', { ascending: true });
      if (e2) throw e2;

      return {
        session_id: latest.session_id,
        session_date: latest.completed_at,
        sets: (sets ?? []) as WorkoutSet[],
      };
    },
    staleTime: 1000 * 60 * 5,
  });
}
