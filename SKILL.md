# Voice Livestream Skill

Give your OpenClaw agent a real-time voice on livestreams, podcasts, and video calls.

## What It Does
Bridges Vapi.ai (voice I/O) with your LLM backend so your agent can hold real-time voice conversations on any streaming platform.

**Flow:** Human speaks → Vapi transcribes → this server → your LLM responds → Vapi speaks it back

**Latency:** ~500ms-1s with optimized config (ElevenLabs Flash + fast model)

## Use When
- You want your agent to speak on a livestream (Restream, OBS, StreamYard)
- You want your agent to join a podcast as a voice guest
- You want two-way voice conversations with your agent on a video call (Google Meet, Zoom)

## Don't Use When
- You just need TTS for notifications (use the `tts` tool instead)
- You want async voice messages (use ElevenLabs API directly)

## Requirements
- **Vapi.ai account** (free tier: $10 credits) — https://vapi.ai
- **LLM API key** (Anthropic, OpenAI, or any OpenAI-compatible endpoint)
- **ngrok** (or any tunnel) for exposing the webhook — `brew install ngrok` or https://ngrok.com
- **Node.js** 18+

## Quick Start

### 1. Set up Vapi Assistant
Create an assistant at https://dashboard.vapi.ai with:
- **Transcriber:** Deepgram (default) or AssemblyAI Universal-Streaming (lower latency)
- **Voice:** ElevenLabs — pick a voice, set "Optimize Streaming Latency" to 4 for speed
- **Model:** Set to "Custom" (we'll handle the brain)
- **First message:** Whatever your agent says when the call starts

### 2. Start the proxy server
```bash
# Set your LLM key
export ANTHROPIC_API_KEY="sk-ant-..."
# Or for OpenAI-compatible:
# export LLM_API_KEY="sk-..." LLM_PROVIDER=openai LLM_BASE_URL=https://api.openai.com

# Optional: customize the personality
export SYSTEM_PROMPT="You are Sene, a sharp and witty AI seneschal..."

# Start
node server.js
# 🎙️ Voice Livestream Proxy running on port 3456
```

### 3. Expose with ngrok
```bash
ngrok http 3456
# Gives you: https://abc123.ngrok.io
```

### 4. Wire Vapi to your server
In Vapi Dashboard → Your Assistant → Advanced → Server:
- **Server URL:** `https://abc123.ngrok.io/webhook`

### 5. Test
Click "Talk to Assistant" in the Vapi dashboard. Your voice → Vapi → this server → LLM → Vapi → voice back.

## Streaming Platform Setup

### Restream / StreamYard
1. Install a virtual audio device:
   - **macOS:** `brew install --cask blackhole-2ch`
   - **Windows:** VB-Cable
   - **Linux:** PulseAudio null sink
2. Set system audio output to the virtual device
3. Join the stream as a guest via browser
4. Set the browser's mic input to the virtual audio device
5. Open Vapi "Talk to Assistant" in another tab — audio routes through the virtual device

### OBS
1. Add the virtual audio device as an Audio Input source
2. Vapi audio plays through virtual device → OBS captures it

### Google Meet / Zoom
1. Join with a bot account via browser (or Playwright for automation)
2. Set mic to virtual audio device
3. Same Vapi flow — audio routes through

## Configuration

| Env Var | Default | Description |
|---------|---------|-------------|
| `PORT` | `3456` | Server port |
| `LLM_API_KEY` | — | API key for your LLM (or `ANTHROPIC_API_KEY`) |
| `LLM_PROVIDER` | `anthropic` | `anthropic` or `openai` (OpenAI-compatible) |
| `LLM_BASE_URL` | `https://api.anthropic.com` | LLM API base URL |
| `LLM_MODEL` | `claude-sonnet-4-20250514` | Model to use |
| `MAX_TOKENS` | `200` | Max response tokens (keep low for speed) |
| `SYSTEM_PROMPT` | Generic assistant | Your agent's personality/instructions |
| `VAPI_SECRET` | — | Optional: Vapi server secret for auth |
| `LOG_LEVEL` | `info` | `debug`, `info`, or `error` |

## Latency Tips
- Use **Sonnet** over Opus (2-3x faster)
- Keep `MAX_TOKENS` at 150-200 (concise = fast)
- Use **ElevenLabs Flash v2.5** voice in Vapi (75ms TTS)
- Use **AssemblyAI Universal-Streaming** transcriber (90ms STT)
- Run ngrok in the same region as your LLM provider

## Architecture
```
┌──────────┐     ┌──────────┐     ┌──────────────┐     ┌─────────┐
│  Human   │────▶│  Vapi.ai │────▶│ This Server  │────▶│  LLM    │
│ (speaks) │◀────│ STT+TTS  │◀────│ (webhook)    │◀────│ (brain) │
└──────────┘     └──────────┘     └──────────────┘     └─────────┘
                      │
                      ▼
              ┌──────────────┐
              │  Stream/Call │
              │  (Restream,  │
              │  OBS, Meet)  │
              └──────────────┘
```

## Roadmap (Community)
- [ ] OpenClaw gateway API integration (use your actual agent, not just an LLM)
- [ ] Avatar support (D-ID, HeyGen, AITuber OnAir)
- [ ] OBS scene control via WebSocket
- [ ] Google Meet auto-join via Playwright
- [ ] Streaming platform auto-detection
- [ ] Voice activity detection tuning
- [ ] Multi-participant conversation tracking

## License
MIT
