import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type Message = { role: 'user' | 'assistant'; content: string };

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const apiKey = Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) throw new Error('GEMINI_API_KEY not configured');

    const authHeader = req.headers.get('authorization') ?? '';
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Verify JWT using service-role client with the raw token
    const token = authHeader.replace(/^Bearer\s+/i, '');
    const db = createClient(supabaseUrl, serviceKey);
    const { data: { user }, error: authErr } = await db.auth.getUser(token);
    if (authErr || !user) throw new Error('Unauthorised');

    const body = await req.json() as { messages: Message[] };
    const messages = body.messages ?? [];
    if (messages.length === 0) throw new Error('No messages provided');
    const userId = user.id;

    // ── Build context ──────────────────────────────────────────────
    // Profile
    const { data: profile } = await db
      .from('profiles')
      .select('height_cm,weight_kg,body_fat_pct,skeletal_muscle_kg,tee_kcal,calorie_goal,protein_goal_g,carbs_goal_g,fat_goal_g')
      .eq('id', userId)
      .maybeSingle();

    // Body weight: latest + trend
    const { data: weightLogs } = await db
      .from('body_weight_logs')
      .select('weight_kg,logged_date')
      .eq('user_id', userId)
      .order('logged_date', { ascending: false })
      .limit(14);

    // Recent workout sessions (last 8)
    const { data: sessions } = await db
      .from('workout_sessions')
      .select('id,name,started_at,ended_at')
      .eq('user_id', userId)
      .not('ended_at', 'is', null)
      .order('started_at', { ascending: false })
      .limit(8);

    // Sets for those sessions
    let sessionContext = '';
    if (sessions && sessions.length > 0) {
      const sessionIds = sessions.map((s: any) => s.id);
      const { data: sets } = await db
        .from('workout_sets')
        .select('session_id,exercise_id,set_number,reps,weight_kg,is_warmup')
        .in('session_id', sessionIds)
        .eq('is_warmup', false)
        .order('completed_at', { ascending: true });

      // Exercise names
      const exerciseIds = [...new Set((sets ?? []).map((s: any) => s.exercise_id))];
      const { data: exercises } = await db
        .from('exercises')
        .select('id,name,muscle_group')
        .in('id', exerciseIds);
      const exMap: Record<string, { name: string; muscle_group: string | null }> = {};
      for (const e of exercises ?? []) exMap[e.id] = e;

      // Group sets by session
      const setsBySession: Record<string, any[]> = {};
      for (const s of sets ?? []) {
        if (!setsBySession[s.session_id]) setsBySession[s.session_id] = [];
        setsBySession[s.session_id].push(s);
      }

      sessionContext = sessions.map((sess: any) => {
        const d = new Date(sess.started_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
        const sessSets = setsBySession[sess.id] ?? [];
        // Group by exercise
        const byEx: Record<string, any[]> = {};
        for (const s of sessSets) {
          const exId = s.exercise_id;
          if (!byEx[exId]) byEx[exId] = [];
          byEx[exId].push(s);
        }
        const exLines = Object.entries(byEx).map(([exId, exSets]) => {
          const name = exMap[exId]?.name ?? 'Unknown';
          const summary = exSets.map((s) => `${s.reps}×${s.weight_kg}kg`).join(', ');
          return `    ${name}: ${summary}`;
        }).join('\n');
        return `${d} — ${sess.name ?? 'Workout'}\n${exLines}`;
      }).join('\n\n');
    }

    // PRs
    const { data: prs } = await db
      .from('v_exercise_prs')
      .select('exercise_id,max_weight_kg,max_est_1rm_epley')
      .eq('user_id', userId)
      .order('max_weight_kg', { ascending: false })
      .limit(15);

    let prContext = '';
    if (prs && prs.length > 0) {
      const prExIds = prs.map((p: any) => p.exercise_id);
      const { data: prEx } = await db.from('exercises').select('id,name').in('id', prExIds);
      const prExMap: Record<string, string> = {};
      for (const e of prEx ?? []) prExMap[e.id] = e.name;
      prContext = prs.map((p: any) =>
        `${prExMap[p.exercise_id] ?? 'Unknown'}: ${p.max_weight_kg}kg max, est 1RM ${p.max_est_1rm_epley ? Math.round(p.max_est_1rm_epley) + 'kg' : 'N/A'}`
      ).join('\n');
    }

    // Nutrition: last 7 days
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 6);
    const cutoffStr = cutoff.toISOString().slice(0, 10);
    const { data: foodEntries } = await db
      .from('food_entries')
      .select('logged_for_date,calories,protein_g,carbs_g,fat_g')
      .eq('user_id', userId)
      .gte('logged_for_date', cutoffStr);

    let nutritionContext = '';
    if (foodEntries && foodEntries.length > 0) {
      const byDay: Record<string, { cal: number; p: number; c: number; f: number; n: number }> = {};
      for (const e of foodEntries) {
        const d = e.logged_for_date;
        if (!byDay[d]) byDay[d] = { cal: 0, p: 0, c: 0, f: 0, n: 0 };
        byDay[d].cal += e.calories;
        byDay[d].p += e.protein_g;
        byDay[d].c += e.carbs_g;
        byDay[d].f += e.fat_g;
        byDay[d].n++;
      }
      const days = Object.entries(byDay).sort(([a], [b]) => a.localeCompare(b));
      const avgCal = Math.round(days.reduce((s, [, d]) => s + d.cal, 0) / days.length);
      const avgP = Math.round(days.reduce((s, [, d]) => s + d.p, 0) / days.length);
      nutritionContext = `7-day average: ${avgCal} kcal, ${avgP}g protein\n` +
        days.map(([date, d]) => `  ${date}: ${Math.round(d.cal)} kcal, ${Math.round(d.p)}g P, ${Math.round(d.c)}g C, ${Math.round(d.f)}g F`).join('\n');
    }

    // Body weight trend
    const weightContext = (weightLogs ?? []).map((l: any) =>
      `${l.logged_date}: ${l.weight_kg}kg`
    ).reverse().join(', ');

    // ── Compose system prompt ──────────────────────────────────────
    const systemPrompt = `You are a knowledgeable, encouraging personal fitness coach helping a user with their training and nutrition. Be specific, practical, and concise. Use their actual data when answering.

USER PROFILE:
- Height: ${profile?.height_cm ?? 187}cm
- Goals: ${profile?.calorie_goal ?? 3000} kcal/day, ${profile?.protein_goal_g ?? 200}g protein, ${profile?.carbs_goal_g ?? 340}g carbs, ${profile?.fat_goal_g ?? 90}g fat
- TEE: ${profile?.tee_kcal ?? 2821} kcal
- Body fat: ${profile?.body_fat_pct ?? 23.8}%

RECENT BODY WEIGHT:
${weightContext || 'No logs yet'}

RECENT WORKOUTS:
${sessionContext || 'No completed workouts yet'}

TOP LIFTS (PRs):
${prContext || 'No PRs recorded yet'}

NUTRITION (last 7 days):
${nutritionContext || 'No food entries yet'}`;

    // ── Call Gemini ────────────────────────────────────────────────
    const contents = messages.map((m) => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.content }],
    }));

    const geminiRes = await fetch(`${GEMINI_BASE}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents,
        generationConfig: { temperature: 0.7, maxOutputTokens: 4096 },
      }),
    });

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      throw new Error(`Gemini error ${geminiRes.status}: ${errText.slice(0, 200)}`);
    }

    const geminiData = await geminiRes.json();
    const responseParts: { text?: string; thought?: boolean }[] =
      geminiData?.candidates?.[0]?.content?.parts ?? [];
    const answerPart = responseParts.find((p) => !p.thought) ?? responseParts[0];
    const reply = answerPart?.text?.trim() ?? 'Sorry, I could not generate a response.';

    return new Response(JSON.stringify({ reply }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
});
