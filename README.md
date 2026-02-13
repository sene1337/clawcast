# 🎙️ ClawCast

> ⚠️ **Status: Experimental / Party Trick**
> This currently only gets your OpenClaw agent to speak on streams and calls (one-way voice). Two-way real-time conversation is not yet working — the audio routing required on macOS (multiple virtual audio devices, browser permission juggling) is fragile and full of foot guns. We're shelving this until purpose-built solutions like ClawdTalk or NVIDIA PersonaPlex mature. Use it for the novelty factor, not production.

Give your OpenClaw agent a voice on livestreams, podcasts, and video calls.

**Human speaks → Vapi transcribes → your LLM responds → Vapi speaks it back. ~500ms latency (theoretical).**

## How It Works

This is a zero-dependency Node.js proxy that sits between [Vapi.ai](https://vapi.ai) (handles voice I/O) and your LLM (handles the brain). Vapi deals with speech-to-text, text-to-speech, and WebRTC. Your agent deals with being smart.

Works with any streaming platform: **Restream, OBS, StreamYard, Google Meet, Zoom** — anything that accepts a browser participant with a microphone.

## Quick Start

```bash
# 1. Clone
git clone https://github.com/sene1337/clawcast.git
cd clawcast

# 2. Set your API key
export ANTHROPIC_API_KEY="sk-ant-..."

# 3. Run
node server.js

# 4. Expose (separate terminal)
ngrok http 3456

# 5. Set the ngrok URL as your Vapi assistant's Server URL
#    https://abc123.ngrok.io/webhook
```

Then click "Talk to Assistant" in Vapi's dashboard. You're live.

## Supports
- **Anthropic** (Claude Sonnet, Opus, Haiku)
- **OpenAI** (GPT-4o, etc.)
- **Any OpenAI-compatible API** (Groq, Together, local models)

## Audio Routing for Streams

Your agent needs a way to get audio into the streaming platform:

| Platform | Method |
|----------|--------|
| macOS | [BlackHole 2ch](https://github.com/ExistentialAudio/BlackHole) as virtual mic |
| Windows | [VB-Cable](https://vb-audio.com/Cable/) |
| Linux | PulseAudio null sink |

Set system audio output → virtual device → streaming platform uses it as mic input.

## Configuration

All via environment variables. See [SKILL.md](SKILL.md) for full reference.

Key ones:
- `ANTHROPIC_API_KEY` or `LLM_API_KEY` — your LLM key
- `SYSTEM_PROMPT` — your agent's personality
- `LLM_MODEL` — which model (default: `claude-sonnet-4-20250514`)
- `MAX_TOKENS` — keep at 200 or less for fast responses

## Community Roadmap
- [ ] OpenClaw gateway integration (full agent, not just LLM)
- [ ] Avatar support (D-ID, HeyGen, AITuber OnAir)
- [ ] Google Meet auto-join
- [ ] OBS scene control

PRs welcome. ClawCast was hacked together in a live stream session — make it better.

## License
MIT
