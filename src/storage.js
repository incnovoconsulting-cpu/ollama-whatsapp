const fs = require('fs');
const path = require('path');

class PersistentHistory {
  constructor({ storageDir = './data' } = {}) {
    this.storageDir = storageDir;
    this.chatsDir = path.join(storageDir, 'chats');

    if (!fs.existsSync(this.storageDir)) {
      fs.mkdirSync(this.storageDir, { recursive: true });
    }
    if (!fs.existsSync(this.chatsDir)) {
      fs.mkdirSync(this.chatsDir, { recursive: true });
    }
  }

  getFilePath(chatId) {
    return path.join(this.chatsDir, `${chatId}.json`);
  }

  save(chatId, messages) {
    const filePath = this.getFilePath(chatId);
    const data = {
      chatId,
      messages,
      lastUpdated: new Date().toISOString(),
    };
    try {
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (err) {
      console.error(`[storage] Failed to save chat ${chatId}:`, err.message);
    }
  }

  load(chatId) {
    const filePath = this.getFilePath(chatId);
    try {
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf-8');
        const data = JSON.parse(content);
        return data.messages || [];
      }
    } catch (err) {
      console.error(`[storage] Failed to load chat ${chatId}:`, err.message);
    }
    return [];
  }

  delete(chatId) {
    const filePath = this.getFilePath(chatId);
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (err) {
      console.error(`[storage] Failed to delete chat ${chatId}:`, err.message);
    }
  }

  getStats() {
    const stats = {};
    try {
      const files = fs.readdirSync(this.chatsDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const chatId = file.slice(0, -5);
          const filePath = path.join(this.chatsDir, file);
          const content = fs.readFileSync(filePath, 'utf-8');
          const data = JSON.parse(content);
          stats[chatId] = {
            messages: (data.messages || []).length,
          };
        }
      }
    } catch (err) {
      console.error('[storage] Failed to get stats:', err.message);
    }
    return stats;
  }
}

module.exports = { PersistentHistory };
