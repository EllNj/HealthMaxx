import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { router, Stack } from 'expo-router';
import { useState } from 'react';
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
import { importStrongCsv, type ImportResult } from '@/src/utils/strongImport';
import { useQueryClient } from '@tanstack/react-query';

type Phase = 'idle' | 'loading' | 'done' | 'error';

export default function ImportScreen() {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const border = scheme === 'dark' ? '#2a2d30' : '#e3e5e8';
  const muted = scheme === 'dark' ? '#9BA1A6' : '#687076';
  const cardBg = scheme === 'dark' ? '#1f2224' : '#f1f3f5';
  const onTint = scheme === 'dark' ? '#000' : '#fff';
  const insets = useSafeAreaInsets();

  const { session } = useAuth();
  const qc = useQueryClient();

  const [phase, setPhase] = useState<Phase>('idle');
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  const onPick = async () => {
    if (!session?.user.id) return;

    let picked: DocumentPicker.DocumentPickerResult;
    try {
      picked = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });
    } catch {
      return;
    }

    if (picked.canceled || !picked.assets?.[0]) return;
    const asset = picked.assets[0];

    setPhase('loading');
    setProgress(0);

    try {
      const response = await fetch(asset.uri);
      const csvText = await response.text();

      const res = await importStrongCsv(csvText, session.user.id, (pct) => setProgress(pct));

      setResult(res);
      setPhase('done');

      // Invalidate all workout-related queries so history + session lists update
      qc.invalidateQueries({ queryKey: ['session_history'] });
      qc.invalidateQueries({ queryKey: ['workout_sessions'] });
    } catch (e: any) {
      setErrorMsg(e.message ?? String(e));
      setPhase('error');
    }
  };

  const reset = () => {
    setPhase('idle');
    setProgress(0);
    setResult(null);
    setErrorMsg('');
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={[styles.header, { paddingTop: insets.top + 6, borderBottomColor: border }]}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={24} color={c.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: c.text }]}>Import from Strong</Text>
        <View style={styles.iconBtn} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        <View style={[styles.infoCard, { backgroundColor: cardBg, borderColor: border }]}>
          <Text style={[styles.infoTitle, { color: c.text }]}>How to export from Strong</Text>
          {[
            'Open Strong on your iPhone',
            'Tap the Profile tab → Settings (top right)',
            'Tap "Export Data" → choose CSV',
            'Share or save the file (it may appear as a .txt), then come back here and tap "Choose export file"',
          ].map((step, i) => (
            <View key={i} style={styles.stepRow}>
              <View style={[styles.stepNum, { backgroundColor: c.tint }]}>
                <Text style={[styles.stepNumText, { color: onTint }]}>{i + 1}</Text>
              </View>
              <Text style={[styles.stepText, { color: muted }]}>{step}</Text>
            </View>
          ))}
        </View>

        {phase === 'idle' && (
          <Pressable
            onPress={onPick}
            style={({ pressed }) => [
              styles.pickBtn,
              { backgroundColor: c.tint, opacity: pressed ? 0.7 : 1 },
            ]}>
            <Ionicons name="document-text-outline" size={20} color={onTint} />
            <Text style={[styles.pickBtnText, { color: onTint }]}>Choose export file</Text>
          </Pressable>
        )}

        {phase === 'loading' && (
          <View style={[styles.statusCard, { backgroundColor: cardBg, borderColor: border }]}>
            <ActivityIndicator color={c.tint} size="large" />
            <Text style={[styles.statusTitle, { color: c.text }]}>Importing…</Text>
            <View style={[styles.progressTrack, { backgroundColor: border }]}>
              <View style={[styles.progressFill, { backgroundColor: c.tint, width: `${progress}%` }]} />
            </View>
            <Text style={[styles.progressLabel, { color: muted }]}>{progress}%</Text>
          </View>
        )}

        {phase === 'done' && result && (
          <View style={[styles.statusCard, { backgroundColor: cardBg, borderColor: border }]}>
            <Ionicons name="checkmark-circle" size={48} color={c.tint} />
            <Text style={[styles.statusTitle, { color: c.text }]}>Import complete</Text>
            <View style={styles.statsGrid}>
              <StatPill label="Sessions" value={result.sessions} tint={c.tint} onTint={onTint} />
              <StatPill label="Sets" value={result.sets} tint={c.tint} onTint={onTint} />
              <StatPill label="New exercises" value={result.newExercises} tint={c.tint} onTint={onTint} />
              {result.skippedRows > 0 && (
                <StatPill label="Skipped rows" value={result.skippedRows} tint={muted} onTint="#fff" />
              )}
            </View>
            {result.skippedRows > 0 && (
              <Text style={[styles.skipNote, { color: muted }]}>
                Skipped rows had missing or unparseable data.
              </Text>
            )}
            <View style={styles.doneActions}>
              <Pressable
                onPress={() => { router.back(); }}
                style={({ pressed }) => [
                  styles.actionBtn,
                  { backgroundColor: c.tint, opacity: pressed ? 0.7 : 1 },
                ]}>
                <Text style={[styles.actionBtnText, { color: onTint }]}>View history</Text>
              </Pressable>
              <Pressable
                onPress={reset}
                style={({ pressed }) => [
                  styles.actionBtnOutline,
                  { borderColor: border, opacity: pressed ? 0.6 : 1 },
                ]}>
                <Text style={[styles.actionBtnText, { color: c.text }]}>Import another</Text>
              </Pressable>
            </View>
          </View>
        )}

        {phase === 'error' && (
          <View style={[styles.statusCard, { backgroundColor: cardBg, borderColor: border }]}>
            <Ionicons name="close-circle" size={48} color="#ff6b6b" />
            <Text style={[styles.statusTitle, { color: c.text }]}>Import failed</Text>
            <Text style={[styles.errorMsg, { color: '#ff6b6b' }]}>{errorMsg}</Text>
            <Pressable
              onPress={reset}
              style={({ pressed }) => [
                styles.actionBtn,
                { backgroundColor: c.tint, opacity: pressed ? 0.7 : 1, marginTop: 16 },
              ]}>
              <Text style={[styles.actionBtnText, { color: onTint }]}>Try again</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function StatPill({
  label,
  value,
  tint,
  onTint,
}: {
  label: string;
  value: number;
  tint: string;
  onTint: string;
}) {
  return (
    <View style={[statStyles.pill, { backgroundColor: tint }]}>
      <Text style={[statStyles.value, { color: onTint }]}>{value.toLocaleString()}</Text>
      <Text style={[statStyles.label, { color: onTint, opacity: 0.8 }]}>{label}</Text>
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
  infoCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
  },
  infoTitle: { fontSize: 15, fontWeight: '700', marginBottom: 14 },
  stepRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10 },
  stepNum: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  stepNumText: { fontSize: 11, fontWeight: '800' },
  stepText: { flex: 1, fontSize: 14, lineHeight: 20 },
  pickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 14,
  },
  pickBtnText: { fontSize: 16, fontWeight: '700' },
  statusCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 24,
    alignItems: 'center',
    gap: 12,
  },
  statusTitle: { fontSize: 20, fontWeight: '700' },
  progressTrack: { width: '100%', height: 6, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },
  progressLabel: { fontSize: 13 },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
    marginTop: 4,
  },
  skipNote: { fontSize: 12, textAlign: 'center' },
  doneActions: { flexDirection: 'row', gap: 10, marginTop: 8 },
  actionBtn: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12 },
  actionBtnOutline: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12, borderWidth: 1 },
  actionBtnText: { fontSize: 14, fontWeight: '700' },
  errorMsg: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
});

const statStyles = StyleSheet.create({
  pill: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, alignItems: 'center', minWidth: 80 },
  value: { fontSize: 22, fontWeight: '800' },
  label: { fontSize: 11, fontWeight: '600', marginTop: 2 },
});
