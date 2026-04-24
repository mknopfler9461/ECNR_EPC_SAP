export const runtime = 'nodejs';

const GEMINI_MODEL = 'gemini-2.5-flash';

export async function POST(request) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return Response.json(
      { error: 'Missing GEMINI_API_KEY environment variable.' },
      { status: 500 }
    );
  }

  const { prompt, systemInstruction } = await request.json();

  if (!prompt || typeof prompt !== 'string') {
    return Response.json({ error: 'Prompt is required.' }, { status: 400 });
  }

  const payload = {
    contents: [{ parts: [{ text: prompt }] }],
  };

  if (systemInstruction) {
    payload.systemInstruction = { parts: [{ text: systemInstruction }] };
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }
  );

  if (!response.ok) {
    const message = await response.text();
    return Response.json(
      { error: 'Gemini request failed.', detail: message },
      { status: response.status }
    );
  }

  const result = await response.json();
  const text =
    result.candidates?.[0]?.content?.parts?.[0]?.text ||
    '抱歉，由于未知原因未能生成内容。';

  return Response.json({ text });
}
