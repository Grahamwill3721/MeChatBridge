(function () {
  "use strict";

  class MeChatBridgeClient {
    constructor(config = {}) {
      this.config = config;

      const pageParameters =
        new URLSearchParams(
          window.location.search
        );

      /*
       * Both devices must use the same conversation value.
       *
       * Example:
       * ?conversation=graham-fulmaya-001
       */
      this.conversationId =
        pageParameters.get("conversation") ||
        localStorage.getItem(
          "mechatBridgeConversationId"
        ) ||
        "graham-fulmaya-001";

      localStorage.setItem(
        "mechatBridgeConversationId",
        this.conversationId
      );

      /*
       * Identifies which participant is using this device.
       *
       * Laptop:
       * ?user=graham
       *
       * Mobile:
       * ?user=fulmaya
       */
      this.currentUser =
        String(
          pageParameters.get("user") ||
          localStorage.getItem(
            "mechatBridgeCurrentUser"
          ) ||
          "graham"
        )
          .trim()
          .toLowerCase();

      localStorage.setItem(
        "mechatBridgeCurrentUser",
        this.currentUser
      );
    }

    createConversationId() {
      if (
        typeof crypto !== "undefined" &&
        typeof crypto.randomUUID ===
          "function"
      ) {
        return crypto.randomUUID();
      }

      return `mechat-bridge-${Date.now()}-${Math.random()
        .toString(16)
        .slice(2)}`;
    }

    getParticipantProfile() {
      const isGraham =
        this.currentUser === "graham";

      return {
        fromUser:
          isGraham
            ? "graham"
            : "fulmaya",

        toUser:
          isGraham
            ? "fulmaya"
            : "graham",

        senderPreferredLanguage:
          isGraham
            ? "en"
            : "ne",

        recipientPreferredLanguage:
          isGraham
            ? "ne"
            : "en"
      };
    }

    async processMessage({
      text,
      sourceLanguage,
      targetLanguage,
      mode = "translate",
      recentMessages = []
    }) {
      const participantProfile =
        this.getParticipantProfile();

      const payload = {
        conversationId:
          this.conversationId,

        fromUser:
          participantProfile.fromUser,

        toUser:
          participantProfile.toUser,

        senderPreferredLanguage:
          participantProfile
            .senderPreferredLanguage,

        recipientPreferredLanguage:
          participantProfile
            .recipientPreferredLanguage,

        timestamp:
          new Date().toISOString(),

        mode,

        /*
         * Keep the selected interface languages for compatibility
         * with the existing n8n workflow.
         */
        sourceLanguage:
          sourceLanguage ||
          participantProfile
            .senderPreferredLanguage,

        targetLanguage:
          targetLanguage ||
          participantProfile
            .recipientPreferredLanguage,

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

    /*
     * Retrieves all saved messages for the current shared
     * conversation.
     *
     * This will be used by app.js when we add automatic
     * laptop/mobile synchronisation.
     */
    async getConversationMessages() {
      const messagesWebhookUrl =
        String(
          this.config
            .messagesWebhookUrl || ""
        ).trim();

      if (!messagesWebhookUrl) {
        throw new Error(
          "The messages webhook URL has not been configured."
        );
      }

      const requestUrl =
        new URL(
          messagesWebhookUrl
        );

      requestUrl.searchParams.set(
        "conversationId",
        this.conversationId
      );

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
            requestUrl.toString(),
            {
              method: "GET",

              headers: {
                Accept:
                  "application/json"
              },

              signal:
                controller.signal
            }
          );

        if (!response.ok) {
          const responseText =
            await response.text();

          throw new Error(
            responseText ||
            `Conversation retrieval failed with status ${response.status}.`
          );
        }

        const data =
          await response.json();

        if (!Array.isArray(data)) {
          return [];
        }

        return data
          .filter(
            (message) =>
              message &&
              typeof message ===
                "object"
          )
          .sort(
            (firstMessage, secondMessage) => {
              const firstTime =
                new Date(
                  firstMessage.timestamp ||
                  firstMessage.createdAt ||
                  0
                ).getTime();

              const secondTime =
                new Date(
                  secondMessage.timestamp ||
                  secondMessage.createdAt ||
                  0
                ).getTime();

              return (
                firstTime -
                secondTime
              );
            }
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

        /*
         * Preserve this alias because the current app.js
         * also checks result.romanizedText.
         */
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

        senderPreferredLanguage:
          result
            .senderPreferredLanguage ||
          payload
            .senderPreferredLanguage,

        recipientPreferredLanguage:
          result
            .recipientPreferredLanguage ||
          payload
            .recipientPreferredLanguage,

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
            result
              .clarificationQuestion ||
            ""
          ).trim(),

        conversationId:
          result.conversationId ||
          payload.conversationId,

        fromUser:
          result.fromUser ||
          payload.fromUser,

        toUser:
          result.toUser ||
          payload.toUser,

        timestamp:
          result.timestamp ||
          payload.timestamp,

        id:
          result.id ?? null,

        createdAt:
          result.createdAt || "",

        updatedAt:
          result.updatedAt || ""
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

          senderPreferredLanguage:
            payload
              .senderPreferredLanguage,

          recipientPreferredLanguage:
            payload
              .recipientPreferredLanguage,

          confidence: 0.5,

          ambiguityDetected: false,

          needsClarification: false,

          clarificationQuestion: "",

          conversationId:
            payload.conversationId,

          fromUser:
            payload.fromUser,

          toUser:
            payload.toUser,

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

        romanNepaliText: "",

        romanizedText: "",

        detectedLanguage:
          payload.sourceLanguage,

        improvedText: "",

        sourceLanguage:
          payload.sourceLanguage,

        targetLanguage:
          payload.targetLanguage,

        senderPreferredLanguage:
          payload
            .senderPreferredLanguage,

        recipientPreferredLanguage:
          payload
            .recipientPreferredLanguage,

        confidence: 0.5,

        ambiguityDetected: false,

        needsClarification: false,

        clarificationQuestion: "",

        conversationId:
          payload.conversationId,

        fromUser:
          payload.fromUser,

        toUser:
          payload.toUser,

        timestamp:
          payload.timestamp
      });
    }
  }

  window.MeChatBridgeClient =
    MeChatBridgeClient;
})();
