(function () {
  "use strict";

  class MeChatBridgeClient {
    constructor(config = {}) {
      this.config = config;

      this.conversationId =
        localStorage.getItem(
          "mechatBridgeConversationId"
        ) ||
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
        conversationId:
          this.conversationId,

        timestamp:
          new Date().toISOString(),

        mode,

        sourceLanguage,

        targetLanguage,

        originalText:
          String(text || "").trim(),

        relationshipContext: {
          ...(this.config
            .relationshipContext || {}),

          ...(this.config
            .conversationProfile || {}),

          ...(this.config
            .translationCapability || {})
        },

        recentMessages:
          Array.isArray(recentMessages)
            ? recentMessages.slice(-8)
            : []
      };

      if (!payload.originalText) {
        throw new Error(
          "The message is empty."
        );
      }

      const webhookUrl =
        String(
          this.config.webhookUrl || ""
        ).trim();

      if (!webhookUrl) {
        if (
          this.config.demoMode !== false
        ) {
          return this.createDemoResponse(
            payload
          );
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
        const response =
          await fetch(
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
        window.clearTimeout(
          timeoutId
        );
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

      const englishText =
        String(
          result.englishText || ""
        ).trim();

      const nepaliText =
        String(
          result.nepaliText || ""
        ).trim();

      const romanNepaliText =
        String(
          result.romanNepaliText ||
          result.romanizedText ||
          ""
        ).trim();

      const translatedText =
        String(
          result.translatedText ||
          result.translation ||
          result.output ||
          result.text ||
          nepaliText ||
          englishText ||
          ""
        ).trim();

      return {
        translatedText,

        englishText,

        nepaliText,

        romanNepaliText,

        romanizedText:
          romanNepaliText,

        detectedLanguage:
          String(
            result.detectedLanguage ||
            ""
          ).trim(),

        improvedText:
          String(
            result.improvedText ||
            result.refinedText ||
            ""
          ).trim(),

        originalText:
          String(
            result.originalText ||
            payload.originalText
          ).trim(),

        sourceLanguage:
          result.sourceLanguage ||
          result.senderLanguage ||
          payload.sourceLanguage,

        targetLanguage:
          result.targetLanguage ||
          result.recipientLanguage ||
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
          String(
            result.clarificationQuestion ||
            ""
          ).trim(),

        conversationId:
          result.conversationId ||
          payload.conversationId,

        fromUser:
          result.fromUser || null,

        toUser:
          result.toUser || null,

        timestamp:
          result.timestamp ||
          payload.timestamp
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

          englishText: "",

          nepaliText: "",

          romanNepaliText: "",

          romanizedText: "",

          detectedLanguage:
            payload.sourceLanguage,

          sourceLanguage:
            payload.sourceLanguage,

          targetLanguage:
            payload.sourceLanguage,

          confidence: 0.5,

          ambiguityDetected: false,

          needsClarification: false,

          clarificationQuestion: "",

          conversationId:
            payload.conversationId,

          timestamp:
            payload.timestamp
        });
      }

      const prototypeText =
        `[Prototype ${String(
          payload.targetLanguage
        ).toUpperCase()}] ${payload.originalText}`;

      return Promise.resolve({
        originalText:
          payload.originalText,

        translatedText:
          prototypeText,

        englishText:
          payload.targetLanguage === "en"
            ? prototypeText
            : "",

        nepaliText:
          payload.targetLanguage === "ne"
            ? prototypeText
            : "",

        romanNepaliText:
          "",

        romanizedText:
          "",

        detectedLanguage:
          payload.sourceLanguage,

        improvedText: "",

        sourceLanguage:
          payload.sourceLanguage,

        targetLanguage:
          payload.targetLanguage,

        confidence: 0.5,

        ambiguityDetected: false,

        needsClarification: false,

        clarificationQuestion: "",

        conversationId:
          payload.conversationId,

        timestamp:
          payload.timestamp
      });
    }
  }

  window.MeChatBridgeClient =
    MeChatBridgeClient;
})();
