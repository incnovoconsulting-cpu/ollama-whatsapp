const fs = require('fs');
const path = require('path');

class PersistentHistory {
  constructor({ storageDir = './data' } = {}) {
    this.storageDir = storageDir;
    if (!fs.existsSync(storageDir)) {
      fs.mkdirSync(storageDir, { recursive: true });
    }
    this.chatDir = path.join(storageDir, 'chats');
    if (!fs.existsSync(this.chatDir)) {
      fs.mkdirSync(this.chatDir, { recursive: true });
    }
  }

  _safeChatId(chatId) {
    return chatId.replace(/[^a-zA-Z0-9_\-@.]/g, '_');
  }

  _getPath(chatId) {
    return path.join(this.chatDir, `${this._safeChatId(chatId)}.json`);
  }

  load(chatId) {
    try {
      const filePath = this._getPath(chatId);
      if (fs.existsSync(filePath)) {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        return data.messages || [];
      }
    } catch (err) {
      console.error(`[storage] error loading ${chatId}:`, err.message);
    }
    return [];
  }

  save(chatId, messages) {
    try {
      const filePath = this._getPath(chatId);
      const data = {
        chatId,
        savedAt: new Date().toISOString(),
        messages,
      };
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    } catch (err) {
      console.error(`[storage] error saving ${chatId}:`, err.message);
    }
  }

  delete(chatId) {
    try {
      const filePath = this._getPath(chatId);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (err) {
      console.error(`[storage] error deleting ${chatId}:`, err.message);
    }
  }

  listChats() {
    try {
      return fs
        .readdirSync(this.chatDir)
        .filter((f) => f.endsWith('.json'))
        .map((f) => f.slice(0, -5));
    } catch {
      return [];
    }
  }

  getStats() {
    const chats = this.listChats();
    const stats = {};
    for (const chatId of chats) {
      try {
        const filePath = this._getPath(chatId);
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        stats[chatId] = {
          messages: data.messages?.length || 0,
          savedAt: data.savedAt,
        };
      } catch {
        stats[chatId] = { messages: 0, savedAt: null };
      }
    }
    return stats;
  }
}

module.exports = { PersistentHistory };
