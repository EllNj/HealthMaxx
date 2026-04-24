import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/src/lib/supabase';
import type { Exercise } from './types';
import type { WorkoutSession, WorkoutSet } from './types.session';

export function useSession(id: string | undefined) {
  return useQuery({
    queryKey: ['workout_session', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('workout_sessions')
        .select('*')
        .eq('id', id!)
        .single();
      if (error) throw error;
      return data as WorkoutSession;
    },
  });
}

export type SessionExerciseBlock = {
  exercise: Exercise;
  template_exercise_id: string | null;
  target_sets: number;
  rest_seconds: number;
  notes: string | null;
  order_index: number;
};

export function useSessionBlocks(session: WorkoutSession | undefined) {
  return useQuery({
    queryKey: ['session_blocks', session?.id, session?.template_id],
    enabled: !!session,
    queryFn: async () => {
      if (!session) return [];
      const blocks: SessionExerciseBlock[] = [];

      if (session.template_id) {
        const { data, error } = await supabase
          .from('template_exercises')
          .select('*, exercise:exercises(*)')
          .eq('template_id', session.template_id)
          .order('order_index', { ascending: true });
        if (error) throw error;
        for (const t of (data ?? []) as any[]) {
          blocks.push({
            exercise: t.exercise as Exercise,
            template_exercise_id: t.id,
            target_sets: t.target_sets,
            rest_seconds: t.rest_seconds,
            notes: t.notes,
            order_index: t.order_index,
          });
        }
      }

      const { data: sets, error: e2 } = await supabase
        .from('workout_sets')
        .select('exercise_id, exercise:exercises(*)')
        .eq('session_id', session.id);
      if (e2) throw e2;

      const seen = new Set(blocks.map((b) => b.exercise.id));
      for (const s of (sets ?? []) as any[]) {
        if (!seen.has(s.exercise_id)) {
          seen.add(s.exercise_id);
          blocks.push({
            exercise: s.exercise as Exercise,
            template_exercise_id: null,
            target_sets: 3,
            rest_seconds: 90,
            notes: null,
            order_index: blocks.length,
          });
        }
      }

      return blocks;
    },
  });
}

export function useSessionSets(sessionId: string | undefined) {
  return useQuery({
    queryKey: ['session_sets', sessionId],
    enabled: !!sessionId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('workout_sets')
        .select('*')
        .eq('session_id', sessionId!)
        .order('completed_at', { ascending: true });
      if (error) throw error;
      return (data ?? []) as WorkoutSet[];
    },
  });
}

export function useStartSessionFromTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      user_id: string;
      template_id: string;
      template_name: string;
    }) => {
      const { data, error } = await supabase
        .from('workout_sessions')
        .insert({
          user_id: input.user_id,
          template_id: input.template_id,
          name: input.template_name,
        })
        .select()
        .single();
      if (error) throw error;
      return data as WorkoutSession;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['workout_sessions'] });
      qc.invalidateQueries({ queryKey: ['active_session'] });
    },
  });
}

export function useStartEmptySession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { user_id: string; name?: string }) => {
      const { data, error } = await supabase
        .from('workout_sessions')
        .insert({ user_id: input.user_id, name: input.name ?? 'Empty workout' })
        .select()
        .single();
      if (error) throw error;
      return data as WorkoutSession;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['workout_sessions'] });
      qc.invalidateQueries({ queryKey: ['active_session'] });
    },
  });
}

export function useActiveSession(userId: string | undefined) {
  return useQuery({
    queryKey: ['active_session', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('workout_sessions')
        .select('*')
        .eq('user_id', userId!)
        .is('ended_at', null)
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as WorkoutSession | null;
    },
  });
}

export function useLogSet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      session_id: string;
      exercise_id: string;
      set_number: number;
      reps: number;
      weight_kg: number;
      is_warmup?: boolean;
    }) => {
      const { data, error } = await supabase
        .from('workout_sets')
        .insert({
          session_id: input.session_id,
          exercise_id: input.exercise_id,
          set_number: input.set_number,
          reps: input.reps,
          weight_kg: input.weight_kg,
          is_warmup: input.is_warmup ?? false,
        })
        .select()
        .single();
      if (error) throw error;
      return data as WorkoutSet;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['session_sets', v.session_id] });
    },
  });
}

export function useUpdateSet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      session_id: string;
      reps?: number;
      weight_kg?: number;
    }) => {
      const patch: Record<string, unknown> = {};
      if (input.reps !== undefined) patch.reps = input.reps;
      if (input.weight_kg !== undefined) patch.weight_kg = input.weight_kg;
      const { error } = await supabase.from('workout_sets').update(patch).eq('id', input.id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['session_sets', v.session_id] });
    },
  });
}

export function useDeleteSet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; session_id: string }) => {
      const { error } = await supabase.from('workout_sets').delete().eq('id', input.id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['session_sets', v.session_id] });
    },
  });
}

export function useFinishSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('workout_sessions')
        .update({ ended_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_d, id) => {
      qc.invalidateQueries({ queryKey: ['workout_session', id] });
      qc.invalidateQueries({ queryKey: ['workout_sessions'] });
      qc.invalidateQueries({ queryKey: ['active_session'] });
    },
  });
}

export function useAbandonSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('workout_sessions').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['workout_sessions'] });
      qc.invalidateQueries({ queryKey: ['active_session'] });
    },
  });
}

export type SessionSummary = WorkoutSession & {
  set_count: number;
  exercise_count: number;
  total_volume_kg: number;
};

export function useSessionHistory(userId: string | undefined, limit = 20) {
  return useQuery({
    queryKey: ['session_history', userId, limit],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('workout_sessions')
        .select('*')
        .eq('user_id', userId!)
        .not('ended_at', 'is', null)
        .order('started_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      const sessions = (data ?? []) as WorkoutSession[];
      if (sessions.length === 0) return [] as SessionSummary[];

      const ids = sessions.map((s) => s.id);
      const { data: sets, error: e2 } = await supabase
        .from('workout_sets')
        .select('session_id, exercise_id, weight_kg, reps')
        .in('session_id', ids);
      if (e2) throw e2;

      const bySession = new Map<string, { session_id: string; exercise_id: string; weight_kg: number | null; reps: number | null }[]>();
      for (const s of (sets ?? []) as any[]) {
        if (!bySession.has(s.session_id)) bySession.set(s.session_id, []);
        bySession.get(s.session_id)!.push(s);
      }

      return sessions.map((s) => {
        const rows = bySession.get(s.id) ?? [];
        const exercises = new Set(rows.map((r) => r.exercise_id));
        const volume = rows.reduce((acc, r) => acc + (r.weight_kg ?? 0) * (r.reps ?? 0), 0);
        return {
          ...s,
          set_count: rows.length,
          exercise_count: exercises.size,
          total_volume_kg: volume,
        } as SessionSummary;
      });
    },
    staleTime: 1000 * 60 * 2,
  });
}

export type DailyVolume = {
  label: string;
  volume: number;
};

export function useWeeklyVolume(userId: string | undefined) {
  return useQuery({
    queryKey: ['weekly_volume', userId],
    enabled: !!userId,
    queryFn: async () => {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
      sevenDaysAgo.setHours(0, 0, 0, 0);

      const { data: sessions, error } = await supabase
        .from('workout_sessions')
        .select('id, started_at')
        .eq('user_id', userId!)
        .not('ended_at', 'is', null)
        .gte('started_at', sevenDaysAgo.toISOString());
      if (error) throw error;

      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const toDateKey = (d: Date) =>
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

      const volumeByDate = new Map<string, number>();

      if (sessions && sessions.length > 0) {
        const ids = sessions.map((s) => s.id);
        const sessionDate = new Map<string, string>();
        for (const s of sessions) sessionDate.set(s.id, toDateKey(new Date(s.started_at)));

        const { data: sets, error: e2 } = await supabase
          .from('workout_sets')
          .select('session_id, weight_kg, reps')
          .in('session_id', ids);
        if (e2) throw e2;

        for (const set of (sets ?? []) as any[]) {
          const date = sessionDate.get(set.session_id);
          if (!date) continue;
          volumeByDate.set(date, (volumeByDate.get(date) ?? 0) + (set.weight_kg ?? 0) * (set.reps ?? 0));
        }
      }

      const days: DailyVolume[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        days.push({
          label: i === 0 ? 'Today' : dayNames[d.getDay()],
          volume: Math.round(volumeByDate.get(toDateKey(d)) ?? 0),
        });
      }
      return days;
    },
    staleTime: 1000 * 60 * 5,
  });
}

export function useSessionDetail(sessionId: string | undefined) {
  return useQuery({
    queryKey: ['session_detail', sessionId],
    enabled: !!sessionId,
    queryFn: async () => {
      const { data: session, error: e1 } = await supabase
        .from('workout_sessions')
        .select('*')
        .eq('id', sessionId!)
        .single();
      if (e1) throw e1;

      const { data: sets, error: e2 } = await supabase
        .from('workout_sets')
        .select('*, exercise:exercises(id, name, display_unit)')
        .eq('session_id', sessionId!)
        .order('set_number', { ascending: true });
      if (e2) throw e2;

      type SetWithExercise = WorkoutSet & {
        exercise: { id: string; name: string; display_unit: 'kg' | 'lbs' };
      };
      const rows = (sets ?? []) as SetWithExercise[];

      const exerciseMap = new Map<
        string,
        { id: string; name: string; display_unit: 'kg' | 'lbs'; sets: SetWithExercise[] }
      >();
      for (const row of rows) {
        if (!exerciseMap.has(row.exercise_id)) {
          exerciseMap.set(row.exercise_id, { ...row.exercise, sets: [] });
        }
        exerciseMap.get(row.exercise_id)!.sets.push(row);
      }

      return {
        session: session as WorkoutSession,
        exercises: Array.from(exerciseMap.values()),
      };
    },
  });
}
