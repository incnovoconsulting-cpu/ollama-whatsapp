class ConversationHistory {
  constructor({ limit = 20, persistent = null } = {}) {
    this.limit = limit;
    this.persistent = persistent;
    this.chats = new Map();
  }

  append(chatId, message) {
    if (!this.chats.has(chatId)) {
      this.chats.set(chatId, []);
    }
    const history = this.chats.get(chatId);
    history.push(message);

    if (history.length > this.limit) {
      history.shift();
    }

    if (this.persistent) {
      this.persistent.save(chatId, history);
    }
  }

  get(chatId) {
    if (!this.chats.has(chatId)) {
      if (this.persistent) {
        const loaded = this.persistent.load(chatId);
        this.chats.set(chatId, loaded);
        return loaded;
      }
      return [];
    }
    return this.chats.get(chatId);
  }

  reset(chatId) {
    this.chats.delete(chatId);
    if (this.persistent) {
      this.persistent.delete(chatId);
    }
  }

  flush() {
    if (this.persistent) {
      for (const [chatId, messages] of this.chats.entries()) {
        this.persistent.save(chatId, messages);
      }
    }
  }
}

class RateLimiter {
  constructor({ window = 1000 } = {}) {
    this.window = window;
    this.lastReply = new Map();
  }

  isAllowed(chatId) {
    const now = Date.now();
    const last = this.lastReply.get(chatId) || 0;
    return now - last >= this.window;
  }

  mark(chatId) {
    this.lastReply.set(chatId, Date.now());
  }
}

module.exports = { ConversationHistory, RateLimiter };
