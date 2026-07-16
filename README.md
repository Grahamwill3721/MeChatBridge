(function () {
  "use strict";

  class MeChatBridgeClient {
    constructor(config) {
      this.config = config;
      this.conversationId = localStorage.getItem("mechatConversationId") || crypto.randomUUID();
      localStorage.setItem("mechatConversationId", this.conversationId);
    }

    async processMessage({ text, sourceLanguage, targetLanguage, mode = "translate", recentMessages = [] }) {
      const payload = {
        conversationId: this.conversationId,
        timestamp: new Date().toISOString(),
        mode,
        sourceLanguage,
        targetLanguage,
        originalText: text,
        relationshipContext: this.config.relationshipContext,
        recentMessages: recentMessages.slice(-8)
      };

      if (!this.config.webhookUrl) {
        if (this.config.demoMode) return this.demoResponse(payload);
        throw new Error("The n8n webhook URL has not been configured.");
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.config.requestTimeoutMs || 45000);

      try {
        const response = await fetch(this.config.webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          signal: controller.signal
        });
        if (!response.ok) throw new Error(`Bridge request failed (${response.status}).`);
        return this.normalizeResponse(await response.json(), payload);
      } finally {
        clearTimeout(timeout);
      }
    }

    normalizeResponse(data, payload) {
      const result = Array.isArray(data) ? data[0] : data;
      return {
        translatedText: result.translatedText || result.translation || result.output || result.text || "",
        improvedText: result.improvedText || result.refinedText || "",
        originalText: result.originalText || payload.originalText,
        sourceLanguage: result.sourceLanguage || payload.sourceLanguage,
        targetLanguage: result.targetLanguage || payload.targetLanguage,
        confidence: Number(result.confidence ?? 0.9),
        ambiguityDetected: Boolean(result.ambiguityDetected),
        needsClarification: Boolean(result.needsClarification),
        clarificationQuestion: result.clarificationQuestion || ""
      };
    }

    demoResponse(payload) {
      const isImprove = payload.mode === "improve";
      return Promise.resolve({
        originalText: payload.originalText,
        improvedText: isImprove ? payload.originalText.trim() : "",
        translatedText: isImprove ? "" : `[Demo ${payload.targetLanguage.toUpperCase()}] ${payload.originalText.trim()}`,
        sourceLanguage: payload.sourceLanguage,
        targetLanguage: payload.targetLanguage,
        confidence: 0.5,
        ambiguityDetected: false,
        needsClarification: false,
        clarificationQuestion: ""
      });
    }
  }

  window.MeChatBridgeClient = MeChatBridgeClient;
})();
