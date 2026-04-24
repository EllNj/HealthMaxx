import { supabase } from './supabase';

export type ChatMessage = { role: 'user' | 'assistant'; content: string };

export async function askCoach(messages: ChatMessage[]): Promise<string> {
  const { data, error } = await supabase.functions.invoke('coach', {
    body: { messages },
  });

  if (error) throw new Error(error.message ?? String(error));
  if (data?.error) throw new Error(data.error);
  return data.reply as string;
}
