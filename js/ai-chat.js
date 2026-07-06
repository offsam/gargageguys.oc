/* Garage Guys — AI Council website employee (proxy: /api/ai-chat) */
(function garageGuysAiChat() {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  var API_URL = "/api/ai-chat";
  var QUICK_PROMPTS = [
    "My door won't open",
    "Broken spring",
    "Opener not working",
    "Door off track",
  ];

  var CHAT_ICON_SVG =
    '<svg viewBox="0 0 32 32" width="32" height="32" fill="none" aria-hidden="true">' +
    '<path d="M6 9.5C6 7.57 7.57 6 9.5 6h13C23.43 6 25 7.57 25 9.5V17c0 1.93-1.57 3.5-3.5 3.5h-4.1L15 24v-3.5H9.5C7.57 20.5 6 18.93 6 17V9.5z" fill="#fff"/>' +
    '<circle cx="11.5" cy="13.5" r="1.6" fill="#2e6da4"/>' +
    '<circle cx="16" cy="13.5" r="1.6" fill="#2e6da4"/>' +
    '<circle cx="20.5" cy="13.5" r="1.6" fill="#2e6da4"/>' +
    "</svg>";

  var WRENCH_BADGE_SVG =
    '<svg viewBox="0 0 20 20" width="14" height="14" fill="none" aria-hidden="true">' +
    '<path d="M14.5 5.5a3.5 3.5 0 0 0-4.9 4.9L5 15l2 2 4.6-4.6a3.5 3.5 0 0 0 2.9-8.9z" fill="#fff" stroke="#0f2340" stroke-width="1.2" stroke-linejoin="round"/>' +
    "</svg>";

  var DOOR_ICON_SVG =
    '<svg class="gg-ai-chat-header__door" viewBox="0 0 52 44" width="44" height="36" fill="none" aria-hidden="true">' +
    '<rect x="4" y="6" width="44" height="32" rx="3" stroke="currentColor" stroke-width="1.8" opacity="0.9"/>' +
    '<path d="M4 14h44M4 22h44M4 30h44" stroke="currentColor" stroke-width="1" opacity="0.35"/>' +
    '<rect x="23" y="28" width="6" height="10" rx="1" fill="currentColor" opacity="0.85"/>' +
    '<circle cx="27" cy="33" r="1" fill="#0f2340"/>' +
    "</svg>";

  var sessionId =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : "session-" + Date.now();

  var messages = [
    {
      role: "assistant",
      content:
        "Hey there — I'm Alex with Garage Guys. What's going on with your door today? Stuck shut, broken spring, opener acting up… tell me what you're seeing and we'll figure out the next step.",
    },
  ];
  var submittedInboxItemId = null;
  var loading = false;
  var panelOpen = false;

  var root = document.createElement("div");
  root.className = "gg-ai-chat-root";
  root.id = "gg-ai-chat-root";

  var teaserStack = document.createElement("div");
  teaserStack.className = "gg-ai-chat-teaser-stack";

  var teaser = document.createElement("button");
  teaser.type = "button";
  teaser.className = "gg-ai-chat-teaser";
  teaser.innerHTML =
    '<span class="gg-ai-chat-teaser__icon" aria-hidden="true">' + CHAT_ICON_SVG.replace('width="32" height="32"', 'width="22" height="22"') + "</span>" +
    '<span class="gg-ai-chat-teaser__body">' +
    '<span class="gg-ai-chat-teaser__label">Free consultation</span>' +
    '<span class="gg-ai-chat-teaser__text">Ask our AI expert — springs, openers, stuck doors.</span>' +
    "</span>";

  var teaserArrow = document.createElement("div");
  teaserArrow.className = "gg-ai-chat-teaser-arrow";
  teaserArrow.setAttribute("aria-hidden", "true");
  teaserArrow.innerHTML =
    '<svg viewBox="0 0 32 48" width="24" height="40" fill="none">' +
    '<path d="M16 4v30" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>' +
    '<path d="M7 30l9 10 9-10" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>' +
    "</svg>";

  teaserStack.appendChild(teaser);
  teaserStack.appendChild(teaserArrow);

  var panel = document.createElement("div");
  panel.className = "gg-ai-chat-panel";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", "Garage door repair assistant");
  panel.setAttribute("aria-hidden", "true");
  panel.innerHTML = '<div class="gg-ai-chat-panel__glow" aria-hidden="true"></div>';

  var header = document.createElement("header");
  header.className = "gg-ai-chat-header";
  header.innerHTML =
    '<div class="gg-ai-chat-header__brand">' +
    DOOR_ICON_SVG +
    '<div class="gg-ai-chat-header__copy">' +
    '<strong class="gg-ai-chat-header__title">Garage Door Expert</strong>' +
    '<span class="gg-ai-chat-header__sub">Springs · Openers · Same-day OC</span>' +
    "</div></div>" +
    '<button type="button" class="gg-ai-chat-close" aria-label="Close chat">&times;</button>';

  var chips = document.createElement("div");
  chips.className = "gg-ai-chat-chips";
  chips.setAttribute("role", "group");
  chips.setAttribute("aria-label", "Common issues");
  QUICK_PROMPTS.forEach(function (label) {
    var chip = document.createElement("button");
    chip.type = "button";
    chip.className = "gg-ai-chat-chip";
    chip.textContent = label;
    chip.addEventListener("click", function () {
      if (loading || submittedInboxItemId) return;
      postTurn(label);
    });
    chips.appendChild(chip);
  });

  var status = document.createElement("div");
  status.className = "gg-ai-chat-status";
  status.hidden = true;
  status.innerHTML =
    '<span class="gg-ai-chat-status__icon" aria-hidden="true">✓</span>' +
    "<span>Request received — we'll call you back soon.</span>";

  var log = document.createElement("div");
  log.className = "gg-ai-chat-log";

  var form = document.createElement("form");
  form.className = "gg-ai-chat-form";

  var input = document.createElement("textarea");
  input.rows = 2;
  input.placeholder = "Describe the problem with your garage door…";
  input.setAttribute("aria-label", "Message");

  var send = document.createElement("button");
  send.type = "submit";
  send.className = "gg-ai-chat-send";
  send.innerHTML =
    '<span class="gg-ai-chat-send__label">Send</span>' +
    '<svg viewBox="0 0 20 20" width="16" height="16" fill="none" aria-hidden="true">' +
    '<path d="M3 10l14-7-4 7 4 7L3 10z" fill="currentColor"/>' +
    "</svg>";

  var launcherWrap = document.createElement("div");
  launcherWrap.className = "gg-ai-chat-launcher-wrap";

  var launcherGlow1 = document.createElement("span");
  launcherGlow1.className = "gg-ai-chat-launcher__glow";
  launcherGlow1.setAttribute("aria-hidden", "true");

  var launcherGlow2 = document.createElement("span");
  launcherGlow2.className = "gg-ai-chat-launcher__glow gg-ai-chat-launcher__glow--outer";
  launcherGlow2.setAttribute("aria-hidden", "true");

  var launcher = document.createElement("button");
  launcher.type = "button";
  launcher.className = "gg-ai-chat-launcher";
  launcher.setAttribute("aria-label", "Open garage door repair assistant");
  launcher.setAttribute("aria-expanded", "false");
  launcher.innerHTML =
    '<span class="gg-ai-chat-launcher__icon" aria-hidden="true">' + CHAT_ICON_SVG + "</span>" +
    '<span class="gg-ai-chat-launcher__badge" aria-hidden="true">' + WRENCH_BADGE_SVG + "</span>";

  launcherWrap.appendChild(launcherGlow1);
  launcherWrap.appendChild(launcherGlow2);
  launcherWrap.appendChild(launcher);

  function appendBubble(role, content) {
    var row = document.createElement("div");
    row.className =
      role === "user"
        ? "gg-ai-chat-row gg-ai-chat-row--user"
        : "gg-ai-chat-row gg-ai-chat-row--bot";

    if (role === "assistant") {
      var avatar = document.createElement("div");
      avatar.className = "gg-ai-chat-row__avatar";
      avatar.innerHTML = CHAT_ICON_SVG.replace('width="32" height="32"', 'width="20" height="20"');
      row.appendChild(avatar);
    }

    var bubble = document.createElement("div");
    bubble.className =
      role === "user"
        ? "gg-ai-chat-bubble gg-ai-chat-bubble--user"
        : "gg-ai-chat-bubble gg-ai-chat-bubble--bot";
    bubble.textContent = content;
    row.appendChild(bubble);
    log.appendChild(row);
    log.scrollTop = log.scrollHeight;
  }

  function renderLog() {
    log.innerHTML = "";
    for (var i = 0; i < messages.length; i++) {
      appendBubble(messages[i].role, messages[i].content);
    }
  }

  function updateTeaser() {
    var show = !panelOpen && !submittedInboxItemId;
    root.classList.toggle("gg-ai-chat-root--teaser", show);
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
    chips.querySelectorAll(".gg-ai-chat-chip").forEach(function (chip) {
      chip.disabled = true;
    });
    root.classList.remove("gg-ai-chat-root--teaser");
  }

  function postTurn(userText) {
    if (loading) return;
    loading = true;
    send.disabled = true;
    input.disabled = true;
    chips.querySelectorAll(".gg-ai-chat-chip").forEach(function (chip) {
      chip.disabled = true;
    });

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
        if (!submittedInboxItemId) {
          chips.querySelectorAll(".gg-ai-chat-chip").forEach(function (chip) {
            chip.disabled = false;
          });
        }
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

  teaser.addEventListener("click", function (event) {
    event.preventDefault();
    setPanelOpen(true);
  });

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && panelOpen) setPanelOpen(false);
  });

  form.appendChild(input);
  form.appendChild(send);
  panel.appendChild(header);
  panel.appendChild(chips);
  panel.appendChild(status);
  panel.appendChild(log);
  panel.appendChild(form);
  root.appendChild(teaserStack);
  root.appendChild(panel);
  root.appendChild(launcherWrap);
  document.body.appendChild(root);
  updateTeaser();
})();
