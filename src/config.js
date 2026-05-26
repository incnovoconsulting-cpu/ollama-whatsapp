require('dotenv').config();

const config = {
  // Ollama configuration
  ollamaHost: process.env.OLLAMA_HOST || 'http://127.0.0.1:11434',
  model: process.env.OLLAMA_MODEL || 'llama3.2',
  systemPrompt: process.env.SYSTEM_PROMPT || 'You are a helpful, concise assistant replying inside a WhatsApp chat. Keep answers short, friendly, and use plain text only (no markdown). Reply in the same language the user wrote in.',
  defaultTemperature: parseFloat(process.env.DEFAULT_TEMPERATURE || '0.7'),

  // WhatsApp and venom-bot configuration
  sessionName: process.env.SESSION_NAME || 'ollama-wa',
  replyInGroups: process.env.REPLY_IN_GROUPS === 'true',
  replyOnlyOnMention: process.env.REPLY_ONLY_ON_MENTION !== 'false',

  // Message and rate limiting
  historyLimit: parseInt(process.env.HISTORY_LIMIT || '20', 10),
  sendTyping: process.env.SEND_TYPING !== 'false',
  rateLimitMs: parseInt(process.env.RATE_LIMIT_MS || '1000', 10),

  // Storage
  persistHistory: process.env.PERSIST_HISTORY !== 'false',
  storageDir: process.env.STORAGE_DIR || './data',

  // Feature flags
  allowModelSwitch: process.env.ALLOW_MODEL_SWITCH !== 'false',

  // Chat filtering
  ignoreChats: new Set((process.env.IGNORE_CHATS || '').split(',').filter(Boolean)),
  allowChats: new Set((process.env.ALLOW_CHATS || '').split(',').filter(Boolean)),
};

// Validate critical settings
if (!config.ollamaHost) {
  throw new Error('OLLAMA_HOST is required');
}

if (!config.model) {
  throw new Error('OLLAMA_MODEL is required');
}

if (config.historyLimit < 1) {
  throw new Error('HISTORY_LIMIT must be at least 1');
}

module.exports = config;
