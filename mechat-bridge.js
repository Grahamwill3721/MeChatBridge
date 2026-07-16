(function () {
  "use strict";

  class MeChatBridgeClient {
    constructor(config = {}) {
      this.config = config;

      this.conversationId =
        localStorage.getItem("mechatBridgeConversationId") ||
        this.createConversationId();

      localStorage.setItem(
        "mechatBridgeConversationId",
        this.conversationId
      );
    }

    createConversationId() {
      if (
        typeof crypto !== "undefined" &&
        typeof crypto.randomUUID === "function"
      ) {
        return crypto.randomUUID();
      }

      return `mechat-bridge-${Date.now()}-${Math.random()
        .toString(16)
        .slice(2)}`;
    }

    async processMessage({
      text,
      sourceLanguage,
      targetLanguage,
      mode = "translate",
      recentMessages = []
    }) {
      const payload = {
        conversationId: this.conversationId,
        timestamp: new Date().toISOString(),
        mode,
        sourceLanguage,
        targetLanguage,
        originalText: String(text || "").trim(),
        relationshipContext: {
          ...(this.config.relationshipContext || {}),
          ...(this.config.conversationProfile || {}),
          ...(this.config.translationCapability || {})
        },
        recentMessages: Array.isArray(recentMessages)
          ? recentMessages.slice(-8)
          : []
      };

      if (!payload.originalText) {
        throw new Error("The message is empty.");
      }

      const webhookUrl = String(
        this.config.webhookUrl || ""
      ).trim();

      if (!webhookUrl) {
        if (this.config.demoMode !== false) {
          return this.createDemoResponse(payload);
        }

        throw new Error(
          "The n8n webhook URL has not been configured."
        );
      }

      return this.sendWebhookRequest(
        webhookUrl,
        payload
      );
    }

    async sendWebhookRequest(
      webhookUrl,
      payload
    ) {
      const controller =
        new AbortController();

      const timeoutMilliseconds =
        Number(
          this.config.requestTimeoutMs
        ) || 45000;

      const timeoutId =
        window.setTimeout(
          () => controller.abort(),
          timeoutMilliseconds
        );

      try {
        const response = await fetch(
          webhookUrl,
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json"
            },
            body:
              JSON.stringify(payload),
            signal:
              controller.signal
          }
        );

        if (!response.ok) {
          const responseText =
            await response.text();

          throw new Error(
            responseText ||
            `The bridge request failed with status ${response.status}.`
          );
        }

        const data =
          await response.json();

        return this.normaliseResponse(
          data,
          payload
        );
      } finally {
        window.clearTimeout(timeoutId);
      }
    }

    normaliseResponse(
      data,
      payload
    ) {
      const result =
        Array.isArray(data)
          ? data[0]
          : data;

      if (
        !result ||
        typeof result !== "object"
      ) {
        throw new Error(
          "The bridge returned an invalid response."
        );
      }

      return {
        translatedText:
          result.translatedText ||
          result.translation ||
          result.output ||
          result.text ||
          "",

        improvedText:
          result.improvedText ||
          result.refinedText ||
          "",

        originalText:
          result.originalText ||
          payload.originalText,

        sourceLanguage:
          result.sourceLanguage ||
          payload.sourceLanguage,

        targetLanguage:
          result.targetLanguage ||
          payload.targetLanguage,

        confidence:
          Number(
            result.confidence ?? 0.9
          ),

        ambiguityDetected:
          Boolean(
            result.ambiguityDetected
          ),

        needsClarification:
          Boolean(
            result.needsClarification
          ),

        clarificationQuestion:
          result.clarificationQuestion ||
          ""
      };
    }

    createDemoResponse(payload) {
      const isImproveMode =
        payload.mode === "improve";

      if (isImproveMode) {
        return Promise.resolve({
          originalText:
            payload.originalText,

          improvedText:
            payload.originalText,

          translatedText: "",

          sourceLanguage:
            payload.sourceLanguage,

          targetLanguage:
            payload.sourceLanguage,

          confidence: 0.5,

          ambiguityDetected: false,

          needsClarification: false,

          clarificationQuestion: ""
        });
      }

      return Promise.resolve({
        originalText:
          payload.originalText,

        translatedText:
          `[Prototype ${String(
            payload.targetLanguage
          ).toUpperCase()}] ${payload.originalText}`,

        improvedText: "",

        sourceLanguage:
          payload.sourceLanguage,

        targetLanguage:
          payload.targetLanguage,

        confidence: 0.5,

        ambiguityDetected: false,

        needsClarification: false,

        clarificationQuestion: ""
      });
    }
  }

  window.MeChatBridgeClient =
    MeChatBridgeClient;
})();
