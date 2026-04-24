import { Ionicons } from '@expo/vector-icons';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors } from '@/constants/theme';
import { askCoach, type ChatMessage } from '@/src/lib/coach';

const STARTER_PROMPTS = [
  'How is my training progressing?',
  'Am I hitting my nutrition goals?',
  'Suggest my next Push session weights',
  'Why might my bench be plateauing?',
];

export default function CoachScreen() {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const border = scheme === 'dark' ? '#2a2d30' : '#e3e5e8';
  const muted = scheme === 'dark' ? '#9BA1A6' : '#687076';
  const cardBg = scheme === 'dark' ? '#1f2224' : '#f1f3f5';
  const onTint = scheme === 'dark' ? '#000' : '#fff';
  const userBubble = c.tint;
  const aiBubble = cardBg;
  const insets = useSafeAreaInsets();

  const tabBarHeight = useBottomTabBarHeight();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const listRef = useRef<FlatList>(null);

  const scrollToEnd = () => {
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
  };

  useEffect(() => {
    if (messages.length > 0) scrollToEnd();
  }, [messages.length]);

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;
    setInput('');

    const next: ChatMessage[] = [...messages, { role: 'user', content: trimmed }];
    setMessages(next);
    setLoading(true);
    try {
      const reply = await askCoach(next);
      setMessages([...next, { role: 'assistant', content: reply }]);
    } catch (e: any) {
      Alert.alert('Coach unavailable', e.message ?? String(e));
      setMessages(next);
    } finally {
      setLoading(false);
    }
  };

  const onClear = () => {
    Alert.alert('Clear conversation?', 'This will erase the current chat history.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: () => setMessages([]) },
    ]);
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: c.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={tabBarHeight}>

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8, borderBottomColor: border }]}>
        <View>
          <Text style={[styles.title, { color: c.text }]}>AI Coach</Text>
          <Text style={[styles.subtitle, { color: muted }]}>Powered by Gemini · knows your data</Text>
        </View>
        {messages.length > 0 && (
          <Pressable onPress={onClear} hitSlop={10} style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}>
            <Ionicons name="trash-outline" size={20} color={muted} />
          </Pressable>
        )}
      </View>

      {/* Messages */}
      {messages.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={[styles.coachAvatar, { backgroundColor: scheme === 'dark' ? '#1a2a40' : '#e8f0ff' }]}>
            <Ionicons name="sparkles" size={28} color={c.tint} />
          </View>
          <Text style={[styles.emptyTitle, { color: c.text }]}>Ask me anything</Text>
          <Text style={[styles.emptySubtitle, { color: muted }]}>
            I have access to your workouts, nutrition, body weight, and PRs.
          </Text>
          <View style={styles.starterGrid}>
            {STARTER_PROMPTS.map((p) => (
              <Pressable
                key={p}
                onPress={() => send(p)}
                style={({ pressed }) => [
                  styles.starterChip,
                  { backgroundColor: cardBg, borderColor: border, opacity: pressed ? 0.7 : 1 },
                ]}>
                <Text style={[styles.starterText, { color: c.text }]}>{p}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(_, i) => String(i)}
          contentContainerStyle={{ padding: 16, paddingBottom: 8 }}
          renderItem={({ item }) => (
            <View
              style={[
                styles.bubble,
                item.role === 'user'
                  ? [styles.userBubble, { backgroundColor: userBubble }]
                  : [styles.aiBubble, { backgroundColor: aiBubble, borderColor: border }],
              ]}>
              {item.role === 'assistant' && (
                <Ionicons name="sparkles" size={13} color={c.tint} style={styles.aiIcon} />
              )}
              <Text
                style={[
                  styles.bubbleText,
                  { color: item.role === 'user' ? onTint : c.text },
                ]}>
                {item.content}
              </Text>
            </View>
          )}
        />
      )}

      {/* Typing indicator */}
      {loading && (
        <View style={[styles.typingRow, { backgroundColor: aiBubble, borderColor: border }]}>
          <Ionicons name="sparkles" size={13} color={c.tint} />
          <ActivityIndicator size="small" color={muted} style={{ marginLeft: 8 }} />
        </View>
      )}

      {/* Input bar */}
      <View
        style={[
          styles.inputBar,
          { borderTopColor: border, paddingBottom: Math.max(insets.bottom, 12) },
        ]}>
        <TextInput
          style={[styles.input, { backgroundColor: cardBg, borderColor: border, color: c.text }]}
          placeholder="Ask your coach…"
          placeholderTextColor={muted}
          value={input}
          onChangeText={setInput}
          multiline
          returnKeyType="send"
          blurOnSubmit
          onSubmitEditing={() => send(input)}
        />
        <Pressable
          onPress={() => send(input)}
          disabled={!input.trim() || loading}
          style={({ pressed }) => [
            styles.sendBtn,
            {
              backgroundColor: input.trim() && !loading ? c.tint : (scheme === 'dark' ? '#2a2d30' : '#e0e0e0'),
              opacity: pressed ? 0.7 : 1,
            },
          ]}>
          <Ionicons name="arrow-up" size={18} color={input.trim() && !loading ? onTint : muted} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: { fontSize: 28, fontWeight: '700' },
  subtitle: { fontSize: 12, marginTop: 2 },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  coachAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: { fontSize: 20, fontWeight: '700', marginBottom: 8 },
  emptySubtitle: { fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  starterGrid: { gap: 10, width: '100%' },
  starterChip: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  starterText: { fontSize: 14, fontWeight: '500' },
  bubble: {
    maxWidth: '85%',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 10,
  },
  userBubble: { alignSelf: 'flex-end', borderBottomRightRadius: 4 },
  aiBubble: { alignSelf: 'flex-start', borderWidth: 1, borderBottomLeftRadius: 4 },
  aiIcon: { marginBottom: 4 },
  bubbleText: { fontSize: 15, lineHeight: 22 },
  typingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginLeft: 16,
    marginBottom: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    maxHeight: 120,
  },
  sendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
