// Copyright (C) 2026 evieliii
// SPDX-License-Identifier: GPL-3.0-only
'use strict';

chrome.action.onClicked.addListener(async (tab) => {
  if (tab.url && tab.url.startsWith('https://x.com/')) {
    try {
      await chrome.tabs.sendMessage(tab.id, { type: 'XFT_TOGGLE_PANEL' });
      return;
    } catch (_) {
      // The page may have been open before the extension was installed.
      await chrome.storage.local.set({ xftOpenOnLoad: true });
      await chrome.tabs.reload(tab.id);
      return;
    }
  }

  await chrome.storage.local.set({ xftOpenOnLoad: true });
  await chrome.tabs.create({ url: 'https://x.com/home' });
});
