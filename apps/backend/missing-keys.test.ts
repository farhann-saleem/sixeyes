import assert from 'node:assert/strict';
import { test } from 'node:test';
import dotenv from 'dotenv';
// This test process has no credentials and does not touch the owner's .env.
dotenv.config = () => ({ parsed: {} });
process.env.OPENROUTER_API_KEY = '';
process.env.PEXELS_API_KEY = '';
const { generateScript } = await import('./src/project-script.js');
const { fetchSceneStock } = await import('./src/project-stock.js');
test('missing keys fail clearly before any outbound call', async () => {
  globalThis.fetch = async () => { throw new Error('Unexpected network call'); };
  const signal = new AbortController().signal;
  await assert.rejects(generateScript('coffee shop morning', signal), /OPENROUTER_API_KEY missing/);
  await assert.rejects(fetchSceneStock('fixture', { id:'scene',index:0,heading:'Coffee',voiceover_line:'Morning.',stock_query:'coffee shop morning',duration_sec:8,status:'pending',picked_upload_id:null,candidates:[] }, signal), /PEXELS_API_KEY missing/);
});
