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

  var LAUNCHER_ICON_SVG =
    '<svg viewBox="0 0 48 48" width="44" height="44" fill="none" aria-hidden="true">' +
    '<path d="M7 12.5C7 9.46 9.46 7 12.5 7h23C38.54 7 41 9.46 41 12.5v16c0 3.04-2.46 5.5-5.5 5.5h-12l-7.5 9v-9H12.5C9.46 34 7 31.54 7 28.5v-16z" fill="#fff"/>' +
    '<rect x="15" y="14.5" width="18" height="13" rx="1.5" fill="#1a3a5c" opacity="0.12"/>' +
    '<path d="M15 18.5h18M15 22.5h18M15 26.5h12" stroke="#1a3a5c" stroke-width="2" stroke-linecap="round"/>' +
    '<circle cx="24" cy="25.5" r="1.4" fill="#f59e0b"/>' +
    "</svg>";

  var AVATAR_ICON_SVG = LAUNCHER_ICON_SVG.replace('width="44" height="44"', 'width="22" height="22"');

  var THINKING_MIN_MS = 2400;
  var THINKING_STEP_MS = 1600;

  var THINKING_SEQUENCES = {
    spring: [
      "Okay — a spring issue, got it…",
      "Could be a broken torsion or extension spring…",
      "Definitely don't try to lift it by hand…",
      "Let me figure out the best way to help…",
    ],
    opener: [
      "Opener trouble — I hear you.",
      "Might be the motor, remote, or safety sensors…",
      "Or sometimes it's just a disconnected trolley…",
      "Thinking through what to ask next…",
    ],
    track: [
      "Door off track — that's no fun.",
      "Could've bent a roller or knocked a panel loose…",
      "We'd want to see how bad the alignment is…",
      "Working out the right next step…",
    ],
    stuck: [
      "Door won't budge — I understand.",
      "Could be the spring, opener, or a locked position…",
      "Might also be a cable or sensor thing…",
      "Let me think what fits your situation…",
    ],
    default: [
      "Got it — reading what you wrote…",
      "Hmm, let me think this through…",
      "Could be a few different things here…",
      "Okay — working out the best next question…",
    ],
  };

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
  var thinkingRow = null;
  var thinkingTimer = null;
  var thinkingStartedAt = 0;
  var headerStatusEl = null;
  var headerDefaultStatus = "Online · Orange County";

  var root = document.createElement("div");
  root.className = "gg-ai-chat-root";
  root.id = "gg-ai-chat-root";

  var anchor = document.createElement("div");
  anchor.className = "gg-ai-chat-anchor";

  var teaserStack = document.createElement("div");
  teaserStack.className = "gg-ai-chat-teaser-stack";

  var teaser = document.createElement("button");
  teaser.type = "button";
  teaser.className = "gg-ai-chat-teaser";
  teaser.innerHTML =
    '<span class="gg-ai-chat-teaser__label">Free consultation</span>' +
    '<span class="gg-ai-chat-teaser__text">with our AI specialist</span>';

  var teaserArrow = document.createElement("div");
  teaserArrow.className = "gg-ai-chat-teaser-arrow";
  teaserArrow.setAttribute("aria-hidden", "true");
  teaserArrow.innerHTML =
    '<svg viewBox="0 0 44 52" width="22" height="26" fill="none" aria-hidden="true">' +
    '<path d="M32 3 C26 10, 22 18, 19 26 C16 34, 13 38, 11 42" ' +
    'stroke="currentColor" stroke-width="2.4" stroke-linecap="round" fill="none"/>' +
    '<path d="M11 42 C9 44, 7 46, 6 48" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" fill="none"/>' +
    '<path d="M6 48 L2 50 M6 48 L10 51" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>' +
    "</svg>";

  teaserStack.appendChild(teaser);
  teaserStack.appendChild(teaserArrow);

  var panel = document.createElement("div");
  panel.className = "gg-ai-chat-panel";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", "Garage door repair assistant");
  panel.setAttribute("aria-hidden", "true");
  panel.innerHTML =
    '<div class="gg-ai-chat-panel__shine" aria-hidden="true"></div>' +
    '<div class="gg-ai-chat-panel__glow" aria-hidden="true"></div>';

  var header = document.createElement("header");
  header.className = "gg-ai-chat-header";
  header.innerHTML =
    '<div class="gg-ai-chat-header__brand">' +
    '<div class="gg-ai-chat-header__avatar" aria-hidden="true">A</div>' +
    '<div class="gg-ai-chat-header__copy">' +
    '<strong class="gg-ai-chat-header__title">Alex · Garage Guys</strong>' +
    '<span class="gg-ai-chat-header__status">' +
    '<span class="gg-ai-chat-header__dot"></span>' +
    '<span class="gg-ai-chat-header__status-text">' + headerDefaultStatus + "</span></span>" +
    "</div></div>" +
    '<button type="button" class="gg-ai-chat-close" aria-label="Close chat">&times;</button>';

  headerStatusEl = header.querySelector(".gg-ai-chat-header__status-text");

  var chipsWrap = document.createElement("div");
  chipsWrap.className = "gg-ai-chat-chips-wrap";

  var chipsLabel = document.createElement("p");
  chipsLabel.className = "gg-ai-chat-chips__label";
  chipsLabel.textContent = "Quick picks";

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
  chipsWrap.appendChild(chipsLabel);
  chipsWrap.appendChild(chips);

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
  input.placeholder = "Describe what's happening…";
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
    '<span class="gg-ai-chat-launcher__icon" aria-hidden="true">' + LAUNCHER_ICON_SVG + "</span>";

  launcherWrap.appendChild(launcherGlow1);
  launcherWrap.appendChild(launcherGlow2);
  launcherWrap.appendChild(launcher);

  function pickThinkingSequence(userText) {
    var lower = userText.toLowerCase();
    if (lower.indexOf("spring") >= 0) return THINKING_SEQUENCES.spring;
    if (lower.indexOf("opener") >= 0 || lower.indexOf("remote") >= 0) return THINKING_SEQUENCES.opener;
    if (lower.indexOf("track") >= 0 || lower.indexOf("off track") >= 0) return THINKING_SEQUENCES.track;
    if (
      lower.indexOf("won't open") >= 0
      || lower.indexOf("wont open") >= 0
      || lower.indexOf("stuck") >= 0
      || lower.indexOf("won't close") >= 0
      || lower.indexOf("wont close") >= 0
    ) {
      return THINKING_SEQUENCES.stuck;
    }
    return THINKING_SEQUENCES.default;
  }

  function setHeaderActivity(text) {
    if (!headerStatusEl) return;
    header.classList.add("gg-ai-chat-header--thinking");
    headerStatusEl.textContent = text;
  }

  function resetHeaderActivity() {
    if (!headerStatusEl) return;
    header.classList.remove("gg-ai-chat-header--thinking");
    headerStatusEl.textContent = headerDefaultStatus;
  }

  function showThinkingIndicator(userText) {
    hideThinkingIndicator();

    var steps = pickThinkingSequence(userText);
    var stepIndex = 0;
    thinkingStartedAt = Date.now();

    thinkingRow = document.createElement("div");
    thinkingRow.className = "gg-ai-chat-row gg-ai-chat-row--bot gg-ai-chat-row--thinking";
    thinkingRow.setAttribute("aria-live", "polite");
    thinkingRow.setAttribute("aria-busy", "true");

    var avatar = document.createElement("div");
    avatar.className = "gg-ai-chat-row__avatar";
    avatar.innerHTML = AVATAR_ICON_SVG;

    var bubble = document.createElement("div");
    bubble.className = "gg-ai-chat-bubble gg-ai-chat-bubble--bot gg-ai-chat-bubble--thinking";

    var thought = document.createElement("span");
    thought.className = "gg-ai-chat-thought";

    var dots = document.createElement("span");
    dots.className = "gg-ai-chat-thinking-dots";
    dots.setAttribute("aria-hidden", "true");
    dots.innerHTML = "<span></span><span></span><span></span>";

    bubble.appendChild(thought);
    bubble.appendChild(dots);
    thinkingRow.appendChild(avatar);
    thinkingRow.appendChild(bubble);
    log.appendChild(thinkingRow);
    log.scrollTop = log.scrollHeight;

    function applyStep(text) {
      thought.classList.add("gg-ai-chat-thought--fade");
      window.setTimeout(function () {
        thought.textContent = text;
        thought.classList.remove("gg-ai-chat-thought--fade");
        setHeaderActivity(text);
        log.scrollTop = log.scrollHeight;
      }, 220);
    }

    applyStep(steps[0]);

    thinkingTimer = window.setInterval(function () {
      stepIndex = (stepIndex + 1) % steps.length;
      applyStep(steps[stepIndex]);
    }, THINKING_STEP_MS);
  }

  function hideThinkingIndicator() {
    if (thinkingTimer) {
      window.clearInterval(thinkingTimer);
      thinkingTimer = null;
    }
    if (thinkingRow) {
      thinkingRow.remove();
      thinkingRow = null;
    }
    resetHeaderActivity();
  }

  function afterThinkingPause(callback) {
    var elapsed = Date.now() - thinkingStartedAt;
    var wait = Math.max(0, THINKING_MIN_MS - elapsed);
    window.setTimeout(callback, wait);
  }

  function appendBubble(role, content) {
    var row = document.createElement("div");
    row.className =
      role === "user"
        ? "gg-ai-chat-row gg-ai-chat-row--user"
        : "gg-ai-chat-row gg-ai-chat-row--bot";

    if (role === "assistant") {
      var avatar = document.createElement("div");
      avatar.className = "gg-ai-chat-row__avatar";
      avatar.innerHTML = AVATAR_ICON_SVG;
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
    showThinkingIndicator(userText);

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
        afterThinkingPause(function () {
          hideThinkingIndicator();
          if (payload.reply) {
            messages.push({ role: "assistant", content: payload.reply });
            appendBubble("assistant", payload.reply);
          }
          if (payload.leadSubmitted && payload.inboxItemId) {
            markSubmitted(payload.inboxItemId);
          }
        });
      })
      .catch(function () {
        afterThinkingPause(function () {
          hideThinkingIndicator();
          appendBubble(
            "assistant",
            "Sorry, something went wrong. Please call (949) 539-0009 or use Request Callback.",
          );
        });
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
  panel.appendChild(chipsWrap);
  panel.appendChild(status);
  panel.appendChild(log);
  panel.appendChild(form);
  anchor.appendChild(panel);
  anchor.appendChild(teaserStack);
  anchor.appendChild(launcherWrap);
  root.appendChild(anchor);
  document.body.appendChild(root);
  updateTeaser();
})();
