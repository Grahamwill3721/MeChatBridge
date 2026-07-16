/**
 * MeChat Bridge
 * Public runtime configuration
 *
 * Never place private API keys, passwords,
 * database credentials or secrets in this file.
 */

window.MECHAT_CONFIG = {
  appName: "MeChat Bridge",

  version: "1.0.0",

webhookUrl:
  "https://arkdaia2.app.n8n.cloud/webhook/mechatbridgev1",

messagesWebhookUrl:
  "https://arkdaia2.app.n8n.cloud/webhook/mechatbridge-messages",
 
demoMode: false,

requestTimeoutMs: 45000,

defaultSourceLanguage: "en",

  defaultTargetLanguage: "ne",

  languages: [
    {
      code: "en",
      name: "English",
      label: "English",
      locale: "en-US",
      speechRecognitionLocale: "en-US",
      direction: "ltr",
      enabled: true
    },

    {
      code: "ne",
      name: "Nepali",
      label: "Nepali",
      locale: "ne-NP",
      speechRecognitionLocale: "ne-NP",
      direction: "ltr",
      enabled: true
    },

    {
      code: "ja",
      name: "Japanese",
      label: "Japanese",
      locale: "ja-JP",
      speechRecognitionLocale: "ja-JP",
      direction: "ltr",
      enabled: false
    },

    {
      code: "hi",
      name: "Hindi",
      label: "Hindi",
      locale: "hi-IN",
      speechRecognitionLocale: "hi-IN",
      direction: "ltr",
      enabled: false
    },

    {
      code: "es",
      name: "Spanish",
      label: "Spanish",
      locale: "es-ES",
      speechRecognitionLocale: "es-ES",
      direction: "ltr",
      enabled: false
    },

    {
      code: "fr",
      name: "French",
      label: "French",
      locale: "fr-FR",
      speechRecognitionLocale: "fr-FR",
      direction: "ltr",
      enabled: false
    },

    {
      code: "ar",
      name: "Arabic",
      label: "Arabic",
      locale: "ar-QA",
      speechRecognitionLocale: "ar-QA",
      direction: "rtl",
      enabled: false
    }
  ],

  translationCapability: {
    preserveMeaning: true,

    preserveIntent: true,

    preserveTone: true,

    preserveRespect: true,

    preserveRelationship: true,

    preserveNames: true,

    preserveFamilyTerms: true,

    culturallyAdapt: true,

    avoidLiteralTranslation: true,

    requestClarificationWhenAmbiguous: true
  },

  conversationProfile: {
    relationship:
      "trusted personal conversation",

    preferredTone:
      "warm, gentle and respectful",

    regionalPreference:
      "natural recipient-language phrasing"
  },

  relationshipContext: {
    relationship:
      "trusted personal conversation",

    tone:
      "warm, gentle and respectful",

    preserveMeaning: true,

    preserveRespect: true,

    preserveRelationship: true,

    avoidLiteralTranslation: true
  },

  voiceInput: {
    enabled: true,

    inputOnly: true,

    editableTranscript: true,

    continuousRecognition: true,

    interimResults: true
  },

  interface: {
    showOriginalMessage: true,

    allowWordingImprovement: true,

    showTranslationConfidence: false,

    saveLocalConversationId: true,

    enableSakuraAnimation: true
  }
};
