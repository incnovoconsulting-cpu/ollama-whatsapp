class ConversationHistory {
  constructor({ limit = 20, persistent = null } = {}) {
    this.limit = limit;
    this.chats = new Map();
    this.persistent = persistent;
    this.dirty = new Set();
  }

  get(chatId) {
    if (!this.chats.has(chatId) && this.persistent) {
      const messages = this.persistent.load(chatId);
      this.chats.set(chatId, messages);
    }
    return this.chats.get(chatId) || [];
  }

  append(chatId, message) {
    const messages = this.get(chatId);
    messages.push(message);
    if (this.limit > 0 && messages.length > this.limit) {
      messages.splice(0, messages.length - this.limit);
    }
    this.chats.set(chatId, messages);
    this.dirty.add(chatId);
  }

  reset(chatId) {
    this.chats.delete(chatId);
    this.dirty.delete(chatId);
    if (this.persistent) {
      this.persistent.delete(chatId);
    }
  }

  flush() {
    for (const chatId of this.dirty) {
      const messages = this.chats.get(chatId);
      if (this.persistent && messages) {
        this.persistent.save(chatId, messages);
      }
    }
    this.dirty.clear();
  }
}

class RateLimiter {
  constructor({ window = 1000 } = {}) {
    this.window = window;
    this.lastReply = new Map();
  }

  isAllowed(chatId) {
    const last = this.lastReply.get(chatId);
    if (!last) return true;
    return Date.now() - last >= this.window;
  }

  mark(chatId) {
    this.lastReply.set(chatId, Date.now());
  }
}

module.exports = { ConversationHistory, RateLimiter };
