#!/usr/bin/env node
/**
 * ClawCast — Voice Livestream Proxy for OpenClaw
 * 
 * Bridges Vapi.ai voice I/O with any OpenAI-compatible LLM backend.
 * Vapi handles: STT (speech-to-text) + TTS (text-to-speech) + WebRTC
 * This server handles: the AI brain (your agent's personality + memory)
 * 
 * Flow: User speaks → Vapi transcribes → POST here → LLM response → Vapi speaks
 * 
 * Zero dependencies — uses Node.js built-in http and https modules.
 */

const http = require('http');
const https = require('https');

// --- Configuration (env vars) ---
const PORT = parseInt(process.env.PORT || '3456');
const LLM_API_KEY = process.env.LLM_API_KEY || process.env.ANTHROPIC_API_KEY || '';
const LLM_BASE_URL = process.env.LLM_BASE_URL || 'https://api.anthropic.com';
const LLM_MODEL = process.env.LLM_MODEL || 'claude-sonnet-4-20250514';
const LLM_PROVIDER = process.env.LLM_PROVIDER || 'anthropic'; // 'anthropic' or 'openai'
const MAX_TOKENS = parseInt(process.env.MAX_TOKENS || '200');
const SYSTEM_PROMPT = process.env.SYSTEM_PROMPT || `You are a sharp, witty AI assistant on a live stream. Keep responses concise — 1-3 sentences max unless asked to elaborate. Be direct, opinionated, and engaging. No corporate speak.`;
const VAPI_SECRET = process.env.VAPI_SECRET || ''; // Optional: verify Vapi requests
const LOG_LEVEL = process.env.LOG_LEVEL || 'info'; // 'debug' | 'info' | 'error'

// --- Conversation memory (per-call) ---
const conversations = new Map(); // callId -> [{role, content}]

function log(level, ...args) {
  const levels = { debug: 0, info: 1, error: 2 };
  if (levels[level] >= levels[LOG_LEVEL]) {
    console.log(`[${new Date().toISOString()}] [${level.toUpperCase()}]`, ...args);
  }
}

// --- LLM Calls ---
function callAnthropic(messages, systemPrompt) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      model: LLM_MODEL,
      max_tokens: MAX_TOKENS,
      system: systemPrompt,
      messages: messages.map(m => ({ role: m.role, content: m.content }))
    });

    const url = new URL('/v1/messages', LLM_BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': LLM_API_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Length': Buffer.byteLength(payload)
      }
    };

    const startMs = Date.now();
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        log('debug', `Anthropic responded in ${Date.now() - startMs}ms`);
        try {
          const json = JSON.parse(data);
          if (json.content && json.content[0]) {
            resolve(json.content[0].text);
          } else {
            reject(new Error(`Unexpected response: ${data.slice(0, 200)}`));
          }
        } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.setTimeout(7000, () => { req.destroy(); reject(new Error('LLM timeout')); });
    req.write(payload);
    req.end();
  });
}

function callOpenAI(messages, systemPrompt) {
  return new Promise((resolve, reject) => {
    const allMessages = [{ role: 'system', content: systemPrompt }, ...messages];
    const payload = JSON.stringify({
      model: LLM_MODEL,
      max_tokens: MAX_TOKENS,
      messages: allMessages
    });

    const url = new URL('/v1/chat/completions', LLM_BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${LLM_API_KEY}`,
        'Content-Length': Buffer.byteLength(payload)
      }
    };

    const startMs = Date.now();
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        log('debug', `OpenAI-compat responded in ${Date.now() - startMs}ms`);
        try {
          const json = JSON.parse(data);
          if (json.choices && json.choices[0]) {
            resolve(json.choices[0].message.content);
          } else {
            reject(new Error(`Unexpected response: ${data.slice(0, 200)}`));
          }
        } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.setTimeout(7000, () => { req.destroy(); reject(new Error('LLM timeout')); });
    req.write(payload);
    req.end();
  });
}

async function getLLMResponse(callId, userMessage) {
  if (!conversations.has(callId)) {
    conversations.set(callId, []);
  }
  const history = conversations.get(callId);
  history.push({ role: 'user', content: userMessage });

  // Keep last 20 turns to stay under context limits
  if (history.length > 40) history.splice(0, history.length - 40);

  const callLLM = LLM_PROVIDER === 'anthropic' ? callAnthropic : callOpenAI;
  const response = await callLLM(history, SYSTEM_PROMPT);
  
  history.push({ role: 'assistant', content: response });
  return response;
}

// --- Vapi Webhook Handler ---
async function handleVapiEvent(event) {
  const type = event.message?.type || event.type || 'unknown';
  log('debug', `Event: ${type}`);

  switch (type) {
    case 'assistant-request': {
      // User spoke — extract transcript and respond
      const callId = event.message?.call?.id || event.call?.id || 'default';
      const messages = event.message?.artifact?.messages || event.artifact?.messages || [];
      
      // Get the latest user message
      const userMessages = messages.filter(m => m.role === 'user');
      const lastUserMsg = userMessages[userMessages.length - 1];
      
      if (!lastUserMsg) {
        log('info', 'No user message in assistant-request');
        return { results: [{ type: 'say', message: "I didn't catch that. Could you repeat?" }] };
      }

      log('info', `User said: "${lastUserMsg.content}"`);
      
      try {
        const response = await getLLMResponse(callId, lastUserMsg.content);
        log('info', `Agent says: "${response}"`);
        return { results: [{ type: 'say', message: response }] };
      } catch (err) {
        log('error', 'LLM error:', err.message);
        return { results: [{ type: 'say', message: "Give me a moment, my brain hiccupped." }] };
      }
    }

    case 'function-call': {
      // Vapi function calling — extend with tool use if needed
      const functionCall = event.message?.functionCall || event.functionCall;
      log('info', `Function call: ${functionCall?.name}`);
      return { results: [{ type: 'say', message: "I don't have that capability wired up yet." }] };
    }

    case 'status-update': {
      const status = event.message?.status || event.status;
      log('info', `Call status: ${status}`);
      if (status === 'ended') {
        const callId = event.message?.call?.id || event.call?.id;
        if (callId) conversations.delete(callId);
        log('info', `Cleaned up conversation for call ${callId}`);
      }
      return {};
    }

    case 'transcript': {
      const transcript = event.message?.transcript || event.transcript;
      log('debug', `Transcript: ${transcript?.text} (${transcript?.role})`);
      return {};
    }

    case 'hang':
    case 'speech-update':
    case 'conversation-update':
    case 'end-of-call-report':
      return {};

    default:
      log('debug', `Unhandled event: ${type}`);
      return {};
  }
}

// --- HTTP Server ---
const server = http.createServer(async (req, res) => {
  // Health check
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', model: LLM_MODEL, provider: LLM_PROVIDER }));
    return;
  }

  // Vapi webhook
  if (req.method === 'POST' && (req.url === '/webhook' || req.url === '/')) {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        // Optional: verify Vapi secret
        if (VAPI_SECRET && req.headers['x-vapi-secret'] !== VAPI_SECRET) {
          log('error', 'Invalid Vapi secret');
          res.writeHead(401);
          res.end('Unauthorized');
          return;
        }

        const event = JSON.parse(body);
        const result = await handleVapiEvent(event);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      } catch (err) {
        log('error', 'Webhook error:', err.message);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

server.listen(PORT, () => {
  log('info', `🎙️ ClawCast running on port ${PORT}`);
  log('info', `   LLM: ${LLM_PROVIDER} / ${LLM_MODEL}`);
  log('info', `   Webhook: http://localhost:${PORT}/webhook`);
  log('info', `   Health: http://localhost:${PORT}/health`);
  if (!LLM_API_KEY) {
    log('error', '⚠️  No LLM_API_KEY set! Set ANTHROPIC_API_KEY or LLM_API_KEY env var.');
  }
});
