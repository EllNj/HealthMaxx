export type MuscleGroup =
  | 'chest'
  | 'back'
  | 'legs'
  | 'shoulders'
  | 'biceps'
  | 'triceps'
  | 'core'
  | 'cardio'
  | 'forearms';

export type Equipment =
  | 'barbell'
  | 'dumbbell'
  | 'machine'
  | 'cable'
  | 'bodyweight'
  | 'other';

export type DisplayUnit = 'kg' | 'lbs';

export type Exercise = {
  id: string;
  name: string;
  muscle_group: MuscleGroup | null;
  equipment: Equipment | null;
  display_unit: DisplayUnit;
  is_system: boolean;
  user_id: string | null;
  created_at: string;
};

export const MUSCLE_GROUPS: MuscleGroup[] = [
  'chest',
  'back',
  'legs',
  'shoulders',
  'biceps',
  'triceps',
  'core',
  'forearms',
  'cardio',
];

export const EQUIPMENT: Equipment[] = [
  'barbell',
  'dumbbell',
  'machine',
  'cable',
  'bodyweight',
  'other',
];

export type WorkoutTemplate = {
  id: string;
  user_id: string;
  name: string;
  order_index: number;
  created_at: string;
};

export type TemplateExercise = {
  id: string;
  template_id: string;
  exercise_id: string;
  order_index: number;
  target_sets: number;
  rest_seconds: number;
  notes: string | null;
};

export type TemplateExerciseWithExercise = TemplateExercise & {
  exercise: Exercise;
};

export type TemplateWithCounts = WorkoutTemplate & {
  exercise_count: number;
};
