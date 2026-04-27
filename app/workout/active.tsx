import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Notifications from 'expo-notifications';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors } from '@/constants/theme';
import { ExerciseBlock } from '@/src/features/workouts/ExerciseBlock';
import { ExercisePicker } from '@/src/features/workouts/ExercisePicker';
import { TimerFAB } from '@/src/features/workouts/TimerFAB';
import type { Exercise } from '@/src/features/workouts/types';
import {
  useAbandonSession,
  useFinishSession,
  useSession,
  useSessionBlocks,
  useSessionSets,
  type SessionExerciseBlock,
} from '@/src/features/workouts/useSessions';

type RestState = {
  exerciseName: string;
  endsAt: number;   // Date.now() + duration ms
  total: number;    // original duration in seconds
};

async function scheduleRestNotification(
  seconds: number,
  exerciseName: string,
  prevId: string | null
): Promise<string | null> {
  if (prevId) Notifications.cancelScheduledNotificationAsync(prevId).catch(() => {});
  try {
    return await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Rest done',
        body: `Time to go — ${exerciseName}`,
        sound: true,
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds },
    });
  } catch {
    return null;
  }
}

export default function ActiveSessionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const border = scheme === 'dark' ? '#2a2d30' : '#e3e5e8';
  const muted = scheme === 'dark' ? '#9BA1A6' : '#687076';
  const cardBg = scheme === 'dark' ? '#1f2224' : '#f1f3f5';
  const onTint = scheme === 'dark' ? '#000' : '#fff';
  const insets = useSafeAreaInsets();

  const { data: session, isLoading } = useSession(id);
  const { data: blocks } = useSessionBlocks(session);
  const { data: sets } = useSessionSets(id);

  const finish = useFinishSession();
  const abandon = useAbandonSession();

  const [rest, setRest] = useState<RestState | null>(null);
  const [elapsed, setElapsed] = useState('0:00');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [adHocExercises, setAdHocExercises] = useState<Exercise[]>([]);
  const startedAt = useRef<number | null>(null);
  const restNotifIdRef = useRef<string | null>(null);

  const allBlocks = useMemo<SessionExerciseBlock[]>(() => {
    const existing = blocks ?? [];
    const seen = new Set(existing.map((b) => b.exercise.id));
    const extras: SessionExerciseBlock[] = adHocExercises
      .filter((ex) => !seen.has(ex.id))
      .map((ex, i) => ({
        exercise: ex,
        template_exercise_id: null,
        target_sets: 3,
        rest_seconds: 90,
        notes: null,
        order_index: existing.length + i,
      }));
    return [...existing, ...extras];
  }, [blocks, adHocExercises]);

  useEffect(() => {
    if (session?.started_at) startedAt.current = new Date(session.started_at).getTime();
  }, [session?.started_at]);

  useEffect(() => {
    const tick = () => {
      if (!startedAt.current) return;
      const seconds = Math.floor((Date.now() - startedAt.current) / 1000);
      const m = Math.floor(seconds / 60);
      const s = seconds % 60;
      setElapsed(`${m}:${String(s).padStart(2, '0')}`);
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [session?.started_at]);

  // Recompute remaining from endsAt each tick — snaps correctly on foreground resume
  useEffect(() => {
    if (!rest) return;
    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((rest.endsAt - Date.now()) / 1000));
      if (remaining === 0) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        if (restNotifIdRef.current) {
          Notifications.cancelScheduledNotificationAsync(restNotifIdRef.current).catch(() => {});
          restNotifIdRef.current = null;
        }
        setRest(null);
      } else {
        setRest((r) => r ? { ...r } : r); // trigger re-render so UI reads latest endsAt
      }
    }, 500);
    return () => clearInterval(interval);
  }, [rest?.endsAt]);

  // When app comes back to foreground, force a re-render to snap the timer
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') setRest((r) => r ? { ...r } : r);
    });
    return () => sub.remove();
  }, []);

  const onSetLogged = (restSeconds: number, exerciseName: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    if (restSeconds > 0) {
      const endsAt = Date.now() + restSeconds * 1000;
      setRest({ exerciseName, endsAt, total: restSeconds });
      scheduleRestNotification(restSeconds, exerciseName, restNotifIdRef.current)
        .then((id) => { restNotifIdRef.current = id; })
        .catch(() => {});
    }
  };

  const onExit = () => {
    router.back();
  };

  const onFinish = async () => {
    if (!session) return;
    const logged = sets ?? [];
    if (logged.length === 0) {
      Alert.alert('No sets logged', 'Discard this empty session?', [
        { text: 'Keep', style: 'cancel' },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: async () => {
            await abandon.mutateAsync(session.id);
            router.back();
          },
        },
      ]);
      return;
    }
    try {
      await finish.mutateAsync(session.id);
      router.back();
    } catch (e: any) {
      Alert.alert('Could not finish', e.message ?? String(e));
    }
  };

  const onAddExerciseToSession = (ex: Exercise) => {
    setAdHocExercises((list) => (list.some((e) => e.id === ex.id) ? list : [...list, ex]));
    setPickerOpen(false);
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <Stack.Screen options={{ headerShown: false }} />

      <View
        style={[styles.header, { paddingTop: insets.top + 6, borderBottomColor: border }]}>
        <Pressable onPress={onExit} hitSlop={10} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={24} color={c.text} />
        </Pressable>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={[styles.headerTitle, { color: c.text }]} numberOfLines={1}>
            {session?.name ?? 'Workout'}
          </Text>
          <Text style={[styles.elapsed, { color: muted }]}>{elapsed}</Text>
        </View>
        <Pressable
          onPress={onFinish}
          disabled={finish.isPending || abandon.isPending}
          hitSlop={10}
          style={({ pressed }) => [
            styles.finishBtn,
            { backgroundColor: c.tint, opacity: pressed ? 0.7 : 1 },
          ]}>
          <Text style={[styles.finishBtnText, { color: onTint }]}>Finish</Text>
        </Pressable>
      </View>

      {isLoading && (
        <View style={styles.center}>
          <ActivityIndicator color={c.tint} />
        </View>
      )}

      {session && blocks && sets !== undefined && (
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: rest ? 160 : 100 }}
          keyboardShouldPersistTaps="handled">
          {allBlocks.length === 0 && (
            <View
              style={[
                styles.emptyCard,
                { backgroundColor: cardBg, borderColor: border },
              ]}>
              <Text style={{ color: muted, textAlign: 'center' }}>
                No exercises yet. Tap{' '}
                <Text style={{ fontWeight: '600', color: c.text }}>+ Add exercise</Text>{' '}
                below to start logging.
              </Text>
            </View>
          )}

          {allBlocks.map((block) => (
            <ExerciseBlock
              key={block.exercise.id}
              block={block}
              sessionId={session.id}
              sets={sets}
              scheme={scheme}
              onSetLogged={onSetLogged}
            />
          ))}

          <Pressable
            onPress={() => setPickerOpen(true)}
            style={({ pressed }) => [
              styles.addExBtn,
              { borderColor: border, opacity: pressed ? 0.6 : 1 },
            ]}>
            <Ionicons name="add" size={18} color={muted} />
            <Text style={{ color: muted, fontSize: 14, fontWeight: '600' }}>
              Add exercise
            </Text>
          </Pressable>
        </ScrollView>
      )}

      {rest && (
        <RestBar
          rest={rest}
          bottomInset={insets.bottom}
          scheme={scheme}
          onSkip={() => setRest(null)}
          onAdjust={(delta) =>
            setRest((r) =>
              r
                ? {
                    ...r,
                    endsAt: Math.max(Date.now() + 1000, r.endsAt + delta * 1000),
                  }
                : r
            )
          }
        />
      )}

      <TimerFAB />

      <Modal
        visible={pickerOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setPickerOpen(false)}>
        <View style={{ flex: 1, backgroundColor: c.background }}>
          <View
            style={[
              styles.modalHeader,
              { borderBottomColor: border, paddingTop: 14, paddingBottom: 10 },
            ]}>
            <Pressable onPress={() => setPickerOpen(false)} hitSlop={10} style={styles.iconBtn}>
              <Text style={{ color: c.tint, fontSize: 16 }}>Cancel</Text>
            </Pressable>
            <Text style={[styles.headerTitle, { color: c.text }]}>Add exercise</Text>
            <View style={styles.iconBtn} />
          </View>
          <ExercisePicker onSelect={onAddExerciseToSession} />
        </View>
      </Modal>
    </View>
  );
}

function RestBar({
  rest,
  bottomInset,
  scheme,
  onSkip,
  onAdjust,
}: {
  rest: RestState;
  bottomInset: number;
  scheme: 'light' | 'dark';
  onSkip: () => void;
  onAdjust: (delta: number) => void;
}) {
  const c = Colors[scheme];
  const border = scheme === 'dark' ? '#2a2d30' : '#e3e5e8';
  const muted = scheme === 'dark' ? '#9BA1A6' : '#687076';
  const bg = scheme === 'dark' ? '#1f2224' : '#ffffff';
  const onTint = scheme === 'dark' ? '#000' : '#fff';
  const remaining = Math.max(0, Math.ceil((rest.endsAt - Date.now()) / 1000));
  const m = Math.floor(remaining / 60);
  const s = remaining % 60;

  return (
    <View
      style={[
        restStyles.bar,
        {
          backgroundColor: bg,
          borderTopColor: border,
          paddingBottom: Math.max(bottomInset, 8) + 8,
        },
      ]}>
      <View style={restStyles.topRow}>
        <View style={{ flex: 1 }}>
          <Text style={[restStyles.label, { color: muted }]}>
            REST · {rest.exerciseName}
          </Text>
          <Text style={[restStyles.time, { color: c.text }]}>
            {m}:{String(s).padStart(2, '0')}
          </Text>
        </View>
        <Pressable
          onPress={onSkip}
          hitSlop={6}
          style={({ pressed }) => [
            restStyles.skipBtn,
            { backgroundColor: c.tint, opacity: pressed ? 0.7 : 1 },
          ]}>
          <Text style={[restStyles.skipText, { color: onTint }]}>Skip</Text>
        </Pressable>
      </View>
      <View style={restStyles.adjustRow}>
        <Pressable
          onPress={() => onAdjust(-15)}
          hitSlop={6}
          style={({ pressed }) => [
            restStyles.adjustBtn,
            { borderColor: border, opacity: pressed ? 0.6 : 1 },
          ]}>
          <Text style={{ color: c.text, fontWeight: '600' }}>-15s</Text>
        </Pressable>
        <Pressable
          onPress={() => onAdjust(15)}
          hitSlop={6}
          style={({ pressed }) => [
            restStyles.adjustBtn,
            { borderColor: border, opacity: pressed ? 0.6 : 1 },
          ]}>
          <Text style={{ color: c.text, fontWeight: '600' }}>+15s</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  iconBtn: { padding: 8, minWidth: 48, alignItems: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '600' },
  elapsed: { fontSize: 12, marginTop: 2, fontVariant: ['tabular-nums'] },
  finishBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  finishBtnText: { fontSize: 14, fontWeight: '700' },
  center: { padding: 32, alignItems: 'center' },
  emptyCard: { borderWidth: 1, borderRadius: 12, padding: 24, marginBottom: 14 },
  addExBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderStyle: 'dashed',
    borderRadius: 12,
    marginTop: 4,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});

const restStyles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  topRow: { flexDirection: 'row', alignItems: 'center' },
  label: { fontSize: 10, fontWeight: '700', letterSpacing: 0.6 },
  time: { fontSize: 28, fontWeight: '700', fontVariant: ['tabular-nums'] },
  skipBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10 },
  skipText: { fontSize: 14, fontWeight: '700' },
  adjustRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
  adjustBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderWidth: 1,
    borderRadius: 10,
  },
});
