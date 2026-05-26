const venom = require('venom-bot');
const config = require('./src/config');
const { ConversationHistory, RateLimiter } = require('./src/history');
const { OllamaClient } = require('./src/ollamaClient');
const { PersistentHistory } = require('./src/storage');

const MAX_MESSAGE_LENGTH = 4096;

function truncateMessage(text, max = MAX_MESSAGE_LENGTH) {
  if (text.length <= max) return text;
  return text.slice(0, max - 3) + '...';
}

const COMMANDS = {
  RESET: ['/reset', '!reset'],
  HELP: ['/help', '!help'],
  EXPORT: ['/export'],
  MODEL: ['/model'],
  TEMP: ['/temp'],
  CREATIVE: ['/creative'],
  PRECISE: ['/precise'],
  STATS: ['/stats'],
};

function isGroupChat(message) {
  return Boolean(message.isGroupMsg) || (message.chatId || '').endsWith('@g.us');
}

function shouldHandle(message, botJid) {
  if (!message || message.from === 'status@broadcast') return false;
  if (message.fromMe) return false;
  if (message.type && message.type !== 'chat') return false;
  if (!message.body || !message.body.trim()) return false;

  const chatId = message.chatId || message.from;
  if (config.ignoreChats.has(chatId)) return false;
  if (config.allowChats.size > 0 && !config.allowChats.has(chatId)) return false;

  if (isGroupChat(message)) {
    if (!config.replyInGroups) return false;
    if (config.replyOnlyOnMention) {
      const mentions = message.mentionedJidList || [];
      if (!botJid || !mentions.includes(botJid)) return false;
    }
  }

  return true;
}

function matchesCommand(body, commands) {
  const normalized = body.trim().toLowerCase();
  return commands.some((cmd) => normalized === cmd);
}

async function handleCommand({ client, message, history, ollama, persistent, rateLimiter }) {
  const body = message.body.trim();
  const chatId = message.chatId || message.from;
  const args = body.split(/\s+/);
  const cmd = args[0].toLowerCase();

  if (matchesCommand(body, COMMANDS.RESET)) {
    history.reset(chatId);
    await client.sendText(chatId, 'Conversation history cleared.');
    return true;
  }

  if (matchesCommand(body, COMMANDS.HELP)) {
    const lines = [
      'Ollama-WhatsApp bot',
      '',
      `Model: ${ollama.model} | Temp: ${ollama.getTemperature().toFixed(2)}`,
      '',
      'Commands:',
      '  /help        Show this message',
      '  /reset       Clear conversation',
      '  /stats       Usage stats',
      '  /export json Dump history as JSON',
      '  /export text Dump history as text',
    ];
    if (config.allowModelSwitch) {
      lines.push('  /model <name> Switch to a model');
      lines.push('  /creative     Set temp to 0.9');
      lines.push('  /precise      Set temp to 0.3');
      lines.push('  /temp <0-1>   Set temp directly');
    }
    await client.sendText(chatId, lines.join('\n'));
    return true;
  }

  if (matchesCommand(body, COMMANDS.EXPORT)) {
    const fmt = args[1]?.toLowerCase() || 'text';
    const msgs = history.get(chatId);
    let text = '';
    if (fmt === 'json') {
      text = JSON.stringify(msgs, null, 2);
    } else {
      text = msgs
        .map((m, i) => `[${i + 1}] ${m.role.toUpperCase()}: ${m.content}`)
        .join('\n\n');
    }
    const chunks = text.match(/[\s\S]{1,4000}/g) || [];
    for (const chunk of chunks) {
      await client.sendText(chatId, chunk);
    }
    return true;
  }

  if (matchesCommand(body, COMMANDS.STATS)) {
    const stats = persistent ? persistent.getStats() : {};
    const allChats = Object.keys(stats);
    const ourStats = stats[chatId] || { messages: 0 };
    const lines = [
      `Your chat: ${ourStats.messages} messages`,
      `Total chats: ${allChats.length}`,
      `Model: ${ollama.model}`,
      `Temperature: ${ollama.getTemperature().toFixed(2)}`,
      `History limit: ${config.historyLimit}`,
    ];
    await client.sendText(chatId, lines.join('\n'));
    return true;
  }

  if (matchesCommand(body, COMMANDS.MODEL)) {
    if (!config.allowModelSwitch) {
      await client.sendText(chatId, 'Model switching is disabled.');
      return true;
    }
    const newModel = args[1];
    if (!newModel) {
      const models = await ollama.listAvailableModels();
      const modelList = models.slice(0, 10).join(', ');
      await client.sendText(
        chatId,
        `Usage: /model <name>\n\nAvailable: ${modelList}${models.length > 10 ? '...' : ''}`
      );
      return true;
    }
    try {
      await ollama.switchModel(newModel);
      await client.sendText(chatId, `Switched to model: ${newModel}`);
      return true;
    } catch (err) {
      await client.sendText(chatId, `Error: ${err.message}`);
      return true;
    }
  }

  if (matchesCommand(body, COMMANDS.CREATIVE)) {
    if (!config.allowModelSwitch) {
      await client.sendText(chatId, 'Temperature control is disabled.');
      return true;
    }
    ollama.setTemperature(0.9);
    await client.sendText(chatId, 'Temperature set to 0.9 (creative).');
    return true;
  }

  if (matchesCommand(body, COMMANDS.PRECISE)) {
    if (!config.allowModelSwitch) {
      await client.sendText(chatId, 'Temperature control is disabled.');
      return true;
    }
    ollama.setTemperature(0.3);
    await client.sendText(chatId, 'Temperature set to 0.3 (precise).');
    return true;
  }

  if (matchesCommand(body, COMMANDS.TEMP)) {
    if (!config.allowModelSwitch) {
      await client.sendText(chatId, 'Temperature control is disabled.');
      return true;
    }
    const temp = parseFloat(args[1]);
    if (isNaN(temp) || temp < 0 || temp > 1) {
      await client.sendText(chatId, 'Usage: /temp <0-1>');
      return true;
    }
    ollama.setTemperature(temp);
    await client.sendText(chatId, `Temperature set to ${temp.toFixed(2)}.`);
    return true;
  }

  return false;
}

async function setTyping(client, chatId, isTyping) {
  if (!config.sendTyping) return;
  try {
    if (isTyping) {
      await client.startTyping(chatId);
    } else {
      await client.stopTyping(chatId);
    }
  } catch {
    // Presence updates are best-effort; ignore failures.
  }
}

function buildHandler({ ollama, history, botJid, rateLimiter, persistent }) {
  return async (client, message) => {
    if (!shouldHandle(message, botJid)) return;

    const chatId = message.chatId || message.from;
    const body = message.body.trim();

    if (!rateLimiter.isAllowed(chatId)) {
      return;
    }

    try {
      if (await handleCommand({ client, message, history, ollama, persistent, rateLimiter })) {
        rateLimiter.mark(chatId);
        return;
      }

      history.append(chatId, { role: 'user', content: body });

      await setTyping(client, chatId, true);
      let reply;
      try {
        reply = await ollama.chat(history.get(chatId));
      } catch (err) {
        await setTyping(client, chatId, false);
        console.error(`[handler] ollama error for ${chatId}:`, err.message);
        await client.sendText(chatId, `Model error: ${err.message}`);
        return;
      }
      await setTyping(client, chatId, false);

      if (!reply || !reply.trim()) {
        await client.sendText(chatId, "I couldn't think of a reply — try rephrasing?");
        return;
      }

      reply = truncateMessage(reply);
      history.append(chatId, { role: 'assistant', content: reply });
      await client.sendText(chatId, reply);
      rateLimiter.mark(chatId);
    } catch (err) {
      await setTyping(client, chatId, false);
      console.error(`[handler] unexpected error for ${chatId}:`, err.message);
      try {
        const msg = err.message.length > 100
          ? `${err.message.slice(0, 97)}...`
          : err.message;
        await client.sendText(chatId, `Sorry — something went wrong: ${msg}`);
      } catch {
        // ignore send failures
      }
    }
  };
}

async function main() {
  const persistent = config.persistHistory ? new PersistentHistory({ storageDir: config.storageDir }) : null;
  if (persistent) {
    console.log(`[startup] Persistent storage at ${config.storageDir}`);
  }

  const ollama = new OllamaClient({
    host: config.ollamaHost,
    model: config.model,
    systemPrompt: config.systemPrompt,
    temperature: config.defaultTemperature,
  });

  console.log(`[startup] Checking Ollama at ${config.ollamaHost} for model "${config.model}"...`);
  await ollama.ensureModel();
  console.log('[startup] Ollama ready.');

  const history = new ConversationHistory({ limit: config.historyLimit, persistent });
  const rateLimiter = new RateLimiter({ window: config.rateLimitMs });

  const flushInterval = setInterval(() => {
    history.flush();
  }, 10000);

  console.log('[startup] connecting to WhatsApp...');
  const client = await venom.create({
    session: config.sessionName,
    executablePath: '/usr/bin/firefox',
    headless: 'new',
    disableWelcome: true,
    logQR: true,
    autoClose: 0,
    catchQR: (base64Qr, asciiQR) => {
      console.log(asciiQR);
    },
    statusFind: (status) => {
      console.log(`[venom] status: ${status}`);
    },
  });

  let botJid = null;
  try {
    const me = await client.getHostDevice();
    botJid = me?.wid?._serialized || me?.id?._serialized || null;
    if (botJid) {
      console.log(`[startup] bot JID: ${botJid}`);
    } else {
      console.warn('[startup] could not resolve bot JID; group mentions will not work');
    }
  } catch (err) {
    console.warn('[startup] could not resolve bot JID:', err.message);
  }

  console.log('[startup] WhatsApp session ready. Listening for messages...');
  console.log(`[startup] model: ${config.model}, history: ${config.historyLimit} msgs, rate limit: ${config.rateLimitMs}ms`);

  const handler = buildHandler({ ollama, history, botJid, rateLimiter, persistent });
  client.onMessage((message) => {
    handler(client, message).catch((err) => {
      console.error('[handler] unexpected error:', err);
    });
  });

  const shutdown = async (signal) => {
    console.log(`\n[shutdown] received ${signal}, closing...`);
    clearInterval(flushInterval);
    history.flush();
    try {
      await client.close();
    } catch (err) {
      console.error('[shutdown] error closing client:', err.message);
    }
    process.exit(0);
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  console.error('[fatal]', err);
  process.exit(1);
});
