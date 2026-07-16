/** Public runtime configuration. Never place private API keys here. */
window.MECHAT_CONFIG = {
  appName: "MeChat Bridge",
  version: "1.0.0",
  webhookUrl: "",
  demoMode: true,
  requestTimeoutMs: 45000,
  defaultSourceLanguage: "en",
  defaultTargetLanguage: "ne",
  languages: [
    { code: "en", label: "English", locale: "en-US" },
    { code: "ne", label: "Nepali", locale: "ne-NP" },
    { code: "ja", label: "Japanese", locale: "ja-JP" },
    { code: "hi", label: "Hindi", locale: "hi-IN" },
    { code: "es", label: "Spanish", locale: "es-ES" },
    { code: "fr", label: "French", locale: "fr-FR" },
    { code: "ar", label: "Arabic", locale: "ar-QA" }
  ],
  relationshipContext: {
    relationship: "trusted personal conversation",
    tone: "warm, gentle and respectful",
    preserveMeaning: true,
    preserveRespect: true,
    avoidLiteralTranslation: true
  }
};
