# Presentation pipeline

Reproducible tooling that records the **live deployed app** and assembles the narrated demo walkthrough.

🎥 **Watch:** https://youtu.be/aMN48IvN5gs

> The walkthrough was **scripted and directed by the human author** — every scene, click, and spoken claim
> is mine. The **voiceover is AI-generated** (OpenAI text-to-speech) purely for audio quality and a
> consistent narration voice. The rendered video is gitignored (`out/`); only the pipeline is committed.

## How it works

| File | Role |
|---|---|
| `scenes.mjs` | The script — 12 scenes, each with narration text + the actions to perform on the app |
| `tts.mjs` | Generates one mp3 per scene via OpenAI `gpt-4o-mini-tts`; probes durations (`out/durations.json`) |
| `record.mjs` | Puppeteer drives the live app with a visible cursor + screen-records it; logs each scene's real start time (`out/timeline.json`) |
| `compose.mjs` | ffmpeg lays each scene's narration at its logged offset (robust to variable LLM latency) and muxes → `out/presentation.mp4` |

## Run

```bash
cd presentation
npm install --legacy-peer-deps   # puppeteer + puppeteer-screen-recorder
npm run build                    # tts → record → compose  (writes out/presentation.mp4)
```

Requires `ffmpeg`/`ffprobe` on PATH and `OPENAI_API_KEY` (read from `../2-knowledge-graph/.env` or the
environment). Records against the URL in `scenes.mjs`.
