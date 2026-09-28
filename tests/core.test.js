const assert = require('assert');
const core = require('../core.js');

assert.strictEqual(core.normalizeHandle('@Alice_1'), 'Alice_1');
assert.strictEqual(core.normalizeHandle('bad handle'), '');
assert.strictEqual(core.normalizeHandle('abcdefghijklmnop'), '');

const previous = {
  followers: [
    { handle: 'alice', name: 'Alice' },
    { handle: 'bob', name: 'Bob' },
    { handle: 'gone', name: 'Gone' }
  ],
  following: []
};
const current = {
  followers: [
    { handle: 'Alice', name: 'Alice New' },
    { handle: 'bob', name: 'Bob' },
    { handle: 'new_user', name: 'New' }
  ],
  following: [
    { handle: 'alice', name: 'Alice' },
    { handle: 'not_back', name: 'Not Back' }
  ]
};

const result = core.compareSnapshots(current, previous);
assert.strictEqual(result.followers, 3);
assert.strictEqual(result.following, 2);
assert.deepStrictEqual(result.notFollowingBack.map(x => x.handle), ['not_back']);
assert.deepStrictEqual(result.youDoNotFollow.map(x => x.handle), ['bob', 'new_user']);
assert.deepStrictEqual(result.mutual.map(x => x.handle), ['Alice']);
assert.deepStrictEqual(result.unfollowed.map(x => x.handle), ['gone']);
assert.deepStrictEqual(result.newFollowers.map(x => x.handle), ['new_user']);

const csv = core.csvFor(result.notFollowingBack, '未回关你');
assert(csv.startsWith('\uFEFF'));
assert(csv.includes('@not_back'));
assert(csv.includes('https://x.com/not_back'));
console.log('Extension core tests: OK');
