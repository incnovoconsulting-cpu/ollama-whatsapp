const { Ollama } = require('ollama');

class OllamaClient {
  constructor({ host, model, systemPrompt, temperature = 0.7 } = {}) {
    this.host = host;
    this.model = model;
    this.systemPrompt = systemPrompt;
    this.temperature = temperature;
    this.ollama = new Ollama({ baseUrl: host });
  }

  async ensureModel() {
    try {
      const response = await fetch(`${this.host}/api/tags`);
      if (!response.ok) {
        throw new Error(`Ollama server error: ${response.statusText}`);
      }
      const data = await response.json();
      const models = (data.models || []).map((m) => m.name);

      if (!models.includes(this.model)) {
        throw new Error(
          `Model "${this.model}" not found. Available models: ${models.join(', ')}. ` +
          `Pull it with: ollama pull ${this.model}`
        );
      }
    } catch (err) {
      throw new Error(`Cannot reach Ollama at ${this.host}: ${err.message}`);
    }
  }

  async chat(messages) {
    const fullMessages = [
      { role: 'system', content: this.systemPrompt },
      ...messages,
    ];

    try {
      const response = await this.ollama.generate({
        model: this.model,
        messages: fullMessages,
        temperature: this.temperature,
        stream: false,
      });

      return response.response || '';
    } catch (err) {
      throw new Error(`Ollama generation failed: ${err.message}`);
    }
  }

  async listAvailableModels() {
    try {
      const response = await fetch(`${this.host}/api/tags`);
      const data = await response.json();
      return (data.models || []).map((m) => m.name);
    } catch (err) {
      throw new Error(`Cannot list models: ${err.message}`);
    }
  }

  async switchModel(newModel) {
    const models = await this.listAvailableModels();
    if (!models.includes(newModel)) {
      throw new Error(
        `Model "${newModel}" not found. Available: ${models.join(', ')}`
      );
    }
    this.model = newModel;
  }

  setTemperature(value) {
    if (value < 0 || value > 1) {
      throw new Error('Temperature must be between 0 and 1');
    }
    this.temperature = value;
  }

  getTemperature() {
    return this.temperature;
  }
}

module.exports = { OllamaClient };
