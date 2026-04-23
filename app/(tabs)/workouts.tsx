import { Ionicons } from '@expo/vector-icons';
import { router, type Href } from 'expo-router';
import { useMemo } from 'react';
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
import {
  useActiveSession,
  useSessionHistory,
  useStartSessionFromTemplate,
  type SessionSummary,
} from '@/src/features/workouts/useSessions';
import { TimerFAB } from '@/src/features/workouts/TimerFAB';
import { useCreateTemplate, useTemplates } from '@/src/features/workouts/useTemplates';

export default function WorkoutsScreen() {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const border = scheme === 'dark' ? '#2a2d30' : '#e3e5e8';
  const muted = scheme === 'dark' ? '#9BA1A6' : '#687076';
  const cardBg = scheme === 'dark' ? '#1f2224' : '#f1f3f5';
  const onTint = scheme === 'dark' ? '#000' : '#fff';

  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const { data: templates, isLoading, error } = useTemplates();
  const createTemplate = useCreateTemplate();
  const { data: active } = useActiveSession(session?.user.id);
  const startSession = useStartSessionFromTemplate();
  const { data: history } = useSessionHistory(session?.user.id, 10);

  const onNewTemplate = async () => {
    if (!session?.user.id) return;
    try {
      const t = await createTemplate.mutateAsync({
        user_id: session.user.id,
        name: 'New template',
      });
      router.push(`/workout/template/${t.id}` as Href);
    } catch (e: any) {
      Alert.alert('Could not create template', e.message ?? String(e));
    }
  };

  const onStart = async (templateId: string, templateName: string) => {
    if (!session?.user.id) return;
    if (active) {
      Alert.alert(
        'Session in progress',
        `You have an active "${active.name ?? 'workout'}" session. Resume it first or finish it before starting a new one.`,
        [
          { text: 'OK', style: 'cancel' },
          {
            text: 'Resume',
            onPress: () => router.push(`/workout/active?id=${active.id}` as Href),
          },
        ]
      );
      return;
    }
    try {
      const s = await startSession.mutateAsync({
        user_id: session.user.id,
        template_id: templateId,
        template_name: templateName,
      });
      router.push(`/workout/active?id=${s.id}` as Href);
    } catch (e: any) {
      Alert.alert('Could not start session', e.message ?? String(e));
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ paddingBottom: 100 }}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Text style={[styles.title, { color: c.text }]}>Workouts</Text>
      </View>

      {active && (
        <View style={styles.section}>
          <Pressable
            onPress={() => router.push(`/workout/active?id=${active.id}` as Href)}
            style={({ pressed }) => [
              styles.resumeCard,
              { backgroundColor: c.tint, opacity: pressed ? 0.8 : 1 },
            ]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.resumeLabel, { color: onTint }]}>IN PROGRESS</Text>
              <Text style={[styles.resumeTitle, { color: onTint }]} numberOfLines={1}>
                {active.name ?? 'Workout'}
              </Text>
            </View>
            <Ionicons name="play-forward" size={20} color={onTint} />
          </Pressable>
        </View>
      )}

      <View style={styles.section}>
        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionHeader, { color: muted }]}>Templates</Text>
          <Pressable
            onPress={onNewTemplate}
            disabled={createTemplate.isPending}
            hitSlop={10}
            style={({ pressed }) => [
              styles.newBtn,
              { backgroundColor: c.tint, opacity: pressed ? 0.7 : 1 },
            ]}>
            <Ionicons name="add" size={16} color={onTint} />
            <Text style={[styles.newBtnText, { color: onTint }]}>New</Text>
          </Pressable>
        </View>

        {isLoading && (
          <View style={styles.center}>
            <ActivityIndicator color={c.tint} />
          </View>
        )}

        {error && (
          <Text style={{ color: '#ff6b6b', paddingHorizontal: 16 }}>
            {(error as Error).message}
          </Text>
        )}

        {!isLoading && templates && templates.length === 0 && (
          <View style={[styles.emptyCard, { backgroundColor: cardBg, borderColor: border }]}>
            <Text style={{ color: muted, textAlign: 'center' }}>
              No templates yet. Tap{' '}
              <Text style={{ fontWeight: '600', color: c.text }}>New</Text> to build your first
              (Push / Pull / Legs, etc.).
            </Text>
          </View>
        )}

        {templates?.map((t) => (
          <Pressable
            key={t.id}
            onPress={() => router.push(`/workout/template/${t.id}` as Href)}
            style={({ pressed }) => [
              styles.card,
              { backgroundColor: cardBg, borderColor: border, opacity: pressed ? 0.7 : 1 },
            ]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.cardTitle, { color: c.text }]} numberOfLines={1}>
                {t.name}
              </Text>
              <Text style={[styles.cardMeta, { color: muted }]}>
                {t.exercise_count} {t.exercise_count === 1 ? 'exercise' : 'exercises'}
              </Text>
            </View>
            <Pressable
              onPress={() => onStart(t.id, t.name)}
              disabled={startSession.isPending || t.exercise_count === 0}
              hitSlop={6}
              style={({ pressed }) => [
                styles.startBtn,
                {
                  backgroundColor: c.tint,
                  opacity: t.exercise_count === 0 ? 0.4 : pressed ? 0.7 : 1,
                },
              ]}>
              <Ionicons name="play" size={14} color={onTint} />
              <Text style={[styles.startBtnText, { color: onTint }]}>Start</Text>
            </Pressable>
          </Pressable>
        ))}
      </View>

      {history && history.length > 0 && (
        <View style={[styles.section, { marginTop: 32 }]}>
          <Text style={[styles.sectionHeader, { color: muted, marginBottom: 10 }]}>History</Text>
          {history.map((s) => (
            <HistoryCard
              key={s.id}
              item={s}
              cardBg={cardBg}
              border={border}
              textColor={c.text}
              muted={muted}
            />
          ))}
        </View>
      )}

      <View style={[styles.section, { marginTop: 32 }]}>
        <Text style={[styles.sectionHeader, { color: muted, marginBottom: 12 }]}>Manage</Text>
        <Pressable
          onPress={() => router.push('/workout/exercises' as Href)}
          style={({ pressed }) => [
            styles.linkRow,
            { backgroundColor: cardBg, borderColor: border, opacity: pressed ? 0.7 : 1, marginBottom: 8 },
          ]}>
          <Ionicons name="list" size={18} color={c.text} />
          <Text style={[styles.linkText, { color: c.text }]}>Browse exercises</Text>
          <Ionicons name="chevron-forward" size={18} color={muted} />
        </Pressable>
        <Pressable
          onPress={() => router.push('/workout/import' as Href)}
          style={({ pressed }) => [
            styles.linkRow,
            { backgroundColor: cardBg, borderColor: border, opacity: pressed ? 0.7 : 1 },
          ]}>
          <Ionicons name="download-outline" size={18} color={c.text} />
          <Text style={[styles.linkText, { color: c.text }]}>Import from Strong</Text>
          <Ionicons name="chevron-forward" size={18} color={muted} />
        </Pressable>
      </View>
    </ScrollView>
    <TimerFAB />
    </View>
  );
}

function HistoryCard({
  item,
  cardBg,
  border,
  textColor,
  muted,
}: {
  item: SessionSummary;
  cardBg: string;
  border: string;
  textColor: string;
  muted: string;
}) {
  const dateLabel = useMemo(() => {
    const d = new Date(item.started_at);
    return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
  }, [item.started_at]);

  const duration = useMemo(() => {
    if (!item.ended_at) return null;
    const secs = Math.round(
      (new Date(item.ended_at).getTime() - new Date(item.started_at).getTime()) / 1000
    );
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`;
    if (m > 0) return `${m}m`;
    return null;
  }, [item.started_at, item.ended_at]);

  return (
    <Pressable
      onPress={() => router.push(`/workout/session/${item.id}` as Href)}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: cardBg, borderColor: border, opacity: pressed ? 0.7 : 1 },
      ]}>
      <View style={{ flex: 1 }}>
        <Text style={[styles.cardTitle, { color: textColor }]} numberOfLines={1}>
          {item.name ?? 'Workout'}
        </Text>
        <Text style={[styles.cardMeta, { color: muted }]}>
          {dateLabel}
          {duration ? `  ·  ${duration}` : ''}
          {`  ·  ${item.exercise_count} ex  ·  ${item.set_count} sets`}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={muted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 16, paddingBottom: 4 },
  title: { fontSize: 32, fontWeight: '700' },
  section: { paddingHorizontal: 16, marginTop: 20 },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  newBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    gap: 4,
  },
  newBtnText: { fontSize: 13, fontWeight: '600' },
  emptyCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 20,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    gap: 10,
  },
  cardTitle: { fontSize: 17, fontWeight: '600', marginBottom: 2 },
  cardMeta: { fontSize: 13 },
  startBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    gap: 4,
  },
  startBtnText: { fontSize: 13, fontWeight: '600' },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    gap: 10,
  },
  linkText: { flex: 1, fontSize: 15, fontWeight: '500' },
  center: { padding: 24, alignItems: 'center' },
  resumeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    padding: 16,
    gap: 10,
  },
  resumeLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 0.8, marginBottom: 2 },
  resumeTitle: { fontSize: 17, fontWeight: '700' },
});
