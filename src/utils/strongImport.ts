import Papa from 'papaparse';

import { supabase } from '@/src/lib/supabase';

// Strong CSV columns (as of Strong v7 export):
// Date, Workout Name, Duration, Exercise Name, Set Order, Weight, Weight Unit, Reps, RPE, Notes, Workout Notes, Workout Duration
type StrongRow = {
  Date: string;
  'Workout Name': string;
  'Exercise Name': string;
  'Set Order': string;
  Weight: string;
  'Weight Unit': string;
  Reps: string;
  RPE?: string;
  Notes?: string;
  'Workout Notes'?: string;
  Duration?: string;
};

export type ImportResult = {
  sessions: number;
  sets: number;
  newExercises: number;
  skippedRows: number;
};

type SessionGroup = {
  date: string;
  workoutName: string;
  rows: StrongRow[];
};

export async function importStrongCsv(
  csvText: string,
  userId: string,
  onProgress?: (pct: number) => void
): Promise<ImportResult> {
  const parsed = Papa.parse<StrongRow>(csvText.trim(), {
    header: true,
    skipEmptyLines: true,
  });

  const rows = parsed.data as StrongRow[];
  if (rows.length === 0) throw new Error('CSV appears empty or unrecognised format.');

  // Group rows into sessions by (Date, Workout Name)
  const sessionMap = new Map<string, SessionGroup>();
  let skippedRows = 0;

  for (const row of rows) {
    const date = row['Date']?.trim();
    const workoutName = row['Workout Name']?.trim();
    const exerciseName = row['Exercise Name']?.trim();
    if (!date || !workoutName || !exerciseName) { skippedRows++; continue; }
    const key = `${date}||${workoutName}`;
    if (!sessionMap.has(key)) sessionMap.set(key, { date, workoutName, rows: [] });
    sessionMap.get(key)!.rows.push(row);
  }

  if (sessionMap.size === 0) throw new Error('No valid sessions found in the CSV.');

  // Collect all unique exercise names
  const exerciseNames = new Set<string>();
  for (const g of sessionMap.values()) {
    for (const r of g.rows) exerciseNames.add(r['Exercise Name'].trim());
  }

  // Fetch existing exercises (system + user's own)
  const { data: existing, error: exErr } = await supabase
    .from('exercises')
    .select('id, name, display_unit')
    .or(`is_system.eq.true,user_id.eq.${userId}`);
  if (exErr) throw exErr;

  // Build name → id map (case-insensitive)
  const exerciseIdMap = new Map<string, { id: string; display_unit: string }>();
  for (const ex of existing ?? []) {
    exerciseIdMap.set(ex.name.toLowerCase(), { id: ex.id, display_unit: ex.display_unit });
  }

  // Create missing exercises
  const toCreate = [...exerciseNames].filter((n) => !exerciseIdMap.has(n.toLowerCase()));
  let newExercises = 0;

  for (const name of toCreate) {
    const { data: created, error: cErr } = await supabase
      .from('exercises')
      .insert({ name, user_id: userId, is_system: false, display_unit: 'kg' })
      .select('id, display_unit')
      .single();
    if (cErr) throw cErr;
    exerciseIdMap.set(name.toLowerCase(), { id: created.id, display_unit: created.display_unit });
    newExercises++;
  }

  const sessionGroups = Array.from(sessionMap.values());
  let totalSets = 0;
  let sessionsInserted = 0;

  for (let i = 0; i < sessionGroups.length; i++) {
    const g = sessionGroups[i];
    onProgress?.(Math.round((i / sessionGroups.length) * 100));

    // Parse started_at from "YYYY-MM-DD HH:MM:SS" or "YYYY-MM-DD"
    const startedAt = parseStrongDate(g.date);

    // Strong's per-row "Duration" column is set duration (e.g. plank seconds), not workout
    // duration — don't use it. Fall back to 1h so ended_at is always set.
    const endedAt = new Date(startedAt.getTime() + 60 * 60 * 1000).toISOString();

    // Check if session already imported (by user_id + started_at)
    const { data: dup } = await supabase
      .from('workout_sessions')
      .select('id')
      .eq('user_id', userId)
      .eq('started_at', startedAt.toISOString())
      .maybeSingle();
    if (dup) continue; // skip duplicate

    const { data: session, error: sErr } = await supabase
      .from('workout_sessions')
      .insert({
        user_id: userId,
        name: g.workoutName,
        started_at: startedAt.toISOString(),
        ended_at: endedAt,
      })
      .select('id')
      .single();
    if (sErr) throw sErr;
    sessionsInserted++;

    const setsToInsert: object[] = [];
    for (const row of g.rows) {
      const exName = row['Exercise Name'].trim();
      const exInfo = exerciseIdMap.get(exName.toLowerCase());
      if (!exInfo) { skippedRows++; continue; }

      const setNumber = parseInt(row['Set Order'], 10);
      if (!Number.isFinite(setNumber)) { skippedRows++; continue; }

      const rawWeight = parseFloat(row['Weight']);
      const unit = (row['Weight Unit'] ?? 'kg').toLowerCase().trim();
      const weightKg = Number.isFinite(rawWeight)
        ? unit === 'lbs'
          ? Math.round((rawWeight / 2.20462) * 1000) / 1000
          : rawWeight
        : 0;

      const reps = parseInt(row['Reps'], 10);
      if (!Number.isFinite(reps)) { skippedRows++; continue; }

      const rpe = row['RPE'] ? parseFloat(row['RPE']) : null;

      setsToInsert.push({
        session_id: session.id,
        exercise_id: exInfo.id,
        set_number: setNumber,
        reps,
        weight_kg: weightKg,
        rpe: Number.isFinite(rpe ?? NaN) ? rpe : null,
        is_warmup: false,
        completed_at: startedAt.toISOString(),
      });
    }

    if (setsToInsert.length > 0) {
      const { error: setErr } = await supabase.from('workout_sets').insert(setsToInsert);
      if (setErr) throw setErr;
      totalSets += setsToInsert.length;
    }
  }

  onProgress?.(100);

  return {
    sessions: sessionsInserted,
    sets: totalSets,
    newExercises,
    skippedRows,
  };
}

function parseStrongDate(raw: string): Date {
  // "2024-01-15 07:30:00" or "2024-01-15"
  const s = raw.trim().replace(' ', 'T');
  const d = new Date(s.includes('T') ? s : `${s}T08:00:00`);
  return isNaN(d.getTime()) ? new Date() : d;
}

function parseDuration(raw: string | undefined): number | null {
  if (!raw) return null;
  // Strong exports duration as seconds integer or "1h 30m" style
  const asInt = parseInt(raw, 10);
  if (Number.isFinite(asInt) && asInt > 0) return asInt;
  const match = raw.match(/(?:(\d+)h)?\s*(?:(\d+)m)?/);
  if (!match) return null;
  const h = parseInt(match[1] ?? '0', 10);
  const m = parseInt(match[2] ?? '0', 10);
  const total = h * 3600 + m * 60;
  return total > 0 ? total : null;
}
