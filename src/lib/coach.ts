import { supabase } from './supabase';

const FUNCTION_URL = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/coach`;
const ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export type ChatMessage = { role: 'user' | 'assistant'; content: string };

export async function askCoach(messages: ChatMessage[]): Promise<string> {
  // getUser() validates the JWT server-side and refreshes it if stale
  await supabase.auth.getUser();
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token ?? ANON_KEY;

  const res = await fetch(FUNCTION_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ messages }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data?.error ?? `Coach error ${res.status}`);
  if (data?.error) throw new Error(data.error);
  return data.reply as string;
}
