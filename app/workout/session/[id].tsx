import { Ionicons } from '@expo/vector-icons';
import { router, Stack, useLocalSearchParams, type Href } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors } from '@/constants/theme';
import { useAuth } from '@/src/features/auth/useAuth';
import { formatWeight } from '@/src/utils/units';
import { useSessionDetail } from '@/src/features/workouts/useSessions';
import { useCreateTemplate, useAddTemplateExercise } from '@/src/features/workouts/useTemplates';

export default function SessionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const border = scheme === 'dark' ? '#2a2d30' : '#e3e5e8';
  const muted = scheme === 'dark' ? '#9BA1A6' : '#687076';
  const cardBg = scheme === 'dark' ? '#1f2224' : '#f1f3f5';
  const insets = useSafeAreaInsets();

  const { session: authSession } = useAuth();
  const { data, isLoading } = useSessionDetail(id);
  const createTemplate = useCreateTemplate();
  const addTemplateExercise = useAddTemplateExercise();
  const [saving, setSaving] = useState(false);

  const onSaveAsTemplate = async () => {
    if (!data || !authSession?.user.id) return;
    const name = data.session.name ?? 'Imported workout';
    Alert.alert(
      'Save as template?',
      `Create a new template "${name}" with ${data.exercises.length} exercise${data.exercises.length === 1 ? '' : 's'}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Save',
          onPress: async () => {
            setSaving(true);
            try {
              const template = await createTemplate.mutateAsync({
                user_id: authSession.user.id,
                name,
              });
              for (let i = 0; i < data.exercises.length; i++) {
                const ex = data.exercises[i];
                const uniqueSets = new Set(ex.sets.map((s) => s.set_number)).size;
                await addTemplateExercise.mutateAsync({
                  template_id: template.id,
                  exercise_id: ex.id,
                  target_sets: Math.max(uniqueSets, 3),
                  rest_seconds: 90,
                });
              }
              Alert.alert('Template saved!', `"${name}" is now in your templates.`, [
                {
                  text: 'View template',
                  onPress: () => router.push(`/workout/template/${template.id}` as Href),
                },
                { text: 'OK', style: 'cancel' },
              ]);
            } catch (e: any) {
              Alert.alert('Failed', e.message ?? String(e));
            } finally {
              setSaving(false);
            }
          },
        },
      ]
    );
  };

  const duration = useMemo(() => {
    if (!data?.session.started_at || !data?.session.ended_at) return null;
    const secs = Math.round(
      (new Date(data.session.ended_at).getTime() - new Date(data.session.started_at).getTime()) / 1000
    );
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`;
    if (m > 0) return `${m}m`;
    return '< 1m';
  }, [data?.session]);

  const dateLabel = useMemo(() => {
    if (!data?.session.started_at) return '';
    const d = new Date(data.session.started_at);
    return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  }, [data?.session]);

  const totalVolume = useMemo(() => {
    if (!data) return 0;
    return data.exercises.reduce(
      (acc, ex) => acc + ex.sets.reduce((a, s) => a + (s.weight_kg ?? 0) * (s.reps ?? 0), 0),
      0
    );
  }, [data]);

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={[styles.header, { paddingTop: insets.top + 6, borderBottomColor: border }]}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={24} color={c.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: c.text }]} numberOfLines={1}>
          {data?.session.name ?? 'Session'}
        </Text>
        {data && data.exercises.length > 0 ? (
          <Pressable
            onPress={onSaveAsTemplate}
            disabled={saving}
            hitSlop={10}
            style={({ pressed }) => [styles.iconBtn, { opacity: pressed || saving ? 0.5 : 1 }]}>
            {saving
              ? <ActivityIndicator size="small" color={c.tint} />
              : <Ionicons name="copy-outline" size={22} color={c.tint} />}
          </Pressable>
        ) : (
          <View style={styles.iconBtn} />
        )}
      </View>

      {isLoading && (
        <View style={styles.center}>
          <ActivityIndicator color={c.tint} />
        </View>
      )}

      {data && (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
          <View style={[styles.metaCard, { backgroundColor: cardBg, borderColor: border }]}>
            <MetaStat label="Date" value={dateLabel} />
            {duration && <MetaStat label="Duration" value={duration} />}
            <MetaStat label="Exercises" value={String(data.exercises.length)} />
            <MetaStat
              label="Volume"
              value={`${Math.round(totalVolume).toLocaleString()} kg`}
            />
          </View>

          {data.exercises.map((ex) => (
            <View
              key={ex.id}
              style={[styles.exCard, { backgroundColor: cardBg, borderColor: border }]}>
              <Text style={[styles.exName, { color: c.text }]}>{ex.name}</Text>
              <View style={[styles.setHeaderRow, { borderBottomColor: border }]}>
                <Text style={[styles.hCell, styles.hNum, { color: muted }]}>SET</Text>
                <Text style={[styles.hCell, styles.hReps, { color: muted }]}>REPS</Text>
                <Text style={[styles.hCell, styles.hWeight, { color: muted }]}>WEIGHT</Text>
                <Text style={[styles.hCell, styles.h1rm, { color: muted }]}>EST 1RM</Text>
              </View>
              {ex.sets.map((s) => {
                const est1rm =
                  s.weight_kg != null && s.reps != null && s.reps > 0
                    ? s.weight_kg * (1 + s.reps / 30)
                    : null;
                return (
                  <View key={s.id} style={[styles.setRow, { borderBottomColor: border }]}>
                    <Text style={[styles.numCell, { color: muted }]}>{s.set_number}</Text>
                    <Text style={[styles.repsCell, { color: c.text }]}>{s.reps ?? '–'}</Text>
                    <Text style={[styles.weightCell, { color: c.text }]}>
                      {formatWeight(s.weight_kg, ex.display_unit)}
                    </Text>
                    <Text style={[styles.est1rmCell, { color: muted }]}>
                      {est1rm != null ? formatWeight(est1rm, ex.display_unit) : '–'}
                    </Text>
                  </View>
                );
              })}
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

function MetaStat({ label, value }: { label: string; value: string }) {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const muted = scheme === 'dark' ? '#9BA1A6' : '#687076';
  return (
    <View style={styles.metaStat}>
      <Text style={[styles.metaLabel, { color: muted }]}>{label}</Text>
      <Text style={[styles.metaValue, { color: c.text }]}>{value}</Text>
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
  headerTitle: { flex: 1, fontSize: 17, fontWeight: '600', textAlign: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  metaCard: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
    gap: 12,
  },
  metaStat: { minWidth: '40%', flex: 1 },
  metaLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 2 },
  metaValue: { fontSize: 17, fontWeight: '600' },
  exCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  exName: { fontSize: 16, fontWeight: '700', marginBottom: 8 },
  setHeaderRow: {
    flexDirection: 'row',
    paddingBottom: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginBottom: 2,
  },
  hCell: { fontSize: 10, fontWeight: '700', letterSpacing: 0.6 },
  hNum: { width: 32, textAlign: 'center' },
  hReps: { flex: 1, textAlign: 'center' },
  hWeight: { flex: 1.5, textAlign: 'center' },
  h1rm: { flex: 1.5, textAlign: 'center' },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  numCell: { width: 32, textAlign: 'center', fontSize: 13, fontWeight: '600' },
  repsCell: { flex: 1, textAlign: 'center', fontSize: 15 },
  weightCell: { flex: 1.5, textAlign: 'center', fontSize: 15 },
  est1rmCell: { flex: 1.5, textAlign: 'center', fontSize: 13 },
});
