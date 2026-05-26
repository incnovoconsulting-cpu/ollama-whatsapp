const { Ollama } = require('ollama');

class OllamaClient {
  constructor({ host, model, systemPrompt, temperature = 0.7 }) {
    this.client = new Ollama({ host });
    this.model = model;
    this.systemPrompt = systemPrompt;
    this.temperature = temperature;
    this.modelCache = null;
    this.modelCacheTime = 0;
  }

  async listAvailableModels() {
    const now = Date.now();
    if (this.modelCache && now - this.modelCacheTime < 30000) {
      return this.modelCache;
    }
    const { models } = await this.client.list();
    this.modelCache = models.map((m) => m.name);
    this.modelCacheTime = now;
    return this.modelCache;
  }

  async ensureModel(modelName = this.model) {
    const models = await this.listAvailableModels();
    const found = models.some((m) => m === modelName || m.startsWith(`${modelName}:`));
    if (!found) {
      throw new Error(
        `Model "${modelName}" is not available on the Ollama server. Pull it first: \`ollama pull ${modelName}\``
      );
    }
  }

  async switchModel(newModel) {
    await this.ensureModel(newModel);
    this.model = newModel;
  }

  setTemperature(temp) {
    this.temperature = Math.max(0, Math.min(1, temp));
  }

  getTemperature() {
    return this.temperature;
  }

  async chat(history) {
    const messages = [
      { role: 'system', content: this.systemPrompt },
      ...history,
    ];
    const response = await this.client.chat({
      model: this.model,
      messages,
      temperature: this.temperature,
      stream: false,
    });
    return response.message?.content?.trim() || '';
  }
}

module.exports = { OllamaClient };
