(function () {
  function setActive(buttons, target, attr) {
    buttons.forEach(function (button) {
      button.classList.toggle("is-active", button.getAttribute(attr) === target);
      button.setAttribute("aria-pressed", button.getAttribute(attr) === target ? "true" : "false");
    });
  }

  function switchPanels(root, target) {
    var buttons = Array.from(root.querySelectorAll("[data-tab-button]")).filter(function (button) {
      return button.closest("[data-tab-group]") === root;
    });
    var panels = Array.from(root.querySelectorAll("[data-tab-panel]")).filter(function (panel) {
      return panel.closest("[data-tab-group]") === root;
    });
    setActive(buttons, target, "data-tab-button");
    panels.forEach(function (panel) {
      panel.hidden = panel.getAttribute("data-tab-panel") !== target;
    });
  }

  function switchChannel(root, target) {
    var buttons = Array.from(root.querySelectorAll("[data-channel-button]"));
    var panels = Array.from(root.querySelectorAll("[data-channel-panel]"));
    setActive(buttons, target, "data-channel-button");
    panels.forEach(function (panel) {
      panel.hidden = panel.getAttribute("data-channel-panel") !== target;
    });
    root.setAttribute("data-active-channel", target);
  }

  function showToast(message) {
    var toast = document.querySelector("[data-toast]");
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("is-visible");
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(function () {
      toast.classList.remove("is-visible");
    }, 1800);
  }

  function appendChatMessage(form) {
    var panel = form.closest("[data-chat-panel]");
    var input = form.querySelector("textarea");
    if (!panel || !input) return;
    var text = input.value.trim();
    if (!text) {
      showToast("先输入一条大厅消息。");
      return;
    }
    var channel = panel.getAttribute("data-active-channel") || "lobby";
    var stream = panel.querySelector('[data-channel-panel="' + channel + '"]');
    if (!stream) return;
    var article = document.createElement("article");
    article.className = "sd-message";
    article.innerHTML = '<div class="sd-message-meta"><span class="sd-badge">' + channel.toUpperCase() + '</span><span>你</span><span>刚刚</span></div><p></p>';
    article.querySelector("p").textContent = text;
    stream.appendChild(article);
    input.value = "";
    stream.scrollTop = stream.scrollHeight;
    showToast("消息已加入当前频道预览。");
  }

  function init() {
    document.querySelectorAll("[data-tab-group]").forEach(function (group) {
      var active = group.querySelector("[data-tab-button].is-active") || group.querySelector("[data-tab-button]");
      if (active) switchPanels(group, active.getAttribute("data-tab-button"));
    });

    document.querySelectorAll("[data-chat-panel]").forEach(function (panel) {
      var active = panel.querySelector("[data-channel-button].is-active") || panel.querySelector("[data-channel-button]");
      if (active) switchChannel(panel, active.getAttribute("data-channel-button"));
    });

    document.addEventListener("click", function (event) {
      var tabButton = event.target.closest("[data-tab-button]");
      if (tabButton) {
        var group = tabButton.closest("[data-tab-group]");
        if (group) switchPanels(group, tabButton.getAttribute("data-tab-button"));
        return;
      }

      var channelButton = event.target.closest("[data-channel-button]");
      if (channelButton) {
        var chatPanel = channelButton.closest("[data-chat-panel]");
        if (chatPanel) switchChannel(chatPanel, channelButton.getAttribute("data-channel-button"));
        return;
      }

      var toastButton = event.target.closest("[data-action-toast]");
      if (toastButton) showToast(toastButton.getAttribute("data-action-toast"));
    });

    document.addEventListener("submit", function (event) {
      event.preventDefault();
      var form = event.target;
      if (form.matches("[data-chat-form]")) appendChatMessage(form);
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})();