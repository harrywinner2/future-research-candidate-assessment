// Generate one mp3 per scene via OpenAI TTS, then probe durations.
import { SCENES, VOICE, INSTRUCTIONS } from './scenes.mjs';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const AUDIO_DIR = path.resolve('out/audio');
fs.mkdirSync(AUDIO_DIR, { recursive: true });

function apiKey() {
  if (process.env.OPENAI_API_KEY) return process.env.OPENAI_API_KEY;
  const envPath = path.resolve('../2-knowledge-graph/.env');
  const line = fs.readFileSync(envPath, 'utf8').split('\n').find(l => l.startsWith('OPENAI_API_KEY='));
  if (!line) throw new Error('OPENAI_API_KEY not found in env or ../2-knowledge-graph/.env');
  return line.slice('OPENAI_API_KEY='.length).trim();
}

function probeDuration(file) {
  const out = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]);
  return parseFloat(String(out).trim());
}

const KEY = apiKey();
const durations = {};

for (const scene of SCENES) {
  const file = path.join(AUDIO_DIR, `${scene.id}.mp3`);
  process.stdout.write(`TTS ${scene.id} … `);
  const res = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-4o-mini-tts',
      voice: VOICE,
      input: scene.voice,
      instructions: INSTRUCTIONS,
      response_format: 'mp3',
    }),
  });
  if (!res.ok) throw new Error(`TTS failed for ${scene.id}: ${res.status} ${await res.text()}`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(file, buf);
  durations[scene.id] = probeDuration(file);
  console.log(`${(buf.length / 1024).toFixed(0)}KB, ${durations[scene.id].toFixed(1)}s`);
}

fs.writeFileSync(path.resolve('out/durations.json'), JSON.stringify(durations, null, 2));
const total = Object.values(durations).reduce((a, b) => a + b, 0);
console.log(`\nAll narration generated. Total spoken ≈ ${(total / 60).toFixed(1)} min across ${SCENES.length} scenes.`);
