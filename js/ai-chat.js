/* Garage Guys — AI Council website employee (proxy: /api/ai-chat) */
(function garageGuysAiChat() {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  var API_URL = "/api/ai-chat";
  var TEASER_KEY = "gg-ai-chat-teaser-seen";
  var sessionId =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : "session-" + Date.now();

  var messages = [
    {
      role: "assistant",
      content:
        "Hi! I'm the Garage Guys assistant. Tell me what's going on with your garage door — I'll help get your free estimate request started.",
    },
  ];
  var submittedInboxItemId = null;
  var loading = false;
  var panelOpen = false;

  var root = document.createElement("div");
  root.className = "gg-ai-chat-root";
  root.id = "gg-ai-chat-root";

  var teaser = document.createElement("div");
  teaser.className = "gg-ai-chat-teaser";
  teaser.innerHTML =
    '<span class="gg-ai-chat-teaser__dot" aria-hidden="true"></span>' +
    '<span class="gg-ai-chat-teaser__text">Get a free consultation — chat with our AI assistant</span>';

  var panel = document.createElement("div");
  panel.className = "gg-ai-chat-panel";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", "Garage Guys assistant chat");
  panel.setAttribute("aria-hidden", "true");

  var header = document.createElement("div");
  header.className = "gg-ai-chat-header";
  header.innerHTML =
    '<div><strong>Garage Guys Assistant</strong><span>Free estimate · Orange County</span></div>' +
    '<button type="button" class="gg-ai-chat-close" aria-label="Close chat">&times;</button>';

  var status = document.createElement("div");
  status.className = "gg-ai-chat-status";
  status.hidden = true;
  status.textContent = "Request submitted — we will call you back soon.";

  var log = document.createElement("div");
  log.className = "gg-ai-chat-log";

  var form = document.createElement("form");
  form.className = "gg-ai-chat-form";

  var input = document.createElement("textarea");
  input.rows = 2;
  input.placeholder = "My garage door won't open…";
  input.setAttribute("aria-label", "Message");

  var send = document.createElement("button");
  send.type = "submit";
  send.textContent = "Send";

  var launcher = document.createElement("button");
  launcher.type = "button";
  launcher.className = "gg-ai-chat-launcher";
  launcher.setAttribute("aria-label", "Chat with Garage Guys assistant");
  launcher.setAttribute("aria-expanded", "false");
  launcher.innerHTML =
    '<span class="gg-ai-chat-launcher__icon" aria-hidden="true">' +
    '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>' +
    '</span><span class="gg-ai-chat-launcher__text">Free estimate</span>';

  function appendBubble(role, content) {
    var bubble = document.createElement("div");
    bubble.className =
      role === "user"
        ? "gg-ai-chat-bubble gg-ai-chat-bubble--user"
        : "gg-ai-chat-bubble gg-ai-chat-bubble--bot";
    bubble.textContent = content;
    log.appendChild(bubble);
    log.scrollTop = log.scrollHeight;
  }

  function renderLog() {
    log.innerHTML = "";
    for (var i = 0; i < messages.length; i++) {
      appendBubble(messages[i].role, messages[i].content);
    }
  }

  function updateTeaser() {
    var seen = false;
    try {
      seen = window.localStorage.getItem(TEASER_KEY) === "1";
    } catch (e) {
      seen = false;
    }
    root.classList.toggle("gg-ai-chat-root--teaser", !panelOpen && !seen && !submittedInboxItemId);
    if (panelOpen && !seen) {
      try {
        window.localStorage.setItem(TEASER_KEY, "1");
      } catch (e) {
        /* ignore */
      }
      root.classList.remove("gg-ai-chat-root--teaser");
    }
  }

  function setPanelOpen(open) {
    panelOpen = open;
    panel.classList.toggle("gg-ai-chat-panel--open", open);
    panel.setAttribute("aria-hidden", open ? "false" : "true");
    launcher.setAttribute("aria-expanded", open ? "true" : "false");
    root.classList.toggle("gg-ai-chat-root--open", open);
    updateTeaser();
    if (open) {
      renderLog();
      window.requestAnimationFrame(function () {
        input.focus();
      });
    }
  }

  function markSubmitted(inboxItemId) {
    submittedInboxItemId = inboxItemId;
    launcher.classList.add("gg-ai-chat-launcher--submitted");
    status.hidden = false;
    root.classList.remove("gg-ai-chat-root--teaser");
  }

  function postTurn(userText) {
    if (loading) return;
    loading = true;
    send.disabled = true;
    input.disabled = true;

    messages.push({ role: "user", content: userText });
    appendBubble("user", userText);

    fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: sessionId,
        messages: messages,
        submittedInboxItemId: submittedInboxItemId,
      }),
    })
      .then(function (response) {
        return response.json().then(function (payload) {
          if (!response.ok) {
            throw new Error(payload.error || "Chat request failed");
          }
          return payload;
        });
      })
      .then(function (payload) {
        if (payload.reply) {
          messages.push({ role: "assistant", content: payload.reply });
          appendBubble("assistant", payload.reply);
        }
        if (payload.leadSubmitted && payload.inboxItemId) {
          markSubmitted(payload.inboxItemId);
        }
      })
      .catch(function () {
        appendBubble(
          "assistant",
          "Sorry, something went wrong. Please call (949) 539-0009 or use Request Callback.",
        );
      })
      .finally(function () {
        loading = false;
        send.disabled = false;
        input.disabled = false;
        if (panelOpen) input.focus();
      });
  }

  header.querySelector(".gg-ai-chat-close").addEventListener("click", function (event) {
    event.preventDefault();
    event.stopPropagation();
    setPanelOpen(false);
  });

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    var text = input.value.trim();
    if (!text) return;
    input.value = "";
    postTurn(text);
  });

  launcher.addEventListener("click", function (event) {
    event.preventDefault();
    event.stopPropagation();
    setPanelOpen(!panelOpen);
  });

  teaser.addEventListener("click", function () {
    setPanelOpen(true);
  });

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && panelOpen) setPanelOpen(false);
  });

  form.appendChild(input);
  form.appendChild(send);
  panel.appendChild(header);
  panel.appendChild(status);
  panel.appendChild(log);
  panel.appendChild(form);
  root.appendChild(teaser);
  root.appendChild(panel);
  root.appendChild(launcher);
  document.body.appendChild(root);
  updateTeaser();
})();
