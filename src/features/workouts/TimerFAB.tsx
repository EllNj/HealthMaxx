import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Notifications from 'expo-notifications';
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors } from '@/constants/theme';

type TimerMode = 'idle' | 'countdown' | 'stopwatch';

const PRESETS = [
  { label: '60s', seconds: 60 },
  { label: '90s', seconds: 90 },
  { label: '2m', seconds: 120 },
  { label: '3m', seconds: 180 },
  { label: '5m', seconds: 300 },
];

async function scheduleFinishNotification(seconds: number): Promise<string> {
  await Notifications.cancelAllScheduledNotificationsAsync();
  return Notifications.scheduleNotificationAsync({
    content: {
      title: 'Timer done',
      body: 'Rest timer finished — time to go!',
      sound: true,
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds },
  });
}

async function cancelFinishNotification() {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

export function TimerFAB() {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const border = scheme === 'dark' ? '#2a2d30' : '#e3e5e8';
  const muted = scheme === 'dark' ? '#9BA1A6' : '#687076';
  const bg = scheme === 'dark' ? '#1f2224' : '#ffffff';
  const onTint = scheme === 'dark' ? '#000' : '#fff';
  const insets = useSafeAreaInsets();

  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<TimerMode>('idle');
  const [remaining, setRemaining] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [customInput, setCustomInput] = useState('');
  const notifIdRef = useRef<string | null>(null);
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (mode === 'idle') return;
    const interval = setInterval(() => {
      if (mode === 'countdown') {
        setRemaining((r) => {
          if (r <= 1) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
            cancelFinishNotification();
            notifIdRef.current = null;
            setMode('idle');
            return 0;
          }
          return r - 1;
        });
      } else {
        setElapsed((e) => e + 1);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [mode]);

  const pulse = () => {
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 1.15, duration: 80, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1, duration: 80, useNativeDriver: true }),
    ]).start();
  };

  const startCountdown = async (seconds: number) => {
    setRemaining(seconds);
    setMode('countdown');
    setOpen(false);
    pulse();
    try {
      notifIdRef.current = await scheduleFinishNotification(seconds);
    } catch {
      // notifications may not be granted — timer still works in foreground
    }
  };

  const startStopwatch = () => {
    setElapsed(0);
    setMode('stopwatch');
    setOpen(false);
    pulse();
  };

  const stop = () => {
    setMode('idle');
    setRemaining(0);
    setElapsed(0);
    cancelFinishNotification();
    notifIdRef.current = null;
  };

  const onCustomStart = () => {
    const mins = parseFloat(customInput);
    if (!Number.isFinite(mins) || mins <= 0) {
      Alert.alert('Invalid time', 'Enter a positive number of minutes (e.g. 1.5 for 1m 30s).');
      return;
    }
    startCountdown(Math.round(mins * 60));
    setCustomInput('');
  };

  const fmt = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  const isActive = mode !== 'idle';
  const fabLabel =
    mode === 'countdown'
      ? fmt(remaining)
      : mode === 'stopwatch'
      ? fmt(elapsed)
      : null;

  return (
    <>
      <Animated.View
        style={[
          styles.fab,
          { backgroundColor: isActive ? c.tint : bg, borderColor: border, transform: [{ scale: scaleAnim }] },
          { bottom: insets.bottom + 90 },
        ]}>
        <Pressable
          onPress={() => (isActive ? setOpen(true) : setOpen(true))}
          onLongPress={isActive ? stop : undefined}
          hitSlop={6}
          style={styles.fabInner}>
          {fabLabel ? (
            <Text style={[styles.fabTime, { color: isActive ? onTint : c.text }]}>{fabLabel}</Text>
          ) : (
            <Ionicons name="timer-outline" size={24} color={c.text} />
          )}
        </Pressable>
      </Animated.View>

      <Modal
        visible={open}
        animationType="slide"
        transparent
        onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.overlay} onPress={() => setOpen(false)} />
        <View
          style={[
            styles.sheet,
            { backgroundColor: bg, borderTopColor: border, paddingBottom: insets.bottom + 16 },
          ]}>
          <View style={[styles.sheetHandle, { backgroundColor: muted }]} />

          {isActive && (
            <View style={styles.activeRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.activeLabel, { color: muted }]}>
                  {mode === 'countdown' ? 'COUNTDOWN' : 'STOPWATCH'}
                </Text>
                <Text style={[styles.activeTime, { color: c.text }]}>
                  {mode === 'countdown' ? fmt(remaining) : fmt(elapsed)}
                </Text>
              </View>
              <Pressable
                onPress={stop}
                style={({ pressed }) => [
                  styles.stopBtn,
                  { borderColor: border, opacity: pressed ? 0.6 : 1 },
                ]}>
                <Ionicons name="stop" size={18} color={c.text} />
                <Text style={[styles.stopText, { color: c.text }]}>Stop</Text>
              </Pressable>
            </View>
          )}

          <Text style={[styles.sectionLabel, { color: muted }]}>Countdown</Text>
          <View style={styles.presetsRow}>
            {PRESETS.map((p) => (
              <Pressable
                key={p.seconds}
                onPress={() => startCountdown(p.seconds)}
                style={({ pressed }) => [
                  styles.presetBtn,
                  { backgroundColor: c.tint, opacity: pressed ? 0.7 : 1 },
                ]}>
                <Text style={[styles.presetText, { color: onTint }]}>{p.label}</Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.customRow}>
            <TextInput
              style={[styles.customInput, { borderColor: border, color: c.text }]}
              placeholder="Custom (mins)"
              placeholderTextColor={muted}
              keyboardType="decimal-pad"
              value={customInput}
              onChangeText={setCustomInput}
              returnKeyType="go"
              onSubmitEditing={onCustomStart}
            />
            <Pressable
              onPress={onCustomStart}
              style={({ pressed }) => [
                styles.customGoBtn,
                { backgroundColor: c.tint, opacity: pressed ? 0.7 : 1 },
              ]}>
              <Text style={[styles.presetText, { color: onTint }]}>Go</Text>
            </Pressable>
          </View>

          <Text style={[styles.sectionLabel, { color: muted, marginTop: 16 }]}>Stopwatch</Text>
          <Pressable
            onPress={startStopwatch}
            style={({ pressed }) => [
              styles.stopwatchBtn,
              { borderColor: border, opacity: pressed ? 0.6 : 1 },
            ]}>
            <Ionicons name="stopwatch-outline" size={18} color={c.text} />
            <Text style={[styles.stopwatchText, { color: c.text }]}>
              {mode === 'stopwatch' ? `Running — ${fmt(elapsed)}` : 'Start stopwatch'}
            </Text>
          </Pressable>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: 16,
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  fabInner: { alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' },
  fabTime: { fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'] },
  overlay: { flex: 1 },
  sheet: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
    opacity: 0.4,
  },
  activeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 16,
  },
  activeLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.6, marginBottom: 2 },
  activeTime: { fontSize: 36, fontWeight: '700', fontVariant: ['tabular-nums'] },
  stopBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderRadius: 10,
  },
  stopText: { fontWeight: '600' },
  sectionLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.6, marginBottom: 10 },
  presetsRow: { flexDirection: 'row', gap: 8, marginBottom: 10, flexWrap: 'wrap' },
  presetBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  presetText: { fontSize: 14, fontWeight: '700' },
  customRow: { flexDirection: 'row', gap: 8 },
  customInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  customGoBtn: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 10, justifyContent: 'center' },
  stopwatchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  stopwatchText: { fontSize: 15, fontWeight: '500' },
});
