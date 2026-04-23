import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/src/lib/supabase';

export type ProgressPoint = {
  date: string; // ISO date string
  dateMs: number;
  maxWeightKg: number;
  est1rmKg: number;
  totalVolume: number;
  setCount: number;
};

export type ExercisePR = {
  maxWeightKg: number;
  maxEst1rmKg: number;
  maxReps: number;
  date: string;
};

export type ExerciseProgressData = {
  points: ProgressPoint[];
  pr: ExercisePR | null;
};

export function useExerciseProgress(
  exerciseId: string | undefined,
  userId: string | undefined
) {
  return useQuery({
    queryKey: ['exercise_progress', exerciseId, userId],
    enabled: !!exerciseId && !!userId,
    queryFn: async (): Promise<ExerciseProgressData> => {
      // Fetch all non-warmup sets for this exercise, joined with session for user filter + date
      const { data, error } = await supabase
        .from('workout_sets')
        .select('weight_kg, reps, is_warmup, completed_at, session:workout_sessions!inner(user_id, started_at, ended_at)')
        .eq('exercise_id', exerciseId!)
        .eq('session.user_id', userId!)
        .not('session.ended_at', 'is', null)
        .order('completed_at', { ascending: true });

      if (error) throw error;

      const rows = (data ?? []) as {
        weight_kg: number | null;
        reps: number | null;
        is_warmup: boolean;
        completed_at: string;
        session: { user_id: string; started_at: string; ended_at: string | null };
      }[];

      if (rows.length === 0) return { points: [], pr: null };

      // Group by session date (day of started_at)
      const byDay = new Map<string, typeof rows>();
      for (const row of rows) {
        if (row.is_warmup) continue;
        const day = row.session.started_at.slice(0, 10);
        if (!byDay.has(day)) byDay.set(day, []);
        byDay.get(day)!.push(row);
      }

      const points: ProgressPoint[] = [];
      for (const [date, dayRows] of Array.from(byDay.entries()).sort()) {
        let maxWeight = 0;
        let maxEst1rm = 0;
        let totalVol = 0;

        for (const r of dayRows) {
          const w = r.weight_kg ?? 0;
          const reps = r.reps ?? 0;
          if (w > maxWeight) maxWeight = w;
          const est = reps > 0 ? w * (1 + reps / 30) : w;
          if (est > maxEst1rm) maxEst1rm = est;
          totalVol += w * reps;
        }

        points.push({
          date,
          dateMs: new Date(date).getTime(),
          maxWeightKg: Math.round(maxWeight * 10) / 10,
          est1rmKg: Math.round(maxEst1rm * 10) / 10,
          totalVolume: Math.round(totalVol),
          setCount: dayRows.length,
        });
      }

      // Overall PRs
      const allWorking = rows.filter((r) => !r.is_warmup);
      const pr: ExercisePR | null =
        allWorking.length === 0
          ? null
          : {
              maxWeightKg: Math.max(...allWorking.map((r) => r.weight_kg ?? 0)),
              maxEst1rmKg: Math.round(
                Math.max(
                  ...allWorking.map((r) =>
                    (r.weight_kg ?? 0) * (1 + (r.reps ?? 0) / 30)
                  )
                ) * 10
              ) / 10,
              maxReps: Math.max(...allWorking.map((r) => r.reps ?? 0)),
              date: allWorking[allWorking.length - 1].completed_at.slice(0, 10),
            };

      return { points, pr };
    },
    staleTime: 1000 * 60 * 5,
  });
}
