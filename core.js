// Copyright (C) 2026 evieliii
// SPDX-License-Identifier: GPL-3.0-only
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.XFollowCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function normalizeHandle(value) {
    const handle = String(value || '').trim().replace(/^@/, '');
    return /^[A-Za-z0-9_]{1,15}$/.test(handle) ? handle : '';
  }

  function mapProfiles(list) {
    const map = new Map();
    for (const profile of Array.isArray(list) ? list : []) {
      const handle = normalizeHandle(profile && profile.handle);
      if (!handle) continue;
      map.set(handle.toLowerCase(), {
        handle,
        name: String(profile.name || '').trim() || handle
      });
    }
    return map;
  }

  function sorted(values) {
    return [...values].sort((a, b) => a.handle.localeCompare(b.handle, 'en', { sensitivity: 'base' }));
  }

  function difference(a, b) {
    return sorted([...a.entries()].filter(([key]) => !b.has(key)).map(([, value]) => value));
  }

  function intersection(a, b) {
    return sorted([...a.entries()].filter(([key]) => b.has(key)).map(([, value]) => value));
  }

  function compareSnapshots(current, previous) {
    const followers = mapProfiles(current && current.followers);
    const following = mapProfiles(current && current.following);
    const oldFollowers = mapProfiles(previous && previous.followers);

    return {
      followers: followers.size,
      following: following.size,
      notFollowingBack: difference(following, followers),
      youDoNotFollow: difference(followers, following),
      mutual: intersection(followers, following),
      unfollowed: previous ? difference(oldFollowers, followers) : [],
      newFollowers: previous ? difference(followers, oldFollowers) : []
    };
  }

  function csvFor(rows, category) {
    const quote = value => `"${String(value == null ? '' : value).replace(/"/g, '""')}"`;
    return '\uFEFF' + [
      ['用户名', '显示名称', '分类', '个人主页'].map(quote).join(','),
      ...rows.map(row => [
        `@${row.handle}`,
        row.name,
        category,
        `https://x.com/${row.handle}`
      ].map(quote).join(','))
    ].join('\r\n');
  }

  return { normalizeHandle, mapProfiles, compareSnapshots, csvFor };
});
