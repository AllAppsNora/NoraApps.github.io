// Opt-in smoke test; private key comes only from the server environment.
// Run after setting GOOGLE_TTS_API_KEY; no user answers are sent.
import { writeFile } from 'node:fs/promises';
import { synthesizeWaveNet } from '../supabase/functions/_shared/wavenet.mjs';
const result = await synthesizeWaveNet(
  'Duygu analizi için yapay zekâ seçimin uygun. Şimdi bir sınırını düşün: Alaycı bir mesajı yanlış yorumlarsa sonucu nasıl kontrol edersin?',
  { apiKey: process.env.GOOGLE_TTS_API_KEY },
);
await writeFile(process.argv[2] || '/tmp/yz101-wavenet-smoke.mp3', result.bytes);
console.log(JSON.stringify({ contentType: result.contentType, bytes: result.bytes.length, characters: result.characters }));
