(function () {
  "use strict";

  const config = window.MECHAT_CONFIG;

  if (!config) {
    console.error("MeChat Bridge configuration was not found.");
    return;
  }

  if (!window.MeChatBridgeClient) {
    console.error("MeChatBridgeClient was not found.");
    return;
  }

  const bridge = new window.MeChatBridgeClient(config);

  const elements = {
    sourceLanguage: document.getElementById("sourceLanguage"),
    targetLanguage: document.getElementById("targetLanguage"),
    messageInput: document.getElementById("messageInput"),
    messages: document.getElementById("messages"),
    sendButton: document.getElementById("sendButton"),
    micButton: document.getElementById("micButton"),
    improveButton: document.getElementById("improveButton"),
    clearChatButton: document.getElementById("clearChatButton"),
    voiceStatus: document.getElementById("voiceStatus")
  };

  let speechRecognition = null;
  let isListening = false;
  let finalTranscript = "";

  const conversationMemory = [];

  function validateRequiredElements() {
    const missingElements = Object.entries(elements)
      .filter(([, element]) => !element)
      .map(([name]) => name);

    if (missingElements.length > 0) {
      console.error(
        "The following required HTML elements were not found:",
        missingElements
      );

      return false;
    }

    return true;
  }

  function getEnabledLanguages() {
    return config.languages.filter(
      (language) => language.enabled !== false
    );
  }

  function getLanguage(code) {
    return config.languages.find(
      (language) => language.code === code
    );
  }

  function getLanguageName(code) {
    const language = getLanguage(code);

    return language?.name || language?.label || code;
  }

  function getSpeechLocale(code) {
    const language = getLanguage(code);

    return (
      language?.speechRecognitionLocale ||
      language?.locale ||
      "en-US"
    );
  }

  function populateLanguages() {
    const enabledLanguages = getEnabledLanguages();

    elements.sourceLanguage.innerHTML = "";
    elements.targetLanguage.innerHTML = "";

    enabledLanguages.forEach((language) => {
      const languageName =
        language.name ||
        language.label ||
        language.code;

      const sourceOption = new Option(
        languageName,
        language.code
      );

      const targetOption = new Option(
        languageName,
        language.code
      );

      elements.sourceLanguage.add(sourceOption);
      elements.targetLanguage.add(targetOption);
    });

    elements.sourceLanguage.value =
      config.defaultSourceLanguage;

    elements.targetLanguage.value =
      config.defaultTargetLanguage;

    ensureDifferentLanguages();
  }

  function ensureDifferentLanguages() {
    if (
      elements.sourceLanguage.value !==
      elements.targetLanguage.value
    ) {
      return;
    }

    const alternativeLanguage = getEnabledLanguages().find(
      (language) =>
        language.code !== elements.sourceLanguage.value
    );

    if (alternativeLanguage) {
      elements.targetLanguage.value =
        alternativeLanguage.code;
    }
  }

  function formatCurrentTime() {
    return new Intl.DateTimeFormat(undefined, {
      hour: "2-digit",
      minute: "2-digit"
    }).format(new Date());
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function appendMessage({
    role,
    text,
    label = "",
    originalText = "",
    loading = false
  }) {
    const article = document.createElement("article");

    article.className =
      `message ${role}${loading ? " loading" : ""}`;

    const avatarHtml =
      role === "assistant"
        ? `
          <div
            class="message-avatar"
            aria-hidden="true"
          >
            ☺
          </div>
        `
        : "";

    const labelHtml = label
      ? `<strong>${escapeHtml(label)}</strong>`
      : "";

    const originalMessageHtml = originalText
      ? `
        <button
          class="original-toggle"
          type="button"
        >
          Show original
        </button>

        <p
          class="original-text"
          hidden
        >
          ${escapeHtml(originalText)}
        </p>
      `
      : "";

    article.innerHTML = `
      ${avatarHtml}

      <div class="bubble">
        ${labelHtml}

        <p>${escapeHtml(text)}</p>

        ${originalMessageHtml}

        <time>${formatCurrentTime()}</time>
      </div>
    `;

    const originalToggle =
      article.querySelector(".original-toggle");

    if (originalToggle) {
      originalToggle.addEventListener("click", () => {
        const originalTextElement =
          article.querySelector(".original-text");

        if (!originalTextElement) {
          return;
        }

        originalTextElement.hidden =
          !originalTextElement.hidden;

        originalToggle.textContent =
          originalTextElement.hidden
            ? "Show original"
            : "Hide original";
      });
    }

    elements.messages.append(article);

    elements.messages.scrollTop =
      elements.messages.scrollHeight;

    return article;
  }

  function setInterfaceBusy(isBusy) {
    elements.sendButton.disabled = isBusy;
    elements.improveButton.disabled = isBusy;
    elements.messageInput.disabled = isBusy;

    if (isBusy && isListening) {
      stopListening();
    }
  }

  function showVoiceStatus(
    message,
    automaticallyHide = false
  ) {
    elements.voiceStatus.textContent = message;
    elements.voiceStatus.hidden = false;

    if (automaticallyHide) {
      window.setTimeout(() => {
        elements.voiceStatus.hidden = true;
      }, 4500);
    }
  }

  function hideVoiceStatus() {
    elements.voiceStatus.hidden = true;
    elements.voiceStatus.textContent = "";
  }

  function buildConversationContext() {
    return conversationMemory.slice(-8);
  }

  async function sendMessage() {
    const originalText =
      elements.messageInput.value.trim();

    if (!originalText) {
      elements.messageInput.focus();
      return;
    }

    const sourceLanguage =
      elements.sourceLanguage.value;

    const targetLanguage =
      elements.targetLanguage.value;

    if (sourceLanguage === targetLanguage) {
      showVoiceStatus(
        "Please select two different languages.",
        true
      );

      return;
    }

    appendMessage({
      role: "user",
      text: originalText,
      label: `You · ${getLanguageName(sourceLanguage)}`
    });

    conversationMemory.push({
      role: "user",
      text: originalText,
      language: sourceLanguage,
      timestamp: new Date().toISOString()
    });

    elements.messageInput.value = "";

    setInterfaceBusy(true);

    const pendingMessage = appendMessage({
      role: "assistant",
      text: "Bridging your message",
      label: "MeChat Bridge",
      loading: true
    });

    try {
      const result = await bridge.processMessage({
        text: originalText,
        sourceLanguage,
        targetLanguage,
        mode: "translate",
        recentMessages: buildConversationContext()
      });

      pendingMessage.remove();

      if (
        result.needsClarification &&
        result.clarificationQuestion
      ) {
        appendMessage({
          role: "assistant",
          text: result.clarificationQuestion,
          label: "Clarification needed"
        });

        conversationMemory.push({
          role: "assistant",
          text: result.clarificationQuestion,
          language: sourceLanguage,
          type: "clarification",
          timestamp: new Date().toISOString()
        });

        return;
      }

      const translatedText =
        result.translatedText ||
        "No translation was returned.";

      appendMessage({
        role: "assistant",
        text: translatedText,
        originalText:
          result.originalText || originalText,
        label:
          `MeChat Bridge · ${getLanguageName(targetLanguage)}`
      });

      conversationMemory.push({
        role: "assistant",
        text: translatedText,
        originalText:
          result.originalText || originalText,
        language: targetLanguage,
        confidence: result.confidence,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      pendingMessage.remove();

      const errorMessage =
        error.name === "AbortError"
          ? "The request timed out. Please try again."
          : `I could not bridge that message: ${error.message}`;

      appendMessage({
        role: "assistant",
        text: errorMessage,
        label: "Connection issue"
      });

      console.error("MeChat Bridge error:", error);
    } finally {
      setInterfaceBusy(false);
      elements.messageInput.focus();
    }
  }

  async function improveWording() {
    const originalText =
      elements.messageInput.value.trim();

    if (!originalText) {
      showVoiceStatus(
        "Type or speak a message before improving the wording.",
        true
      );

      elements.messageInput.focus();
      return;
    }

    const originalButtonText =
      elements.improveButton.textContent;

    elements.improveButton.textContent =
      "Improving…";

    elements.improveButton.disabled = true;

    try {
      const sourceLanguage =
        elements.sourceLanguage.value;

      const result = await bridge.processMessage({
        text: originalText,
        sourceLanguage,
        targetLanguage: sourceLanguage,
        mode: "improve",
        recentMessages: buildConversationContext()
      });

      const improvedText =
        result.improvedText ||
        result.translatedText ||
        originalText;

      elements.messageInput.value = improvedText;

      showVoiceStatus(
        "Wording improved. Review the message before sending.",
        true
      );
    } catch (error) {
      showVoiceStatus(
        `Wording improvement is unavailable: ${error.message}`,
        true
      );

      console.error(
        "Improve wording error:",
        error
      );
    } finally {
      elements.improveButton.textContent =
        originalButtonText;

      elements.improveButton.disabled = false;

      elements.messageInput.focus();
    }
  }

  function setupSpeechRecognition() {
    const SpeechRecognition =
      window.SpeechRecognition ||
      window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      elements.micButton.disabled = true;

      elements.micButton.title =
        "Speech recognition is not supported in this browser.";

      showVoiceStatus(
        "Voice input is not supported in this browser. You can still type your message.",
        true
      );

      return;
    }

    speechRecognition = new SpeechRecognition();

    speechRecognition.continuous =
      config.voiceInput?.continuousRecognition ??
      true;

    speechRecognition.interimResults =
      config.voiceInput?.interimResults ??
      true;

    speechRecognition.maxAlternatives = 1;

    speechRecognition.onstart = () => {
      isListening = true;
      finalTranscript = "";

      elements.micButton.classList.add(
        "listening"
      );

      elements.micButton.setAttribute(
        "aria-label",
        "Stop voice input"
      );

      elements.micButton.title =
        "Stop voice input";

      showVoiceStatus(
        "Listening… Speak naturally. Your transcript will remain editable."
      );
    };

    speechRecognition.onresult = (event) => {
      let interimTranscript = "";
      let newFinalTranscript = "";

      for (
        let index = event.resultIndex;
        index < event.results.length;
        index += 1
      ) {
        const transcript =
          event.results[index][0].transcript;

        if (event.results[index].isFinal) {
          newFinalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      if (newFinalTranscript) {
        finalTranscript += newFinalTranscript;

        const currentText =
          elements.messageInput.value.trim();

        const spacing =
          currentText &&
          !currentText.endsWith(" ")
            ? " "
            : "";

        elements.messageInput.value =
          `${currentText}${spacing}${newFinalTranscript}`
            .trimStart();
      }

      if (interimTranscript) {
        elements.voiceStatus.textContent =
          `Listening… ${interimTranscript}`;
      } else {
        elements.voiceStatus.textContent =
          "Listening… Your transcript is ready to review.";
      }
    };

    speechRecognition.onerror = (event) => {
      const errorMessages = {
        "not-allowed":
          "Microphone permission was denied.",
        "service-not-allowed":
          "Voice recognition is not permitted.",
        "no-speech":
          "No speech was detected.",
        "audio-capture":
          "No microphone was detected.",
        network:
          "A network error interrupted voice recognition.",
        aborted:
          "Voice input was stopped."
      };

      const message =
        errorMessages[event.error] ||
        `Voice input stopped: ${event.error}`;

      showVoiceStatus(message, true);

      console.error(
        "Speech recognition error:",
        event.error
      );
    };

    speechRecognition.onend = () => {
      isListening = false;

      elements.micButton.classList.remove(
        "listening"
      );

      elements.micButton.setAttribute(
        "aria-label",
        "Start voice input"
      );

      elements.micButton.title =
        "Start voice input";

      if (elements.messageInput.value.trim()) {
        showVoiceStatus(
          "Voice input complete. Review and edit the transcript before sending."
        );
      } else {
        hideVoiceStatus();
      }
    };
  }

  function startListening() {
    if (!speechRecognition) {
      return;
    }

    speechRecognition.lang =
      getSpeechLocale(
        elements.sourceLanguage.value
      );

    try {
      speechRecognition.start();
    } catch (error) {
      console.error(
        "Could not start voice input:",
        error
      );
    }
  }

  function stopListening() {
    if (!speechRecognition || !isListening) {
      return;
    }

    speechRecognition.stop();
  }

  function toggleMicrophone() {
    if (!speechRecognition) {
      return;
    }

    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }

  function clearConversation() {
    const confirmed = window.confirm(
      "Clear this local conversation view?"
    );

    if (!confirmed) {
      return;
    }

    const messages =
      elements.messages.querySelectorAll(
        ".message"
      );

    messages.forEach((message, index) => {
      if (index > 0) {
        message.remove();
      }
    });

    conversationMemory.length = 0;
    elements.messageInput.value = "";

    hideVoiceStatus();

    elements.messageInput.focus();
  }

  function handleSourceLanguageChange() {
    ensureDifferentLanguages();

    if (isListening) {
      stopListening();
    }

    showVoiceStatus(
      `Voice input language set to ${getLanguageName(
        elements.sourceLanguage.value
      )}.`,
      true
    );
  }

  function handleTargetLanguageChange() {
    ensureDifferentLanguages();
  }

  function registerEventListeners() {
    elements.sendButton.addEventListener(
      "click",
      sendMessage
    );

    elements.improveButton.addEventListener(
      "click",
      improveWording
    );

    elements.micButton.addEventListener(
      "click",
      toggleMicrophone
    );

    elements.clearChatButton.addEventListener(
      "click",
      clearConversation
    );

    elements.sourceLanguage.addEventListener(
      "change",
      handleSourceLanguageChange
    );

    elements.targetLanguage.addEventListener(
      "change",
      handleTargetLanguageChange
    );

    elements.messageInput.addEventListener(
      "keydown",
      (event) => {
        if (
          event.key === "Enter" &&
          !event.shiftKey
        ) {
          event.preventDefault();
          sendMessage();
        }
      }
    );
  }

  function initialiseApplication() {
    if (!validateRequiredElements()) {
      return;
    }

    populateLanguages();
    setupSpeechRecognition();
    registerEventListeners();

    elements.messageInput.focus();
  }

  initialiseApplication();
})();
