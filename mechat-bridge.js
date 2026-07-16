(function () {
  "use strict";

  class MeChatBridgeClient {
    constructor(config) {
      if (!config) {
        throw new Error(
          "MeChat Bridge configuration is missing."
        );
      }

      this.config = config;

      this.conversationId =
        localStorage.getItem(
          "mechatConversationId"
        ) || crypto.randomUUID();

      localStorage.setItem(
        "mechatConversationId",
        this.conversationId
      );
    }

    async processMessage({
      text,
      sourceLanguage,
      targetLanguage,
      mode = "translate",
      recentMessages = []
    }) {
      const payload = {
        conversationId:
          this.conversationId,

        timestamp:
          new Date().toISOString(),

        mode,

        sourceLanguage,

        targetLanguage,

        originalText: text,

        relationshipContext: {
          ...(this.config.conversationProfile || {}),
          ...(this.config.relationshipContext || {}),
          ...(this.config.translationCapability || {})
        },

        recentMessages:
          Array.isArray(recentMessages)
            ? recentMessages.slice(-8)
            : []
      };

      if (
        !this.config.webhookUrl ||
        this.config.webhookUrl.trim() === ""
      ) {
        if (this.config.demoMode) {
          return this.createDemoResponse(
            payload
          );
        }

        throw new Error(
          "The n8n webhook URL has not been configured."
        );
      }

      return this.sendWebhookRequest(
        payload
      );
    }

    async sendWebhookRequest(payload) {
      const controller =
        new AbortController();

      const timeoutDuration =
        Number(
          this.config.requestTimeoutMs
        ) || 45000;

      const timeout = window.setTimeout(
        () => controller.abort(),
        timeoutDuration
      );

      try {
        const response = await fetch(
          this.config.webhookUrl,
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
            `Bridge request failed with status ${response.status}.`
          );
        }

        const data =
          await response.json();

        return this.normaliseResponse(
          data,
          payload
        );
      } finally {
        window.clearTimeout(timeout);
      }
    }

    normaliseResponse(data, payload) {
      const result =
        Array.isArray(data)
          ? data[0]
          : data;

      if (!result || typeof result !== "object") {
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
            payload.originalText.trim(),

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
          `[Demo ${String(
            payload.targetLanguage
          ).toUpperCase()}] ${payload.originalText.trim()}`,

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
