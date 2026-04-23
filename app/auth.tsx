import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { supabase } from '@/src/lib/supabase';
import { ensureProfile } from '@/src/features/profile/seedProfile';

type Mode = 'signin' | 'signup';

export default function AuthScreen() {
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!email || !password) {
      Alert.alert('Missing fields', 'Enter an email and password.');
      return;
    }
    setLoading(true);
    try {
      if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        if (data.user && data.session) {
          await ensureProfile(data.user.id);
        } else if (data.user && !data.session) {
          Alert.alert(
            'Check your email',
            'Confirm your email address, then sign in. (Or disable email confirmation in Supabase → Authentication → Providers → Email.)'
          );
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        if (data.user) await ensureProfile(data.user.id);
      }
    } catch (e: any) {
      Alert.alert('Auth error', e.message ?? String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.inner}>
        <Text style={styles.title}>HealthMaxx</Text>
        <Text style={styles.subtitle}>{mode === 'signin' ? 'Sign in' : 'Create account'}</Text>

        <TextInput
          style={styles.input}
          placeholder="email"
          placeholderTextColor="#888"
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
          editable={!loading}
        />
        <TextInput
          style={styles.input}
          placeholder="password"
          placeholderTextColor="#888"
          autoCapitalize="none"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          editable={!loading}
        />

        <Pressable
          style={({ pressed }) => [styles.button, pressed && { opacity: 0.7 }]}
          onPress={submit}
          disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>{mode === 'signin' ? 'Sign in' : 'Sign up'}</Text>
          )}
        </Pressable>

        <Pressable
          onPress={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
          disabled={loading}>
          <Text style={styles.switchMode}>
            {mode === 'signin' ? 'Need an account? Sign up' : 'Have an account? Sign in'}
          </Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  inner: { flex: 1, padding: 24, justifyContent: 'center' },
  title: { fontSize: 36, fontWeight: '700', marginBottom: 4 },
  subtitle: { fontSize: 18, opacity: 0.6, marginBottom: 32 },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
    fontSize: 16,
    color: '#000',
    backgroundColor: '#fff',
  },
  button: {
    backgroundColor: '#0a7ea4',
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  switchMode: { textAlign: 'center', marginTop: 16, color: '#0a7ea4', fontSize: 14 },
});
