export const runtime = 'nodejs'

export async function POST(req: Request) {
  try {
    const { imageBase64 } = await req.json()

    if (!imageBase64) {
      return Response.json({ error: 'No image provided' }, { status: 400 })
    }

    const systemPrompt = `You are an expert Japanese language OCR and furigana annotation system.
When given an image containing Japanese text, you MUST:
1. Extract ALL Japanese text visible in the image (kanji, hiragana, katakana, romaji mixed).
2. Break the text into meaningful segments (words or phrases).
3. For EVERY segment containing kanji, provide accurate furigana (hiragana reading above kanji).
4. Provide the romaji (romanization) for each segment.
5. Provide the English meaning/translation for each segment.
6. Provide the overall English translation of the full detected text.

Respond ONLY with valid JSON in this exact format:
{
  "detected_text": "full Japanese text as-is",
  "segments": [
    {
      "kanji": "word or phrase (original Japanese)",
      "furigana": "hiragana reading",
      "romaji": "romanized reading",
      "meaning": "English meaning",
      "type": "kanji|hiragana|katakana|mixed"
    }
  ],
  "translation": "Full English translation",
  "language_notes": "Brief grammar or cultural note (optional)"
}
If no Japanese text is found, return: {"detected_text": "", "segments": [], "translation": "No Japanese text detected", "language_notes": ""}`

    const messages = [
      {
        role: 'system',
        content: systemPrompt,
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Please analyze this image and extract all Japanese text with furigana annotations.',
          },
          {
            type: 'image_url',
            image_url: {
              url: imageBase64.startsWith('data:')
                ? imageBase64
                : `data:image/jpeg;base64,${imageBase64}`,
            },
          },
        ],
      },
    ]

    const response = await fetch('https://llm.blackbox.ai/chat/completions', {
      method: 'POST',
      headers: {
        'customerId': 'cus_TpfU5m1j5W06kc',
        'Content-Type': 'application/json',
        'Authorization': 'Bearer xxx',
      },
      body: JSON.stringify({
        model: 'openai/gpt-4o-mini',
        messages,
        max_tokens: 2048,
      }),
      signal: AbortSignal.timeout(60000),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[v0] AI API error:', response.status, errorText)
      return Response.json(
        { error: `AI service error: ${response.status}` },
        { status: 500 }
      )
    }

    const data = await response.json()
    const content = data?.choices?.[0]?.message?.content

    if (!content) {
      return Response.json({ error: 'Empty response from AI' }, { status: 500 })
    }

    // Parse JSON from the AI response
    let parsed
    try {
      // Extract JSON if it's wrapped in markdown code blocks
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || 
                        content.match(/(\{[\s\S]*\})/)
      const jsonStr = jsonMatch ? jsonMatch[1] || jsonMatch[0] : content
      parsed = JSON.parse(jsonStr.trim())
    } catch (e) {
      console.error('[v0] JSON parse error:', e, 'Content:', content)
      return Response.json({ error: 'Failed to parse AI response', raw: content }, { status: 500 })
    }

    return Response.json(parsed)
  } catch (error: unknown) {
    console.error('[v0] Scan kanji error:', error)
    const message = error instanceof Error ? error.message : 'Internal server error'
    return Response.json({ error: message }, { status: 500 })
  }
}
