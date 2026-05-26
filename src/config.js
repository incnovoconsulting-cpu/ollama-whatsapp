require('dotenv').config();

const parseBool = (value, fallback = false) => {
  if (value === undefined || value === null || value === '') return fallback;
  return /^(1|true|yes|on)$/i.test(String(value).trim());
};

const parseList = (value) =>
  (value || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

const config = {
  ollamaHost: process.env.OLLAMA_HOST || 'http://127.0.0.1:11434',
  model: process.env.OLLAMA_MODEL || 'llama3.2',
  systemPrompt:
    process.env.SYSTEM_PROMPT ||
    'You are a helpful, concise assistant replying inside a WhatsApp chat. Keep answers short, friendly, and use plain text only (no markdown). Reply in the same language the user wrote in.',
  sessionName: process.env.SESSION_NAME || 'ollama-wa',
  replyInGroups: parseBool(process.env.REPLY_IN_GROUPS, false),
  replyOnlyOnMention: parseBool(process.env.REPLY_ONLY_ON_MENTION, true),
  historyLimit: Math.max(0, parseInt(process.env.HISTORY_LIMIT || '20', 10)),
  sendTyping: parseBool(process.env.SEND_TYPING, true),
  ignoreChats: new Set(parseList(process.env.IGNORE_CHATS)),
  allowChats: new Set(parseList(process.env.ALLOW_CHATS)),
  rateLimitMs: Math.max(0, parseInt(process.env.RATE_LIMIT_MS || '1000', 10)),
  persistHistory: parseBool(process.env.PERSIST_HISTORY, true),
  storageDir: process.env.STORAGE_DIR || './data',
  allowModelSwitch: parseBool(process.env.ALLOW_MODEL_SWITCH, true),
  defaultTemperature: Math.max(0, Math.min(1, parseFloat(process.env.DEFAULT_TEMPERATURE || '0.7'))),
};

function validate() {
  const errors = [];
  if (!config.model) errors.push('OLLAMA_MODEL is required');
  if (!config.sessionName) errors.push('SESSION_NAME is required');
  if (!config.systemPrompt) errors.push('SYSTEM_PROMPT is required');
  if (!config.ollamaHost) errors.push('OLLAMA_HOST is required');
  if (config.allowChats.size > 0 && config.ignoreChats.size > 0) {
    errors.push('cannot set both ALLOW_CHATS and IGNORE_CHATS');
  }
  if (errors.length > 0) {
    throw new Error(`Config validation failed:\n  ${errors.join('\n  ')}`);
  }
}

validate();
module.exports = config;
