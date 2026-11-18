import test from 'node:test';
import assert from 'node:assert/strict';
import { speechRequest, speechCacheKey, synthesizeWaveNet } from '../supabase/functions/_shared/wavenet.mjs';

test('rejects oversized explanations instead of cutting sentences', () => {
  assert.throws(() => speechRequest('a'.repeat(601)), /invalid_text_length/);
  assert.equal(speechRequest('a'.repeat(600)).input.text.length, 600);
  assert.throws(() => speechRequest('<speak>test</speak>'), /plain_text_required/);
});
test('missing configuration makes no paid request', async () => {
  let calls = 0;
  await assert.rejects(synthesizeWaveNet('Merhaba.', { fetchImpl: () => { calls++; } }), /not_configured/);
  assert.equal(calls, 0);
});
test('sends Turkish Chirp 3 HD, keeps key out of URL, returns MP3', async () => {
  const audio = Buffer.from('ID3abcdefghijklmnop');
  const result = await synthesizeWaveNet('Birlikte düşünelim.', { apiKey: 'test-only', fetchImpl: async (url, init) => {
    assert.equal(url, 'https://texttospeech.googleapis.com/v1/text:synthesize');
    assert.equal(init.headers['X-Goog-Api-Key'], 'test-only');
    assert.equal(init.redirect, 'error');
    const body = JSON.parse(init.body);
    assert.equal(body.voice.name, 'tr-TR-Chirp3-HD-Achernar');
    assert.deepEqual(body.audioConfig, {audioEncoding: 'MP3'});
    return Response.json({ audioContent: audio.toString('base64') });
  }});
  assert.deepEqual(Buffer.from(result.bytes), audio);
});
test('provider failures are sanitized and never automatically retried', async () => {
  let calls = 0;
  await assert.rejects(synthesizeWaveNet('Merhaba.', { apiKey: 'test-only', fetchImpl: async () => {
    calls++; return new Response('private provider error', { status: 429 });
  }}), /provider_busy/);
  assert.equal(calls, 1);
});
test('rejects corrupt provider audio', async () => {
  await assert.rejects(synthesizeWaveNet('Merhaba.', { apiKey: 'test-only', fetchImpl: async () =>
    Response.json({ audioContent: Buffer.from('this is not audio').toString('base64') })
  }), /invalid_audio/);
});
test('cache key is stable for normalized text and distinct for different text', async () => {
  assert.equal(await speechCacheKey('Merhaba.'), await speechCacheKey(' Merhaba. '));
  assert.notEqual(await speechCacheKey('Merhaba.'), await speechCacheKey('Tekrar merhaba.'));
});
