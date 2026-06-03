// Aligns each scene's narration to the recorded scene start (from timeline.json)
// and muxes it onto the screen recording → out/presentation.mp4
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const tl = JSON.parse(fs.readFileSync(path.resolve('out/timeline.json'), 'utf8'));
const video = path.resolve('out/screen.mp4');
const out = path.resolve('out/presentation.mp4');

const inputs = [];
const filters = [];
const labels = [];
tl.scenes.forEach((s, i) => {
  inputs.push('-i', path.resolve(s.audio));
  // delay this scene's narration to the moment the scene began on screen
  filters.push(`[${i + 1}:a]adelay=${Math.round(s.startMs)}:all=1[a${i}]`);
  labels.push(`[a${i}]`);
});
// Sum the (non-overlapping) delayed tracks at full volume.
filters.push(`${labels.join('')}amix=inputs=${tl.scenes.length}:normalize=0:dropout_transition=0[mix]`);
// Gentle limiter so summed peaks never clip.
filters.push(`[mix]alimiter=limit=0.97[aout]`);

const args = [
  '-y',
  '-i', video,
  ...inputs,
  '-filter_complex', filters.join(';'),
  '-map', '0:v',
  '-map', '[aout]',
  '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p',
  '-c:a', 'aac', '-b:a', '192k',
  '-movflags', '+faststart',
  out,
];

console.log('Composing final video…');
execFileSync('ffmpeg', args, { stdio: ['ignore', 'inherit', 'inherit'] });

const dur = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', out]);
const size = (fs.statSync(out).size / 1e6).toFixed(1);
console.log(`\n✅ out/presentation.mp4  —  ${(parseFloat(String(dur)) / 60).toFixed(2)} min, ${size} MB`);
