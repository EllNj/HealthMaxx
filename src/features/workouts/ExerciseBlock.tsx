import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';

import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Colors } from '@/constants/theme';
import { displayToKg, formatWeight, kgToDisplay } from '@/src/utils/units';
import type { SessionExerciseBlock } from './useSessions';
import { useDeleteSet, useLogSet } from './useSessions';
import { useLastPerformance } from './useLastPerformance';
import type { WorkoutSet } from './types.session';

type Props = {
  block: SessionExerciseBlock;
  sessionId: string;
  sets: WorkoutSet[];
  scheme: 'light' | 'dark';
  onSetLogged: (restSeconds: number, exerciseName: string) => void;
};

export function ExerciseBlock({ block, sessionId, sets, scheme, onSetLogged }: Props) {
  const c = Colors[scheme];
  const border = scheme === 'dark' ? '#2a2d30' : '#e3e5e8';
  const muted = scheme === 'dark' ? '#9BA1A6' : '#687076';
  const cardBg = scheme === 'dark' ? '#1f2224' : '#f1f3f5';
  const doneBg = scheme === 'dark' ? '#1a2a1f' : '#e8f5ec';
  const onTint = scheme === 'dark' ? '#000' : '#fff';

  const exerciseSets = useMemo(
    () => sets.filter((s) => s.exercise_id === block.exercise.id).sort((a, b) => a.set_number - b.set_number),
    [sets, block.exercise.id]
  );

  const { data: lastPerf } = useLastPerformance(block.exercise.id, sessionId);

  const [extraRows, setExtraRows] = useState(0);
  const loggedSetNumbers = new Set(exerciseSets.map((s) => s.set_number));
  const maxLoggedSet = exerciseSets.reduce((m, s) => Math.max(m, s.set_number), 0);
  const totalRows = Math.max(block.target_sets, maxLoggedSet) + extraRows;

  const meta = useMemo(
    () =>
      [block.exercise.muscle_group, block.exercise.equipment]
        .filter(Boolean)
        .map((s) => s!.charAt(0).toUpperCase() + s!.slice(1))
        .join(' · '),
    [block.exercise]
  );

  const lastSummary = useMemo(() => {
    if (!lastPerf || lastPerf.sets.length === 0) return null;
    const reps = lastPerf.sets.map((s) => s.reps ?? '–').join(', ');
    const weight = lastPerf.sets[0].weight_kg;
    const days = Math.round(
      (Date.now() - new Date(lastPerf.session_date).getTime()) / (1000 * 60 * 60 * 24)
    );
    const when = days === 0 ? 'today' : days === 1 ? 'yesterday' : `${days}d ago`;
    return `Last ${when}: ${reps} @ ${formatWeight(weight, block.exercise.display_unit)}`;
  }, [lastPerf, block.exercise.display_unit]);

  const rowsArray = Array.from({ length: totalRows }, (_, i) => i + 1);

  return (
    <View style={[styles.card, { backgroundColor: cardBg, borderColor: border }]}>
      <View style={styles.head}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.name, { color: c.text }]} numberOfLines={1}>
            {block.exercise.name}
          </Text>
          {meta.length > 0 && (
            <Text style={[styles.metaLine, { color: muted }]} numberOfLines={1}>
              {meta}
            </Text>
          )}
          {lastSummary && (
            <Text style={[styles.lastLine, { color: muted }]} numberOfLines={1}>
              {lastSummary}
            </Text>
          )}
        </View>
      </View>

      <View style={[styles.headerRow, { borderBottomColor: border }]}>
        <Text style={[styles.hCell, styles.hNum, { color: muted }]}>SET</Text>
        <Text style={[styles.hCell, styles.hInput, { color: muted }]}>REPS</Text>
        <Text style={[styles.hCell, styles.hInput, { color: muted }]}>
          WEIGHT ({block.exercise.display_unit})
        </Text>
        <Text style={[styles.hCell, styles.hCheck, { color: muted }]}> </Text>
      </View>

      {rowsArray.map((setNum) => {
        const logged = exerciseSets.find((s) => s.set_number === setNum);
        const prefill = lastPerf?.sets.find((s) => s.set_number === setNum) ?? null;
        return (
          <SetRow
            key={setNum}
            setNum={setNum}
            logged={logged}
            prefill={prefill}
            unit={block.exercise.display_unit}
            sessionId={sessionId}
            exerciseId={block.exercise.id}
            scheme={scheme}
            onLogged={() => onSetLogged(block.rest_seconds, block.exercise.name)}
            doneBg={doneBg}
            border={border}
            muted={muted}
            textColor={c.text}
            tint={c.tint}
            onTint={onTint}
          />
        );
      })}

      <Pressable
        onPress={() => setExtraRows((n) => n + 1)}
        style={({ pressed }) => [
          styles.addSetBtn,
          { borderColor: border, opacity: pressed ? 0.6 : 1 },
        ]}
        hitSlop={6}>
        <Ionicons name="add" size={16} color={muted} />
        <Text style={{ color: muted, fontSize: 13, fontWeight: '600' }}>Add set</Text>
      </Pressable>
    </View>
  );
}

type SetRowProps = {
  setNum: number;
  logged: WorkoutSet | undefined;
  prefill: WorkoutSet | null;
  unit: 'kg' | 'lbs';
  sessionId: string;
  exerciseId: string;
  scheme: 'light' | 'dark';
  onLogged: () => void;
  doneBg: string;
  border: string;
  muted: string;
  textColor: string;
  tint: string;
  onTint: string;
};

function SetRow({
  setNum,
  logged,
  prefill,
  unit,
  sessionId,
  exerciseId,
  onLogged,
  doneBg,
  border,
  muted,
  textColor,
  tint,
  onTint,
}: SetRowProps) {
  const logSet = useLogSet();
  const deleteSet = useDeleteSet();

  const prefilledReps = prefill?.reps != null ? String(prefill.reps) : '';
  const prefilledWeight =
    prefill?.weight_kg != null ? String(kgToDisplay(prefill.weight_kg, unit) ?? '') : '';

  const [reps, setReps] = useState('');
  const [weight, setWeight] = useState('');
  const [repsTouched, setRepsTouched] = useState(false);
  const [weightTouched, setWeightTouched] = useState(false);

  const [editing, setEditing] = useState(false);
  const isLogged = !!logged && !editing;

  const repsColor = repsTouched ? textColor : muted;
  const weightColor = weightTouched ? textColor : muted;

  const overloadDiff = useMemo(() => {
    if (!logged || !prefill || logged.weight_kg == null || prefill.weight_kg == null) return null;
    const diff = Math.round((logged.weight_kg - prefill.weight_kg) * 10) / 10;
    if (Math.abs(diff) < 0.05) return null;
    return diff;
  }, [logged, prefill]);

  const onTick = async () => {
    const r = parseInt(repsTouched ? reps : prefilledReps, 10);
    const w = parseFloat(weightTouched ? weight : prefilledWeight);
    if (!Number.isFinite(r) || r <= 0) {
      Alert.alert('Missing reps', 'Enter a rep count before logging this set.');
      return;
    }
    if (!Number.isFinite(w) || w < 0) {
      Alert.alert('Missing weight', 'Enter a weight before logging this set. Use 0 for bodyweight.');
      return;
    }
    // If editing, delete old record first
    if (logged && editing) {
      await deleteSet.mutateAsync({ id: logged.id, session_id: sessionId }).catch(() => {});
    }
    try {
      await logSet.mutateAsync({
        session_id: sessionId,
        exercise_id: exerciseId,
        set_number: setNum,
        reps: r,
        weight_kg: displayToKg(w, unit),
      });
      setEditing(false);
      onLogged();
    } catch (e: any) {
      Alert.alert('Could not log set', e.message ?? String(e));
    }
  };

  const onTapLogged = () => {
    if (!logged) return;
    Alert.alert(`Set ${setNum}`, undefined, [
      {
        text: 'Edit',
        onPress: () => {
          // Pre-fill inputs with current logged values
          setReps(String(logged.reps ?? ''));
          setWeight(String(kgToDisplay(logged.weight_kg, unit) ?? ''));
          setRepsTouched(true);
          setWeightTouched(true);
          setEditing(true);
        },
      },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => deleteSet.mutate({ id: logged.id, session_id: sessionId }),
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  // Collapsed view for logged sets
  if (logged && !editing) {
    const w = formatWeight(logged.weight_kg, unit);
    const diff = overloadDiff;
    return (
      <Pressable
        onPress={onTapLogged}
        style={[setStyles.collapsedRow, { backgroundColor: doneBg, borderBottomColor: border }]}>
        <Ionicons name="checkmark-circle" size={18} color={tint} style={{ marginRight: 8 }} />
        <Text style={{ color: textColor, fontSize: 14, flex: 1 }}>
          <Text style={{ fontWeight: '600' }}>Set {setNum}</Text>
          {'  '}{logged.reps ?? '–'} × {w}
        </Text>
        {diff !== null && (
          <Text style={{ fontSize: 11, fontWeight: '700', color: diff > 0 ? '#22c55e' : '#ef4444', marginRight: 6 }}>
            {diff > 0 ? '▲' : '▼'}{Math.abs(diff)}{unit}
          </Text>
        )}
        <Ionicons name="ellipsis-horizontal" size={16} color={muted} />
      </Pressable>
    );
  }

  const displayReps = repsTouched ? reps : prefilledReps;
  const displayWeight = weightTouched ? weight : prefilledWeight;

  return (
    <View style={[setStyles.row, { backgroundColor: 'transparent', borderBottomColor: border }]}>
      <View style={setStyles.numCell}>
        <Text style={{ color: muted, fontSize: 14, fontWeight: '600', textAlign: 'center' }}>{setNum}</Text>
      </View>
      <TextInput
        style={[setStyles.input, { color: repsColor, borderColor: border }]}
        value={displayReps}
        placeholder="–"
        placeholderTextColor={muted}
        keyboardType="number-pad"
        selectTextOnFocus
        onFocus={() => { if (!repsTouched) { setReps(prefilledReps); setRepsTouched(true); } }}
        onChangeText={(t) => { setReps(t); setRepsTouched(true); }}
      />
      <TextInput
        style={[setStyles.input, { color: weightColor, borderColor: border }]}
        value={displayWeight}
        placeholder="–"
        placeholderTextColor={muted}
        keyboardType="decimal-pad"
        selectTextOnFocus
        onFocus={() => { if (!weightTouched) { setWeight(prefilledWeight); setWeightTouched(true); } }}
        onChangeText={(t) => { setWeight(t); setWeightTouched(true); }}
      />
      <Pressable
        onPress={onTick}
        disabled={logSet.isPending}
        hitSlop={6}
        style={({ pressed }) => [setStyles.check, { opacity: pressed ? 0.5 : 1 }]}>
        <Ionicons name={editing ? 'checkmark-circle' : 'checkmark-circle-outline'} size={28} color={editing ? tint : muted} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 14, padding: 12, marginBottom: 14 },
  head: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  name: { fontSize: 17, fontWeight: '700' },
  metaLine: { fontSize: 12, marginTop: 2 },
  lastLine: { fontSize: 12, marginTop: 4, fontStyle: 'italic' },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginBottom: 4,
  },
  hCell: { fontSize: 10, fontWeight: '700', letterSpacing: 0.6 },
  hNum: { width: 36, textAlign: 'center' },
  hInput: { flex: 1, textAlign: 'center' },
  hCheck: { width: 40, textAlign: 'center' },
  addSetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
    marginTop: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderStyle: 'dashed',
    borderRadius: 10,
  },
});

const setStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  numCell: { width: 36, alignItems: 'center', justifyContent: 'center' },
  input: {
    flex: 1,
    textAlign: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    paddingVertical: 8,
    marginHorizontal: 4,
    fontSize: 16,
  },
  check: { width: 40, alignItems: 'center' },
  collapsedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
