// Server-only transport. Call only after premium/ownership checks and a cache miss.
// Never accept provider credentials or voice configuration from browser requests.
export const WAVENET_VOICE = 'tr-TR-Chirp3-HD-Achernar';
export const MAX_SPEECH_CHARACTERS = 600;
const ENDPOINT = 'https://texttospeech.googleapis.com/v1/text:synthesize';

export class SpeechError extends Error {
  constructor(code) { super(code); this.name = 'SpeechError'; this.code = code; }
}

export function speechRequest(text) {
  if (typeof text !== 'string') throw new SpeechError('invalid_text');
  const normalized = text.trim();
  if (!normalized || Array.from(normalized).length > MAX_SPEECH_CHARACTERS)
    throw new SpeechError('invalid_text_length');
  // Plain text only. Do not silently cut off an explanation or interpret SSML.
  if (/[<>]/u.test(normalized)) throw new SpeechError('plain_text_required');
  return {
    input: { text: normalized },
    voice: { languageCode: 'tr-TR', name: WAVENET_VOICE },
    audioConfig: { audioEncoding: 'MP3' },
  };
}

export async function speechCacheKey(text) {
  const payload = JSON.stringify(speechRequest(text));
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(payload));
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
}

export async function synthesizeWaveNet(text, { apiKey, fetchImpl = fetch } = {}) {
  const payload = speechRequest(text);
  if (typeof apiKey !== 'string' || !apiKey.trim()) throw new SpeechError('not_configured');
  let response;
  try {
    response = await fetchImpl(ENDPOINT, {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(25000),
      headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': apiKey },
      body: JSON.stringify(payload),
    });
  } catch {
    // Never expose provider diagnostics, credentials, or input text in logs/errors.
    throw new SpeechError('provider_unavailable');
  }
  if (!response.ok) {
    throw new SpeechError(response.status === 429 ? 'provider_busy' : 'provider_rejected');
  }
  let data;
  try { data = await response.json(); } catch { throw new SpeechError('invalid_audio'); }
  const encoded = data?.audioContent;
  if (typeof encoded !== 'string' || encoded.length < 16 || encoded.length > 2_000_000 ||
      !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) throw new SpeechError('invalid_audio');
  let bytes;
  try { bytes = Uint8Array.from(atob(encoded), c => c.charCodeAt(0)); }
  catch { throw new SpeechError('invalid_audio'); }
  const id3 = bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33;
  const frame = bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0;
  if (!id3 && !frame) throw new SpeechError('invalid_audio');
  return { bytes, contentType: 'audio/mpeg', characters: Array.from(payload.input.text).length };
}
