export type WorkoutSession = {
  id: string;
  user_id: string;
  template_id: string | null;
  name: string | null;
  started_at: string;
  ended_at: string | null;
  notes: string | null;
};

export type WorkoutSet = {
  id: string;
  session_id: string;
  exercise_id: string;
  set_number: number;
  reps: number | null;
  weight_kg: number | null;
  rpe: number | null;
  is_warmup: boolean;
  completed_at: string;
};
