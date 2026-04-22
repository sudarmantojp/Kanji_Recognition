'use client'

// Google Cloud Vision API key — KanjiRecognition project
const VISION_API_KEY = 'AIzaSyBCuS9yn4GbIvIu2iEpArOzfVvzac-G5K8'
const VISION_URL = `https://vision.googleapis.com/v1/images:annotate?key=${VISION_API_KEY}`

// Blackbox AI endpoint for furigana + translation
const AI_ENDPOINT = 'https://llm.blackbox.ai/chat/completions'

export interface Segment {
  kanji: string
  furigana: string
  romaji: string
  meaning: string
  type: string
}

export interface ScanResult {
  detected_text: string
  segments: Segment[]
  translation: string
  language_notes?: string
  annotatedImage?: string
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function dataUrlToBase64(dataUrl: string): string {
  return dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl
}

async function resizeIfNeeded(dataUrl: string, maxB64Bytes = 3_800_000): Promise<string> {
  const b64 = dataUrlToBase64(dataUrl)
  if (b64.length <= maxB64Bytes) return dataUrl
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const ratio = Math.sqrt(maxB64Bytes / b64.length)
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.naturalWidth * ratio)
      canvas.height = Math.round(img.naturalHeight * ratio)
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
      resolve(canvas.toDataURL('image/jpeg', 0.88))
    }
    img.onerror = () => resolve(dataUrl)
    img.src = dataUrl
  })
}

// ── Romaji conversion table (Hepburn) ─────────────────────────────────────────
const HIRAGANA_ROMAJI: Record<string, string> = {
  'あ':'a','い':'i','う':'u','え':'e','お':'o',
  'か':'ka','き':'ki','く':'ku','け':'ke','こ':'ko',
  'が':'ga','ぎ':'gi','ぐ':'gu','げ':'ge','ご':'go',
  'さ':'sa','し':'shi','す':'su','せ':'se','そ':'so',
  'ざ':'za','じ':'ji','ず':'zu','ぜ':'ze','ぞ':'zo',
  'た':'ta','ち':'chi','つ':'tsu','て':'te','と':'to',
  'だ':'da','ぢ':'ji','づ':'zu','で':'de','ど':'do',
  'な':'na','に':'ni','ぬ':'nu','ね':'ne','の':'no',
  'は':'ha','ひ':'hi','ふ':'fu','へ':'he','ほ':'ho',
  'ば':'ba','び':'bi','ぶ':'bu','べ':'be','ぼ':'bo',
  'ぱ':'pa','ぴ':'pi','ぷ':'pu','ぺ':'pe','ぽ':'po',
  'ま':'ma','み':'mi','む':'mu','め':'me','も':'mo',
  'や':'ya','ゆ':'yu','よ':'yo',
  'ら':'ra','り':'ri','る':'ru','れ':'re','ろ':'ro',
  'わ':'wa','を':'wo','ん':'n',
  'きゃ':'kya','きゅ':'kyu','きょ':'kyo',
  'しゃ':'sha','しゅ':'shu','しょ':'sho',
  'ちゃ':'cha','ちゅ':'chu','ちょ':'cho',
  'にゃ':'nya','にゅ':'nyu','にょ':'nyo',
  'ひゃ':'hya','ひゅ':'hyu','ひょ':'hyo',
  'みゃ':'mya','みゅ':'myu','みょ':'myo',
  'りゃ':'rya','りゅ':'ryu','りょ':'ryo',
  'ぎゃ':'gya','ぎゅ':'gyu','ぎょ':'gyo',
  'じゃ':'ja','じゅ':'ju','じょ':'jo',
  'びゃ':'bya','びゅ':'byu','びょ':'byo',
  'ぴゃ':'pya','ぴゅ':'pyu','ぴょ':'pyo',
  'っ':'','ー':'-',
}

function hiraganaToRomaji(str: string): string {
  let result = ''
  let i = 0
  while (i < str.length) {
    const two = str.slice(i, i + 2)
    const one = str[i]
    if (HIRAGANA_ROMAJI[two] !== undefined) { result += HIRAGANA_ROMAJI[two]; i += 2 }
    else if (HIRAGANA_ROMAJI[one] !== undefined) { result += HIRAGANA_ROMAJI[one]; i++ }
    else { result += one; i++ }
  }
  return result
}

function katakanaToHiragana(str: string): string {
  return str.replace(/[\u30A1-\u30F6]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0x60)
  )
}

function detectType(str: string): string {
  const hasKanji = /[\u4E00-\u9FFF\u3400-\u4DBF]/.test(str)
  const hasHira  = /[\u3040-\u309F]/.test(str)
  const hasKata  = /[\u30A0-\u30FF]/.test(str)
  if (hasKanji && (hasHira || hasKata)) return 'mixed'
  if (hasKanji) return 'kanji'
  if (hasKata)  return 'katakana'
  return 'hiragana'
}

// ── Client-side furigana via kuromoji (loaded dynamically from CDN) ──────────
type KuromojiToken = { surface_form: string; reading?: string; basic_form?: string }
type KuromojiTokenizer = { tokenize: (text: string) => KuromojiToken[] }
type KuromojiWindow = Window & {
  kuromoji?: {
    builder: (opts: { dicPath: string }) => {
      build: (cb: (err: unknown, t: KuromojiTokenizer) => void) => void
    }
  }
}

const KUROMOJI_DICT = 'https://cdn.jsdelivr.net/npm/kuromoji@0.1.2/dict/'
let kuromojiTokenizer: KuromojiTokenizer | null = null
let kuromojiInitPromise: Promise<KuromojiTokenizer | null> | null = null

function buildKuromojiTokenizer(): Promise<KuromojiTokenizer | null> {
  // Return existing promise if already initializing
  if (kuromojiInitPromise) return kuromojiInitPromise

  kuromojiInitPromise = new Promise<KuromojiTokenizer | null>((resolve) => {
    const tryInit = (attempts = 0) => {
      const k = (window as KuromojiWindow).kuromoji
      if (!k) {
        // CDN script not yet loaded — retry up to 20 times (10s total)
        if (attempts < 20) {
          setTimeout(() => tryInit(attempts + 1), 500)
        } else {
          resolve(null)
        }
        return
      }
      k.builder({ dicPath: KUROMOJI_DICT }).build((err, tokenizer) => {
        if (err) { resolve(null); return }
        kuromojiTokenizer = tokenizer
        resolve(tokenizer)
      })
    }
    tryInit()
  })

  return kuromojiInitPromise
}

async function getKuromojiTokenizer(): Promise<KuromojiTokenizer | null> {
  if (kuromojiTokenizer) return kuromojiTokenizer
  return buildKuromojiTokenizer()
}

// Pre-initialize kuromoji as soon as this module is imported (non-blocking)
if (typeof window !== 'undefined') {
  setTimeout(() => buildKuromojiTokenizer(), 100)
}

function buildSegmentsFromTokens(tokens: KuromojiToken[]): Segment[] {
  return tokens
    .filter((t) => t.surface_form.trim())
    .map((t) => {
      const surface  = t.surface_form
      const reading  = t.reading ? katakanaToHiragana(t.reading) : surface
      const type     = detectType(surface)
      const furigana = (type === 'kanji' || type === 'mixed') ? reading : ''
      const romaji   = hiraganaToRomaji(reading)
      return {
        kanji:   surface,
        furigana,
        romaji,
        meaning: (t.basic_form && t.basic_form !== '*') ? t.basic_form : surface,
        type,
      }
    })
}

// ── AI furigana (primary) ─────────────────────────────────────────────────────
async function getAIFurigana(text: string): Promise<Segment[] | null> {
  const systemPrompt = `You are a Japanese linguistics expert. Given Japanese text, respond ONLY with a JSON array of segments — no markdown, no explanation, no wrapper object. Format:
[
  { "kanji": "token", "furigana": "hiragana reading (empty string if no kanji)", "romaji": "hepburn romaji", "meaning": "English gloss", "type": "kanji|hiragana|katakana|mixed" }
]
Rules:
- Split into meaningful morphemes (words/particles)
- furigana: hiragana reading ONLY for kanji/mixed tokens; empty string otherwise
- romaji: Hepburn system, lower-case
- meaning: concise English word gloss
- type: "kanji" if only kanji chars, "mixed" if kanji+kana, "hiragana" if only hiragana, "katakana" if only katakana`

  try {
    const res = await fetch(AI_ENDPOINT, {
      method: 'POST',
      headers: {
        'customerId': 'cus_TpfU5m1j5W06kc',
        'Content-Type': 'application/json',
        'Authorization': 'Bearer xxx',
      },
      body: JSON.stringify({
        model: 'openai/gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: text },
        ],
        max_tokens: 2048,
        temperature: 0,
      }),
    })

    if (!res.ok) return null
    const data = await res.json()
    const content: string = data?.choices?.[0]?.message?.content?.trim() || ''

    // Strip markdown code fences if present
    const cleaned = content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/,'').trim()

    // Parse — could be array or { segments: [...] }
    let parsed: unknown = null
    try { parsed = JSON.parse(cleaned) } catch { return null }

    if (Array.isArray(parsed)) {
      return (parsed as Segment[]).filter((s) => s && s.kanji)
    }
    if (parsed && typeof parsed === 'object' && Array.isArray((parsed as { segments?: Segment[] }).segments)) {
      return ((parsed as { segments: Segment[] }).segments).filter((s) => s && s.kanji)
    }
    return null
  } catch {
    return null
  }
}

// ── AI translation ────────────────────────────────────────────────────────────
async function getAITranslation(text: string): Promise<{ translation: string; notes: string }> {
  try {
    const res = await fetch(AI_ENDPOINT, {
      method: 'POST',
      headers: {
        'customerId': 'cus_TpfU5m1j5W06kc',
        'Content-Type': 'application/json',
        'Authorization': 'Bearer xxx',
      },
      body: JSON.stringify({
        model: 'openai/gpt-4o-mini',
        messages: [
          { role: 'system', content: 'Translate the Japanese text to English. Reply ONLY with a JSON object: {"translation":"...","notes":"brief grammar note"}. No markdown.' },
          { role: 'user', content: text },
        ],
        max_tokens: 512,
        temperature: 0,
      }),
    })
    if (!res.ok) throw new Error()
    const data = await res.json()
    const content = (data?.choices?.[0]?.message?.content || '').trim()
    const cleaned = content.replace(/^```(?:json)?\s*/i,'').replace(/\s*```\s*$/,'').trim()
    const parsed = JSON.parse(cleaned) as { translation?: string; notes?: string }
    return {
      translation: parsed.translation || text,
      notes: parsed.notes || '',
    }
  } catch {
    // MyMemory free fallback
    try {
      const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text.slice(0, 500))}&langpair=ja|en`
      const r = await fetch(url)
      const d = await r.json()
      return { translation: d?.responseData?.translatedText || text, notes: '' }
    } catch {
      return { translation: text, notes: '' }
    }
  }
}

// ── Burn text overlay onto image ──────────────────────────────────────────────
async function burnOverlay(
  originalDataUrl: string,
  annotations: Array<{ text: string; vertices: Array<{ x?: number; y?: number }> }>,
  readyDataUrl: string
): Promise<string> {
  return new Promise((resolve) => {
    const orig = new Image()
    orig.onload = () => {
      const ready = new Image()
      ready.onload = () => {
        const W = orig.naturalWidth
        const H = orig.naturalHeight
        const scaleX = W / ready.naturalWidth
        const scaleY = H / ready.naturalHeight

        const canvas = document.createElement('canvas')
        canvas.width = W
        canvas.height = H
        const ctx = canvas.getContext('2d')!
        ctx.drawImage(orig, 0, 0)

        const jpRe = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF\u3400-\u4DBF]/

        annotations.forEach(({ text, vertices }) => {
          if (!text.trim() || !jpRe.test(text)) return
          const xs = vertices.map((v) => (v.x || 0) * scaleX)
          const ys = vertices.map((v) => (v.y || 0) * scaleY)
          const x0 = Math.min(...xs), y0 = Math.min(...ys)
          const x1 = Math.max(...xs), y1 = Math.max(...ys)
          const bw = x1 - x0, bh = y1 - y0
          if (bw < 6 || bh < 6) return

          const pad    = Math.max(4, bh * 0.15)
          const radius = Math.min(10, (bh + pad * 2) * 0.35)
          const fontSize = Math.max(12, Math.min(bh * 0.78, 32))

          ctx.save()
          ctx.fillStyle   = 'rgba(255,255,255,0.95)'
          ctx.strokeStyle = 'rgba(79,70,229,0.85)'
          ctx.lineWidth   = Math.max(2, bh * 0.06)
          ctx.shadowColor = 'rgba(0,0,0,0.22)'
          ctx.shadowBlur  = 5
          ctx.beginPath();
          (ctx as CanvasRenderingContext2D & { roundRect: (...a: unknown[]) => void })
            .roundRect(x0 - pad, y0 - pad, bw + pad * 2, bh + pad * 2, radius)
          ctx.fill()
          ctx.shadowBlur = 0
          ctx.stroke()

          ctx.fillStyle    = '#1e1b4b'
          ctx.font         = `700 ${fontSize}px "Noto Sans JP","Yu Gothic",sans-serif`
          ctx.textAlign    = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText(text, x0 + bw / 2, y0 + bh / 2)
          ctx.restore()
        })

        resolve(canvas.toDataURL('image/jpeg', 0.94))
      }
      ready.onerror = () => resolve(originalDataUrl)
      ready.src = readyDataUrl
    }
    orig.onerror = () => resolve(originalDataUrl)
    orig.src = originalDataUrl
  })
}

// ── Main scan function ────────────────────────────────────────────────────────
export async function scanKanji(
  imageDataUrl: string,
  onStatus?: (msg: string) => void
): Promise<ScanResult> {
  const status = (msg: string) => onStatus?.(msg)

  // Step 1: Resize if needed
  status('Menyiapkan gambar...')
  const readyUrl = await resizeIfNeeded(imageDataUrl)
  const base64   = dataUrlToBase64(readyUrl)

  // Step 2: Google Cloud Vision OCR
  status('Google Vision OCR...')
  let fullText = ''
  let wordAnnotations: Array<{ text: string; vertices: Array<{ x?: number; y?: number }> }> = []

  const visionRes = await fetch(VISION_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requests: [{
        image: { content: base64 },
        features: [
          { type: 'TEXT_DETECTION',          maxResults: 100 },
          { type: 'DOCUMENT_TEXT_DETECTION', maxResults: 1   },
        ],
        imageContext: { languageHints: ['ja', 'en'] },
      }],
    }),
  })

  if (!visionRes.ok) {
    const err = await visionRes.json().catch(() => ({}))
    throw new Error(`Vision API ${visionRes.status}: ${(err as { error?: { message?: string } })?.error?.message || visionRes.statusText}`)
  }

  const visionData = await visionRes.json()
  const resp = visionData?.responses?.[0]
  if (resp?.error) throw new Error('Vision API: ' + resp.error.message)

  fullText = resp?.fullTextAnnotation?.text?.trim() || ''
  const rawAnnotations: Array<{ description?: string; boundingPoly?: { vertices?: Array<{ x?: number; y?: number }> } }> =
    (resp?.textAnnotations || []).slice(1)
  wordAnnotations = rawAnnotations.map((a) => ({
    text:     (a.description || '').trim(),
    vertices: a.boundingPoly?.vertices || [],
  }))

  // Step 3: Burn overlay
  status('Menandai teks pada gambar...')
  let annotatedImage = imageDataUrl
  if (wordAnnotations.length > 0) {
    annotatedImage = await burnOverlay(imageDataUrl, wordAnnotations, readyUrl)
  }

  if (!fullText) {
    return { detected_text: '', segments: [], translation: 'Tidak ada teks terdeteksi.', language_notes: '', annotatedImage }
  }

  // Step 4: Get furigana — AI first, kuromoji as fallback
  status('Menganalisis furigana (AI)...')
  let segments: Segment[] | null = await getAIFurigana(fullText)

  if (!segments || segments.length === 0) {
    // Fallback: kuromoji client-side tokenizer
    status('Menganalisis furigana (kuromoji)...')
    try {
      const tokenizer = await getKuromojiTokenizer()
      if (tokenizer) {
        const tokens = tokenizer.tokenize(fullText)
        segments = buildSegmentsFromTokens(tokens)
      }
    } catch { /* ignore */ }
  }

  // Final fallback: single segment per character cluster
  if (!segments || segments.length === 0) {
    segments = fullText.split('').filter(c => c.trim()).map(c => ({
      kanji:    c,
      furigana: '',
      romaji:   '',
      meaning:  '',
      type:     detectType(c),
    }))
  }

  // Step 5: Translation — run in parallel with furigana if needed
  status('Menerjemahkan...')
  const { translation, notes } = await getAITranslation(fullText)

  return {
    detected_text: fullText,
    segments,
    translation,
    language_notes: `OCR: Google Vision API • Furigana: AI (GPT-4o-mini) + kuromoji fallback${notes ? ' • ' + notes : ''}`,
    annotatedImage,
  }
}
