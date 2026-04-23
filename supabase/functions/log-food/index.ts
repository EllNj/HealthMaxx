import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS });
  }

  try {
    const apiKey = Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) throw new Error('GEMINI_API_KEY not configured');

    const body = await req.json();
    const { description, imageBase64, useWebSearch = false } = body as {
      description?: string;
      imageBase64?: string;
      useWebSearch?: boolean;
    };

    if (!description && !imageBase64) {
      return new Response(JSON.stringify({ error: 'Provide description or imageBase64' }), {
        status: 400,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    const jsonSchema = `{"items":[{"name":"string","qty":"string","calories":0,"protein_g":0,"carbs_g":0,"fat_g":0}],"total":{"calories":0,"protein_g":0,"carbs_g":0,"fat_g":0},"confidence":0.9,"notes":"string"}`;

    const prompt = `You are a precise nutrition assistant. Analyse the food described or shown and return ONLY a valid JSON object (no markdown, no extra text) matching this shape:
${jsonSchema}
Rules: all macros in grams, calories as kcal integers, confidence 0.0–1.0. Assume a typical single serving if portions are unclear.`;

    const searchInstruction = useWebSearch
      ? ' Use Google Search to look up accurate nutrition data for any branded, packaged, or restaurant items before answering.'
      : '';

    const parts: object[] = [];
    if (description) parts.push({ text: `${prompt}${searchInstruction}\n\nFood: ${description}` });
    if (imageBase64) {
      if (!description) parts.push({ text: prompt });
      parts.push({ inlineData: { mimeType: 'image/jpeg', data: imageBase64 } });
    }

    const geminiBody: Record<string, unknown> = {
      contents: [{ role: 'user', parts }],
      generationConfig: {
        temperature: 0.1,
      },
    };

    if (useWebSearch) {
      geminiBody.tools = [{ googleSearch: {} }];
    }

    const geminiRes = await fetch(`${GEMINI_BASE}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(geminiBody),
    });

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      throw new Error(`Gemini API error ${geminiRes.status}: ${errText}`);
    }

    const geminiData = await geminiRes.json();

    // Thinking models return multiple parts — find the non-thought part
    const responseParts: { text?: string; thought?: boolean }[] =
      geminiData?.candidates?.[0]?.content?.parts ?? [];
    const answerPart = responseParts.find((p) => !p.thought) ?? responseParts[0];
    let rawText: string = answerPart?.text ?? '';

    if (!rawText) throw new Error('Gemini returned an empty response');

    // Strip markdown fences (anywhere in response)
    rawText = rawText.replace(/```json?\s*/gi, '').replace(/```/g, '').trim();
    // Extract the outermost JSON object (greedy match from first { to last })
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (jsonMatch) rawText = jsonMatch[0].trim();

    let parsed: {
      items: { name: string; qty: string; calories: number; protein_g: number; carbs_g: number; fat_g: number }[];
      total: { calories: number; protein_g: number; carbs_g: number; fat_g: number };
      confidence: number;
      notes: string;
    };

    try {
      parsed = JSON.parse(rawText);
    } catch {
      throw new Error(`Failed to parse Gemini JSON: ${rawText.slice(0, 400)}`);
    }

    if (!parsed.total) {
      parsed.total = parsed.items.reduce(
        (acc, item) => ({
          calories: acc.calories + (item.calories ?? 0),
          protein_g: acc.protein_g + (item.protein_g ?? 0),
          carbs_g: acc.carbs_g + (item.carbs_g ?? 0),
          fat_g: acc.fat_g + (item.fat_g ?? 0),
        }),
        { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }
      );
    }

    return new Response(JSON.stringify({ ...parsed, _gemini_raw: geminiData }), {
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
