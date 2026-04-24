import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from './supabase';

export type ChatMessage = { role: 'user' | 'assistant'; content: string };

export async function askCoach(messages: ChatMessage[]): Promise<string> {
  const { data, error } = await supabase.functions.invoke('coach', {
    body: { messages },
  });

  if (error) {
    if (error instanceof FunctionsHttpError) {
      const body = await error.context.json().catch(() => null);
      throw new Error(body?.error ?? error.message);
    }
    throw new Error(error.message ?? String(error));
  }
  if (data?.error) throw new Error(data.error);
  return data.reply as string;
}
