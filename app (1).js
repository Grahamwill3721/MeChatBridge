const config = window.MECHAT_CONFIG || {};

const messages =
  document.getElementById("messages");

const chatForm =
  document.getElementById("chatForm");

const messageInput =
  document.getElementById("messageInput");

const micButton =
  document.getElementById("micButton");

const soundToggle =
  document.getElementById("soundToggle");

const connectionStatus =
  document.getElementById("connectionStatus");

let spokenReplies =
  config.spokenReplies !== false;

let activeAudio = null;


/* -------------------------------------------------- */
/* SESSION                                             */
/* -------------------------------------------------- */

function getSessionId() {
  let sessionId =
    localStorage.getItem("mechatSessionId");

  if (!sessionId) {
    if (
      typeof crypto !== "undefined" &&
      typeof crypto.randomUUID === "function"
    ) {
      sessionId = crypto.randomUUID();
    } else {
      sessionId =
        `mechat-${Date.now()}-${Math.random()
          .toString(16)
          .slice(2)}`;
    }

    localStorage.setItem(
      "mechatSessionId",
      sessionId
    );
  }

  return sessionId;
}


/* -------------------------------------------------- */
/* TIME                                                */
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
/* COMPANION                                           */
/* -------------------------------------------------- */

function companionMarkup(state = "idle") {
  return `
    <div
      class="companion"
      data-state="${state}"
      aria-label="MeChat companion"
    >
      <div class="face">
        <span class="eye eye-left"></span>
        <span class="eye eye-right"></span>
        <span class="mouth"></span>
      </div>
    </div>
  `;
}

function getLatestAssistantCompanion() {
  const companions =
    messages.querySelectorAll(
      ".assistant-row .companion"
    );

  if (!companions.length) {
    return null;
  }

  return companions[
    companions.length - 1
  ];
}

function setLatestCompanionState(state) {
  const companion =
    getLatestAssistantCompanion();

  if (companion) {
    companion.dataset.state = state;
  }
}

function setAllCompanionsIdle() {
  messages
    .querySelectorAll(".companion")
    .forEach(companion => {
      companion.dataset.state = "idle";
    });
}


/* -------------------------------------------------- */
/* SCROLL                                              */
/* -------------------------------------------------- */

function scrollToLatestMessage() {
  window.requestAnimationFrame(() => {
    messages.scrollTop =
      messages.scrollHeight;
  });
}


/* -------------------------------------------------- */
/* DISPLAY MESSAGE                                     */
/* -------------------------------------------------- */

function addMessage(text, role) {
  const row =
    document.createElement("article");

  row.className =
    role === "user"
      ? "message-row user-row"
      : "message-row assistant-row";

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

  bubble.textContent =
    String(text);

  const time =
    document.createElement("span");

  time.className =
    "message-time";

  time.textContent =
    currentTime();

  messageColumn.appendChild(bubble);
  messageColumn.appendChild(time);

  row.appendChild(messageColumn);
  messages.appendChild(row);

  scrollToLatestMessage();

  return row;
}


/* -------------------------------------------------- */
/* THINKING INDICATOR                                  */
/* -------------------------------------------------- */

function addThinkingIndicator() {
  removeThinkingIndicator();

  const row =
    document.createElement("article");

  row.id =
    "thinkingRow";

  row.className =
    "message-row assistant-row";

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

  messages.appendChild(row);

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
/* STOP AUDIO                                          */
/* -------------------------------------------------- */

function stopActiveAudio() {
  if (activeAudio) {
    activeAudio.pause();
    activeAudio.currentTime = 0;
    activeAudio.src = "";
    activeAudio = null;
  }

  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }

  setAllCompanionsIdle();
}


/* -------------------------------------------------- */
/* ELEVENLABS AUDIO                                    */
/* -------------------------------------------------- */

function playElevenLabsAudio(
  audioBase64,
  mimeType = "audio/mpeg"
) {
  if (
    !spokenReplies ||
    !audioBase64
  ) {
    setLatestCompanionState("idle");
    return;
  }

  stopActiveAudio();

  try {
    const cleanedBase64 =
      String(audioBase64)
        .replace(
          /^data:audio\/[^;]+;base64,/,
          ""
        )
        .replace(/\s/g, "");

    const audioSource =
      `data:${mimeType};base64,${cleanedBase64}`;

    const audio =
      new Audio(audioSource);

    activeAudio = audio;

    audio.preload = "auto";

    audio.onplay = () => {
      setLatestCompanionState(
        "speaking"
      );
    };

    audio.onended = () => {
      setLatestCompanionState(
        "idle"
      );

      activeAudio = null;
    };

    audio.onpause = () => {
      if (
        activeAudio === audio &&
        !audio.ended
      ) {
        setLatestCompanionState(
          "idle"
        );
      }
    };

    audio.onerror = event => {
      console.error(
        "ElevenLabs audio playback failed:",
        event
      );

      setLatestCompanionState(
        "idle"
      );

      activeAudio = null;

      connectionStatus.textContent =
        "Audio could not play";
    };

    const playPromise =
      audio.play();

    if (
      playPromise &&
      typeof playPromise.catch ===
        "function"
    ) {
      playPromise.catch(error => {
        console.error(
          "The browser blocked or could not play the ElevenLabs audio:",
          error
        );

        setLatestCompanionState(
          "idle"
        );

        activeAudio = null;

        connectionStatus.textContent =
          "Tap the sound button to enable audio";
      });
    }
  } catch (error) {
    console.error(
      "Could not prepare ElevenLabs audio:",
      error
    );

    setLatestCompanionState("idle");

    activeAudio = null;

    connectionStatus.textContent =
      "Audio needs attention";
  }
}


/* -------------------------------------------------- */
/* SEND TO N8N                                        */
/* -------------------------------------------------- */

async function sendMessage(message) {
  stopActiveAudio();

  addMessage(message, "user");
  addThinkingIndicator();

  connectionStatus.textContent =
    "MeChat is thinking…";

  try {
    const webhookUrl =
      config.webhookUrl || "";

    if (
      !webhookUrl ||
      webhookUrl.includes(
        "PASTE_YOUR"
      )
    ) {
      throw new Error(
        "WEBHOOK_NOT_CONFIGURED"
      );
    }

    const response =
      await fetch(webhookUrl, {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json"
        },

        body: JSON.stringify({
          message,
          sessionId:
            getSessionId(),
          source:
            "mechat-web"
        })
      });

    if (!response.ok) {
      throw new Error(
        `WEBHOOK_${response.status}`
      );
    }

    const data =
      await response.json();

    console.log(
      "MeChat n8n response:",
      data
    );

    const reply =
      data.reply ||
      data.output ||
      data.text ||
      data.message ||
      "I received your message.";

    removeThinkingIndicator();

    addMessage(
      reply,
      "assistant"
    );

    connectionStatus.textContent =
      "Online";

    if (
      spokenReplies &&
      data.audioBase64
    ) {
      playElevenLabsAudio(
        data.audioBase64,
        data.audioMimeType ||
          "audio/mpeg"
      );
    } else {
      /*
       * Browser speech is intentionally
       * not used here. This prevents the
       * computer's default male voice from
       * replacing the ElevenLabs voice.
       */

      setLatestCompanionState(
        "idle"
      );

      if (!data.audioBase64) {
        console.warn(
          "The n8n response contained text, but no ElevenLabs audioBase64 value."
        );
      }
    }
  } catch (error) {
    console.error(
      "MeChat error:",
      error
    );

    removeThinkingIndicator();

    let fallbackMessage;

    if (
      error.message ===
      "WEBHOOK_NOT_CONFIGURED"
    ) {
      fallbackMessage =
        "The MeChat interface is working, but the n8n production webhook URL has not been added to config.js.";
    } else {
      fallbackMessage =
        "I could not reach the MeChat workflow. Please check that the n8n workflow is published and that its production webhook URL is correct.";
    }

    addMessage(
      fallbackMessage,
      "assistant"
    );

    setLatestCompanionState(
      "idle"
    );

    connectionStatus.textContent =
      "Connection needs attention";
  }
}


/* -------------------------------------------------- */
/* CHAT FORM                                           */
/* -------------------------------------------------- */

chatForm.addEventListener(
  "submit",
  event => {
    event.preventDefault();

    const message =
      messageInput.value.trim();

    if (!message) {
      return;
    }

    messageInput.value = "";

    messageInput.style.height =
      "auto";

    sendMessage(message);
  }
);

messageInput.addEventListener(
  "input",
  () => {
    messageInput.style.height =
      "auto";

    messageInput.style.height =
      `${Math.min(
        messageInput.scrollHeight,
        130
      )}px`;
  }
);

messageInput.addEventListener(
  "keydown",
  event => {
    if (
      event.key === "Enter" &&
      !event.shiftKey
    ) {
      event.preventDefault();

      chatForm.requestSubmit();
    }
  }
);


/* -------------------------------------------------- */
/* SOUND TOGGLE                                        */
/* -------------------------------------------------- */

soundToggle.addEventListener(
  "click",
  () => {
    spokenReplies =
      !spokenReplies;

    soundToggle.textContent =
      spokenReplies
        ? "🔊"
        : "🔇";

    soundToggle.title =
      spokenReplies
        ? "ElevenLabs voice on"
        : "ElevenLabs voice off";

    soundToggle.setAttribute(
      "aria-pressed",
      String(spokenReplies)
    );

    if (!spokenReplies) {
      stopActiveAudio();

      connectionStatus.textContent =
        "Voice off";
    } else {
      connectionStatus.textContent =
        "Online";
    }
  }
);


/* -------------------------------------------------- */
/* VOICE INPUT                                         */
/* -------------------------------------------------- */

const SpeechRecognition =
  window.SpeechRecognition ||
  window.webkitSpeechRecognition;

if (SpeechRecognition) {
  const recognition =
    new SpeechRecognition();

  recognition.lang =
    "en-US";

  recognition.interimResults =
    false;

  recognition.continuous =
    false;

  recognition.onstart = () => {
    stopActiveAudio();

    micButton.classList.add(
      "listening"
    );

    connectionStatus.textContent =
      "Listening…";
  };

  recognition.onend = () => {
    micButton.classList.remove(
      "listening"
    );

    if (
      connectionStatus.textContent ===
      "Listening…"
    ) {
      connectionStatus.textContent =
        "Online";
    }
  };

  recognition.onerror = event => {
    console.warn(
      "Voice recognition error:",
      event.error
    );

    micButton.classList.remove(
      "listening"
    );

    connectionStatus.textContent =
      "Voice input unavailable";
  };

  recognition.onresult = event => {
    const transcript =
      event.results[0][0]
        .transcript;

    messageInput.value =
      transcript;

    chatForm.requestSubmit();
  };

  micButton.addEventListener(
    "click",
    () => {
      try {
        recognition.start();
      } catch (error) {
        console.warn(
          "Voice recognition is already active."
        );
      }
    }
  );
} else {
  micButton.disabled = true;

  micButton.title =
    "Voice input is not supported in this browser";
}


/* -------------------------------------------------- */
/* SAKURA PETALS                                       */
/* -------------------------------------------------- */

function releasePetals() {
  const layer =
    document.getElementById(
      "petalLayer"
    );

  if (!layer) {
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
      document.createElement(
        "span"
      );

    petal.className =
      "petal";

    petal.style.left =
      `${8 + Math.random() * 74}%`;

    petal.style.setProperty(
      "--drift",
      `${-55 + Math.random() * 130}px`
    );

    petal.style.setProperty(
      "--duration",
      `${5.5 + Math.random() * 4}s`
    );

    petal.style.animationDelay =
      `${index * 0.45}s`;

    layer.appendChild(petal);

    window.setTimeout(
      () => {
        petal.remove();
      },
      11000
    );
  }
}


/* -------------------------------------------------- */
/* CLEANUP                                             */
/* -------------------------------------------------- */

window.addEventListener(
  "beforeunload",
  () => {
    stopActiveAudio();
  }
);


/* -------------------------------------------------- */
/* INITIALISE                                          */
/* -------------------------------------------------- */

getSessionId();

soundToggle.textContent =
  spokenReplies
    ? "🔊"
    : "🔇";

soundToggle.setAttribute(
  "aria-pressed",
  String(spokenReplies)
);

connectionStatus.textContent =
  config.webhookUrl &&
  !config.webhookUrl.includes(
    "PASTE_YOUR"
  )
    ? "Online"
    : "Prototype mode";

window.setTimeout(
  releasePetals,
  1200
);

window.setInterval(
  releasePetals,
  18000
);
