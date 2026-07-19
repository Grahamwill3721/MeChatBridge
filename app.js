(function () {
  "use strict";

  const config = window.MECHAT_CONFIG || {};

  if (!window.MeChatBridgeClient) {
    console.error(
      "MeChatBridgeClient is unavailable. Check that mechat-bridge.js loads before app.js."
    );
    return;
  }

  const bridge = new window.MeChatBridgeClient(config);

  const elements = {
    messages: document.getElementById("messages"),
    messageInput: document.getElementById("messageInput"),
    micButton: document.getElementById("micButton"),
    sendButton: document.getElementById("sendButton"),
    improveButton: document.getElementById("improveButton"),
    clearChatButton: document.getElementById("clearChatButton"),
    sourceLanguage: document.getElementById("sourceLanguage"),
    targetLanguage: document.getElementById("targetLanguage"),
    connectionStatus: document.getElementById("connectionStatus"),
    voiceStatus: document.getElementById("voiceStatus"),
    petalLayer: document.getElementById("petalLayer")
  };

  let recognition = null;
  let isListening = false;

  const conversationMemory = [];
  const displayedDatabaseMessages =
  new Set();

let conversationSyncTimer = null;
let conversationSyncRunning = false;


  /* -------------------------------------------------- */
  /* VALIDATION                                         */
  /* -------------------------------------------------- */

  function validateRequiredElements() {
    const requiredElements = [
      "messages",
      "messageInput",
      "micButton",
      "sendButton",
      "improveButton",
      "clearChatButton",
      "sourceLanguage",
      "targetLanguage",
      "connectionStatus",
      "voiceStatus"
    ];

    const missingElements = requiredElements.filter(
      (name) => !elements[name]
    );

    if (missingElements.length > 0) {
      console.error(
        "Missing required HTML elements:",
        missingElements
      );

      return false;
    }

    return true;
  }


  /* -------------------------------------------------- */
  /* LANGUAGE CONFIGURATION                             */
  /* -------------------------------------------------- */

  function getEnabledLanguages() {
    return Array.isArray(config.languages)
      ? config.languages.filter(
          (language) => language.enabled !== false
        )
      : [];
  }

  function getLanguage(code) {
    return getEnabledLanguages().find(
      (language) => language.code === code
    );
  }

  function getLanguageName(code) {
    const language = getLanguage(code);

    return (
      language?.name ||
      language?.label ||
      code
    );
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
    const languages = getEnabledLanguages();

    elements.sourceLanguage.innerHTML = "";
    elements.targetLanguage.innerHTML = "";

    languages.forEach((language) => {
      const label =
        language.name ||
        language.label ||
        language.code;

      elements.sourceLanguage.add(
        new Option(label, language.code)
      );

      elements.targetLanguage.add(
        new Option(label, language.code)
      );
    });

    elements.sourceLanguage.value =
      config.defaultSourceLanguage || "en";

    elements.targetLanguage.value =
      config.defaultTargetLanguage || "ne";

    ensureDifferentLanguages();
  }

  function ensureDifferentLanguages() {
    if (
      elements.sourceLanguage.value !==
      elements.targetLanguage.value
    ) {
      return;
    }

    const alternativeLanguage =
      getEnabledLanguages().find(
        (language) =>
          language.code !==
          elements.sourceLanguage.value
      );

    if (alternativeLanguage) {
      elements.targetLanguage.value =
        alternativeLanguage.code;
    }
  }


  /* -------------------------------------------------- */
  /* STATUS                                             */
  /* -------------------------------------------------- */

  function setConnectionStatus(message) {
    elements.connectionStatus.textContent =
      message;
  }

  function showVoiceStatus(
    message,
    automaticallyHide = false
  ) {
    elements.voiceStatus.textContent =
      message;

    elements.voiceStatus.hidden = false;

    if (automaticallyHide) {
      window.setTimeout(() => {
        elements.voiceStatus.hidden = true;
        elements.voiceStatus.textContent = "";
      }, 4500);
    }
  }

  function hideVoiceStatus() {
    elements.voiceStatus.hidden = true;
    elements.voiceStatus.textContent = "";
  }


  /* -------------------------------------------------- */
  /* TIME                                               */
  /* -------------------------------------------------- */

  function currentTime() {
    return new Intl.DateTimeFormat(
      undefined,
      {
        hour: "numeric",
        minute: "2-digit"
      }
    ).format(new Date());
  }


  /* -------------------------------------------------- */
  /* COMPANION                                          */
  /* -------------------------------------------------- */

  function companionMarkup(state = "idle") {
    return `
      <div
        class="message-avatar companion"
        data-state="${state}"
        aria-label="MeChat Bridge companion"
      >
        <div class="face">
          <span class="eye eye-left"></span>
          <span class="eye eye-right"></span>
          <span class="mouth"></span>
        </div>
      </div>
    `;
  }


  /* -------------------------------------------------- */
  /* MESSAGE DISPLAY                                    */
  /* -------------------------------------------------- */

  function scrollToLatestMessage() {
    window.requestAnimationFrame(() => {
      elements.messages.scrollTop =
        elements.messages.scrollHeight;
    });
  }

  function addMessage({
    text,
    role,
    originalText = "",
    label = ""
  }) {
    const row =
      document.createElement("article");

    row.className =
      role === "user"
        ? "message message-row user user-row"
        : "message message-row assistant assistant-row";

    if (role === "assistant") {
      const companionHolder =
        document.createElement("div");

      companionHolder.innerHTML =
        companionMarkup("idle");

      row.appendChild(
        companionHolder.firstElementChild
      );
    }

    const messageColumn =
      document.createElement("div");

    messageColumn.className =
      "message-column";

    const bubble =
      document.createElement("div");

    bubble.className =
      role === "user"
        ? "bubble user-bubble"
        : "bubble assistant-bubble";

    if (label) {
      const messageLabel =
        document.createElement("strong");

      messageLabel.textContent = label;

      bubble.appendChild(messageLabel);
    }

    const messageText =
      document.createElement("p");

    messageText.textContent =
      String(text);

    bubble.appendChild(messageText);

    if (originalText) {
      const originalToggle =
        document.createElement("button");

      originalToggle.className =
        "original-toggle";

      originalToggle.type =
        "button";

      originalToggle.textContent =
        "Show original";

      const originalMessage =
        document.createElement("p");

      originalMessage.className =
        "original-text";

      originalMessage.textContent =
        originalText;

      originalMessage.hidden = true;

      originalToggle.addEventListener(
        "click",
        () => {
          originalMessage.hidden =
            !originalMessage.hidden;

          originalToggle.textContent =
            originalMessage.hidden
              ? "Show original"
              : "Hide original";
        }
      );

      bubble.appendChild(originalToggle);
      bubble.appendChild(originalMessage);
    }

    const time =
      document.createElement("time");

    time.className =
      "message-time";

    time.textContent =
      currentTime();

    bubble.appendChild(time);

    messageColumn.appendChild(bubble);
    row.appendChild(messageColumn);

    elements.messages.appendChild(row);

    scrollToLatestMessage();

    return row;
  }


  /* -------------------------------------------------- */
  /* THINKING INDICATOR                                 */
  /* -------------------------------------------------- */

  function addThinkingIndicator() {
    removeThinkingIndicator();

    const row =
      document.createElement("article");

    row.id = "thinkingRow";

    row.className =
      "message message-row assistant assistant-row";

    row.innerHTML = `
      ${companionMarkup("thinking")}

      <div class="message-column">
        <div class="bubble assistant-bubble">
          <div class="typing-dots">
            <span></span>
            <span></span>
            <span></span>
          </div>
        </div>
      </div>
    `;

    elements.messages.appendChild(row);

    scrollToLatestMessage();
  }

  function removeThinkingIndicator() {
    const existing =
      document.getElementById(
        "thinkingRow"
      );

    if (existing) {
      existing.remove();
    }
  }


  /* -------------------------------------------------- */
  /* INTERFACE STATE                                    */
  /* -------------------------------------------------- */

  function setInterfaceBusy(isBusy) {
    elements.sendButton.disabled = isBusy;
    elements.improveButton.disabled = isBusy;
    elements.messageInput.disabled = isBusy;
    elements.sourceLanguage.disabled = isBusy;
    elements.targetLanguage.disabled = isBusy;

    if (isBusy && isListening) {
      stopListening();
    }
  }

  function resizeMessageInput() {
    elements.messageInput.style.height =
      "auto";

    elements.messageInput.style.height =
      `${Math.min(
        elements.messageInput.scrollHeight,
        130
      )}px`;
  }


    /* -------------------------------------------------- */
  /* CONVERSATION CONTEXT                               */
  /* -------------------------------------------------- */

  function getRecentConversation() {
    return conversationMemory.slice(-8);
  }

  /* -------------------------------------------------- */
  /* SHARED CONVERSATION SYNCHRONISATION                */
  /* -------------------------------------------------- */

  function createDatabaseMessageKey(message) {
    if (
      message.id !== undefined &&
      message.id !== null
    ) {
      return `id-${message.id}`;
    }

    return [
      message.conversationId || "",
      message.fromUser || "",
      message.toUser || "",
      message.timestamp ||
        message.createdAt ||
        "",
      message.originalText || ""
    ].join("|");
  }

  function getIncomingMessageText(message) {
    /*
     * Graham receives English.
     */
    if (bridge.currentUser === "graham") {
      return (
        message.englishText ||
        message.translatedText ||
        message.originalText ||
        ""
      );
    }

    /*
     * Fulmaya receives Devanagari Nepali together
     * with Roman-Latin Nepali.
     */
    const nepaliText =
      message.nepaliText || "";

    const romanNepaliText =
      message.romanNepaliText ||
      message.romanizedText ||
      "";

    if (
      nepaliText &&
      romanNepaliText
    ) {
      return (
        `${nepaliText}\n\n` +
        romanNepaliText
      );
    }

    return (
      nepaliText ||
      romanNepaliText ||
      message.originalText ||
      ""
    );
  }

  function getParticipantDisplayName(userId) {
    if (userId === "graham") {
      return "Graham";
    }

    if (userId === "fulmaya") {
      return "Fulmaya";
    }

    return userId || "Participant";
  }

  async function synchroniseConversation() {
    if (conversationSyncRunning) {
      return;
    }

    conversationSyncRunning = true;

    try {
      const messages =
        await bridge.getConversationMessages();

      messages.forEach((message) => {
        const messageKey =
          createDatabaseMessageKey(message);

        if (
          displayedDatabaseMessages.has(
            messageKey
          )
        ) {
          return;
        }

        displayedDatabaseMessages.add(
          messageKey
        );

        /*
         * Only show messages sent to the current device user.
         */
        if (
          message.toUser !==
          bridge.currentUser
        ) {
          return;
        }

        const incomingText =
          getIncomingMessageText(message);

        if (!incomingText) {
          return;
        }

        addMessage({
          text: incomingText,
          role: "assistant",
          originalText:
            message.originalText || "",
          label:
            `${getParticipantDisplayName(
              message.fromUser
            )} · ${
              bridge.currentUser === "graham"
                ? "English"
                : "Nepali"
            }`
        });

        conversationMemory.push({
          role: "assistant",
          text: incomingText,
          originalText:
            message.originalText || "",
          language:
            bridge.currentUser === "graham"
              ? "en"
              : "ne",
          fromUser:
            message.fromUser,
          timestamp:
            message.timestamp ||
            message.createdAt ||
            new Date().toISOString()
        });
      });

      setConnectionStatus("Online");
    } catch (error) {
      console.error(
        "Conversation synchronisation error:",
        error
      );

      setConnectionStatus(
        "Conversation sync unavailable"
      );
    } finally {
      conversationSyncRunning = false;
    }
  }

  function startConversationSynchronisation() {
    if (!config.messagesWebhookUrl) {
      console.warn(
        "Messages webhook URL is not configured."
      );

      return;
    }

    synchroniseConversation();

    conversationSyncTimer =
      window.setInterval(
        synchroniseConversation,
        5000
      );
  }

  function configureParticipantLanguages() {
  if (
    bridge.currentUser === "fulmaya"
  ) {
    elements.sourceLanguage.value =
      "ne";

    elements.targetLanguage.value =
      "en";
  } else {
    elements.sourceLanguage.value =
      "en";

    elements.targetLanguage.value =
      "ne";
  }

  ensureDifferentLanguages();
}
   

  /* -------------------------------------------------- */
  /* SEND MESSAGE                                       */
  /* -------------------------------------------------- */

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

    addMessage({
      text: originalText,
      role: "user",
      label:
        `You · ${getLanguageName(sourceLanguage)}`
    });

    conversationMemory.push({
      role: "user",
      text: originalText,
      language: sourceLanguage,
      timestamp: new Date().toISOString()
    });

    elements.messageInput.value = "";
    resizeMessageInput();

    setInterfaceBusy(true);
    addThinkingIndicator();

    setConnectionStatus(
      "Bridging your message…"
    );

    try {
      const result =
        await bridge.processMessage({
          text: originalText,
          sourceLanguage,
          targetLanguage,
          mode: "translate",
          recentMessages:
            getRecentConversation()
        });

      removeThinkingIndicator();

      if (
        result.needsClarification &&
        result.clarificationQuestion
      ) {
        addMessage({
          text:
            result.clarificationQuestion,
          role: "assistant",
          label:
            "Clarification needed"
        });

        conversationMemory.push({
          role: "assistant",
          text:
            result.clarificationQuestion,
          language: sourceLanguage,
          type: "clarification",
          timestamp:
            new Date().toISOString()
        });

        setConnectionStatus(
          "Clarification needed"
        );

        return;
      }

       /* -------------------------------------------------- */
      /* BUILD RECIPIENT MESSAGE                            */
      /* -------------------------------------------------- */

      const nepaliText =
        result.nepaliText ||
        (
          targetLanguage === "ne"
            ? result.translatedText
            : ""
        ) ||
        "";

      const romanNepaliText =
        result.romanNepaliText ||
        result.romanizedText ||
        "";

      const englishText =
        result.englishText ||
        (
          targetLanguage === "en"
            ? result.translatedText
            : ""
        ) ||
        "";

      let displayText = "";

      // English → Nepali
      // Display Devanagari and Roman-Latin Nepali together.
      if (targetLanguage === "ne") {
        displayText = [
          nepaliText,
          romanNepaliText
        ]
          .filter(Boolean)
          .join("\n\n");
      } else {
        // Nepali or Roman-Latin Nepali → English
        displayText =
          englishText ||
          result.translatedText ||
          "No translation was returned.";
      }

      // Prevent an empty assistant bubble.
      if (!displayText.trim()) {
        displayText =
          "No translation was returned.";
      }

      addMessage({
        text: displayText,
        role: "assistant",
        originalText:
          result.originalText ||
          originalText,
        label:
          `MeChat Bridge · ${getLanguageName(
            targetLanguage
          )}`
      });

      conversationMemory.push({
        role: "assistant",
        text: displayText,
        originalText:
          result.originalText ||
          originalText,
        language: targetLanguage,
        confidence:
          result.confidence,
        timestamp:
          new Date().toISOString()
      });
      
      setConnectionStatus("Online");
    } catch (error) {
      console.error(
        "MeChat Bridge error:",
        error
      );

      removeThinkingIndicator();

      const errorMessage =
        error.name === "AbortError"
          ? "The request timed out. Please try again."
          : `I could not bridge that message: ${error.message}`;

      addMessage({
        text: errorMessage,
        role: "assistant",
        label: "Connection issue"
      });

      setConnectionStatus(
        "Connection needs attention"
      );
    } finally {
      setInterfaceBusy(false);
      elements.messageInput.focus();
    }
  }


  /* -------------------------------------------------- */
  /* IMPROVE WORDING                                    */
  /* -------------------------------------------------- */

  async function improveWording() {
    const originalText =
      elements.messageInput.value.trim();

    if (!originalText) {
      showVoiceStatus(
        "Speak or type a message before improving the wording.",
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

    setConnectionStatus(
      "Improving wording…"
    );

    try {
      const sourceLanguage =
        elements.sourceLanguage.value;

      const result =
        await bridge.processMessage({
          text: originalText,
          sourceLanguage,
          targetLanguage:
            sourceLanguage,
          mode: "improve",
          recentMessages:
            getRecentConversation()
        });

      elements.messageInput.value =
        result.improvedText ||
        result.translatedText ||
        originalText;

      resizeMessageInput();

      showVoiceStatus(
        "Wording improved. Review the message before sending.",
        true
      );

      setConnectionStatus("Online");
    } catch (error) {
      console.error(
        "Improve wording error:",
        error
      );

      showVoiceStatus(
        `Wording improvement is unavailable: ${error.message}`,
        true
      );

      setConnectionStatus(
        "Connection needs attention"
      );
    } finally {
      elements.improveButton.textContent =
        originalButtonText;

      elements.improveButton.disabled = false;

      elements.messageInput.focus();
    }
  }


  /* -------------------------------------------------- */
  /* VOICE INPUT                                        */
  /* -------------------------------------------------- */

  function setupSpeechRecognition() {
    const SpeechRecognition =
      window.SpeechRecognition ||
      window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      elements.micButton.disabled = true;

      elements.micButton.title =
        "Voice input is not supported in this browser.";

      showVoiceStatus(
        "Voice input is not supported in this browser. You can still type your message.",
        true
      );

      return;
    }

    recognition =
      new SpeechRecognition();

    recognition.continuous =
      config.voiceInput
        ?.continuousRecognition ??
      true;

    recognition.interimResults =
      config.voiceInput
        ?.interimResults ??
      true;

    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      isListening = true;

      elements.micButton.classList.add(
        "listening"
      );

      elements.micButton.title =
        "Stop voice input";

      elements.micButton.setAttribute(
        "aria-label",
        "Stop voice input"
      );

      setConnectionStatus("Listening…");

      showVoiceStatus(
        "Listening… Speak naturally. Your transcript remains editable."
      );
    };

    recognition.onresult = (event) => {
      let finalTranscript = "";
      let interimTranscript = "";

      for (
        let index = event.resultIndex;
        index < event.results.length;
        index += 1
      ) {
        const transcript =
          event.results[index][0]
            .transcript;

        if (
          event.results[index].isFinal
        ) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      if (finalTranscript) {
        const currentText =
          elements.messageInput.value.trim();

        const spacing =
          currentText ? " " : "";

        elements.messageInput.value =
          `${currentText}${spacing}${finalTranscript}`
            .trimStart();

        resizeMessageInput();
      }

      elements.voiceStatus.textContent =
        interimTranscript
          ? `Listening… ${interimTranscript}`
          : "Listening… Your transcript is ready to review.";
    };

    recognition.onerror = (event) => {
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

      setConnectionStatus(
        "Voice input unavailable"
      );
    };

    recognition.onend = () => {
      isListening = false;

      elements.micButton.classList.remove(
        "listening"
      );

      elements.micButton.title =
        "Use voice input";

      elements.micButton.setAttribute(
        "aria-label",
        "Use voice input"
      );

      if (
        elements.messageInput.value.trim()
      ) {
        showVoiceStatus(
          "Voice input complete. Review and edit the transcript before sending."
        );
      } else {
        hideVoiceStatus();
      }

      setConnectionStatus("Online");
    };
  }

  function startListening() {
    if (!recognition) {
      return;
    }

    recognition.lang =
      getSpeechLocale(
        elements.sourceLanguage.value
      );

    try {
      recognition.start();
    } catch (error) {
      console.warn(
        "Voice recognition is already active.",
        error
      );
    }
  }

  function stopListening() {
    if (
      !recognition ||
      !isListening
    ) {
      return;
    }

    recognition.stop();
  }

  function toggleMicrophone() {
    if (!recognition) {
      return;
    }

    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }


  /* -------------------------------------------------- */
  /* CLEAR CONVERSATION                                 */
  /* -------------------------------------------------- */

  function clearConversation() {
    const confirmed =
      window.confirm(
        "Clear this local conversation view?"
      );

    if (!confirmed) {
      return;
    }

    const messageRows =
      elements.messages.querySelectorAll(
        ".message-row"
      );

    messageRows.forEach(
      (message, index) => {
        if (index > 0) {
          message.remove();
        }
      }
    );

    conversationMemory.length = 0;

    elements.messageInput.value = "";

    resizeMessageInput();
    hideVoiceStatus();

    setConnectionStatus("Online");

    elements.messageInput.focus();
  }


  /* -------------------------------------------------- */
  /* LANGUAGE CHANGES                                   */
  /* -------------------------------------------------- */

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


  /* -------------------------------------------------- */
  /* SAKURA                                             */
  /* -------------------------------------------------- */

  function releasePetals() {
    if (!elements.petalLayer) {
      return;
    }

    const petalCount =
      2 +
      Math.floor(
        Math.random() * 3
      );

    for (
      let index = 0;
      index < petalCount;
      index += 1
    ) {
      const petal =
  document.createElement("span");

petal.className = "petal";
petal.textContent = "🌸";

      petal.style.left =
        `${8 + Math.random() * 74}%`;

      petal.style.setProperty(
        "--drift",
        `${-55 + Math.random() * 130}px`
      );

      petal.style.setProperty(
        "--duration",
        `${7 + Math.random() * 5}s`
      );

      petal.style.animationDelay =
        `${index * 0.55}s`;

      elements.petalLayer.appendChild(
        petal
      );

      window.setTimeout(() => {
        petal.remove();
      }, 14000);
    }
  }


  /* -------------------------------------------------- */
  /* EVENT LISTENERS                                    */
  /* -------------------------------------------------- */

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
      "input",
      resizeMessageInput
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


  /* -------------------------------------------------- */
  /* INITIALISE                                         */
  /* -------------------------------------------------- */

  function initialiseApplication() {
    if (!validateRequiredElements()) {
      return;
    }

    populateLanguages();
    configureParticipantLanguages();
    setupSpeechRecognition();
    registerEventListeners();
    resizeMessageInput();
    startConversationSynchronisation();

    const webhookConfigured =
      Boolean(config.webhookUrl) &&
      !String(config.webhookUrl).includes(
        "PASTE_YOUR"
      );

    setConnectionStatus(
      webhookConfigured
        ? "Online"
        : config.demoMode
          ? "Prototype mode"
          : "Webhook not configured"
    );

    window.setTimeout(
      releasePetals,
      1200
    );

    window.setInterval(
      releasePetals,
      18000
    );

    elements.messageInput.focus();
  }

  initialiseApplication();
})();
