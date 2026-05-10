chrome.runtime.onInstalled.addListener(() => {
  // 1. Create Context Menus
  const menus = [
    { id: "fill-all", title: "Fill All Fields", contexts: ["all"] },
    { id: "fill-field", title: "Fill This Field Only", contexts: ["editable"] },
    { id: "clear-all", title: "Clear All Fields", contexts: ["all"] }
  ];
  
  menus.forEach(m => {
    chrome.contextMenus.create(m, () => {
      if (chrome.runtime.lastError) {
        // Silently ignore if menu already exists
      }
    });
  });

  // 2. Auto Re-inject to existing tabs
  chrome.tabs.query({ url: ["http://*/*", "https://*/*"] }).then(tabs => {
    for (const tab of tabs) {
      if (tab.url.startsWith("chrome://") || tab.url.startsWith("edge://")) continue;
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["data/checksums.js", "data/en.js", "data/id.js", "content.js"]
      }).catch(() => {
        // Ignore errors on restricted tabs
      });
    }
  }).catch(() => {});
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  const { language } = await chrome.storage.local.get("language");
  const lang = language || "en";

  if (info.menuItemId === "fill-all") {
    chrome.tabs.sendMessage(tab.id, { action: "fill", language: lang });
  } else if (info.menuItemId === "fill-field") {
    chrome.tabs.sendMessage(tab.id, { action: "fill-single", language: lang });
  } else if (info.menuItemId === "clear-all") {
    chrome.tabs.sendMessage(tab.id, { action: "clear" });
  }
});

chrome.commands.onCommand.addListener(async (command) => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;

  const { language } = await chrome.storage.local.get("language");
  const lang = language || "en";

  if (command === "fill-form") {
    chrome.tabs.sendMessage(tab.id, { action: "fill", language: lang });
  } else if (command === "clear-form") {
    chrome.tabs.sendMessage(tab.id, { action: "clear" });
  }
});
