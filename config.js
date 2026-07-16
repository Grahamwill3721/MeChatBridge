/**
 * MeChat Bridge
 * Public browser configuration
 *
 * IMPORTANT:
 * Never place OpenAI keys, n8n credentials, database passwords,
 * or any private secrets in this file.
 */

window.MECHAT_CONFIG = {
  appName: "MeChat Bridge",
  version: "1.0.0",

  /**
   * Paste the active n8n Production Webhook URL here.
   *
   * Example:
   * https://your-n8n-domain.com/webhook/mechat-bridge
   */
  webhookUrl: "",

  /**
   * Keep this true while building the interface.
   * Change it to false after the n8n webhook is connected.
   */
  demoMode: true,

  requestTimeoutMs: 45000,

  defaultSourceLanguage: "en",
  defaultTargetLanguage: "ne",

  languages: [
    {
      code: "en",
      name: "English",
      locale: "en-US",
      speechRecognitionLocale: "en-US",
      direction: "ltr",
      enabled: true
    },
    {
      code: "ne",
      name: "Nepali",
      locale: "ne-NP",
      speechRecognitionLocale: "ne-NP",
      direction: "ltr",
      enabled: true
    },
    {
      code: "ja",
      name: "Japanese",
      locale: "ja-JP",
      speechRecognitionLocale: "ja-JP",
      direction: "ltr",
      enabled: false
    },
    {
      code: "hi",
      name: "Hindi",
      locale: "hi-IN",
      speechRecognitionLocale: "hi-IN",
      direction: "ltr",
      enabled: false
    },
    {
      code: "es",
      name: "Spanish",
      locale: "es-ES",
      speechRecognitionLocale: "es-ES",
      direction: "ltr",
      enabled: false
    },
    {
      code: "fr",
      name: "French",
      locale: "fr-FR",
      speechRecognitionLocale: "fr-FR",
      direction: "ltr",
      enabled: false
    },
    {
      code: "ar",
      name: "Arabic",
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
    culturallyAdapt: true,
    avoidLiteralTranslation: true,
    requestClarificationWhenAmbiguous: true
  },

  conversationProfile: {
    relationship: "trusted personal conversation",
    preferredTone: "warm, gentle and respectful",
    regionalPreference: "natural recipient-language phrasing"
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
    saveLocalConversationId: true
  }
};
