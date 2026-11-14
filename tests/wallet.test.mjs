import test from 'node:test';
import assert from 'node:assert/strict';
import { DEMO_ACCOUNTS, demoRoles, requestWalletAccounts, selectWalletAccount } from '../src/wallet.js';

const [owner, learner, other] = DEMO_ACCOUNTS.map(a => a.address);
const SEPOLIA = 11155111;
const makeProvider = handler => ({ request: async args => handler(args) });

test('reconnection requests account selection before reading previously permitted accounts', async () => {
  const calls = [];
  const provider = makeProvider(({ method, params }) => {
    calls.push(method);
    if (method === 'wallet_requestPermissions') { assert.deepEqual(params, [{ eth_accounts: {} }]); return []; }
    if (method === 'eth_requestAccounts') return [owner, learner];
    assert.fail(method);
  });
  assert.deepEqual(await requestWalletAccounts(provider, { requestSelection: true }), { accounts: [owner, learner], selectionSupported: true });
  assert.deepEqual(calls, ['wallet_requestPermissions', 'eth_requestAccounts']);
});

test('cancelling account selection never falls back to connecting the old account', async () => {
  const calls = [];
  const rejected = Object.assign(new Error('Rejected'), { code: 4001 });
  const provider = makeProvider(({ method }) => { calls.push(method); throw rejected; });
  await assert.rejects(requestWalletAccounts(provider, { requestSelection: true }), error => error === rejected);
  assert.deepEqual(calls, ['wallet_requestPermissions']);
});

test('wallets without permission API return an explicit unsupported flag and permitted account choices', async () => {
  for (const code of [-32601, 4200]) {
    const provider = makeProvider(({ method }) => {
      if (method === 'wallet_requestPermissions') throw Object.assign(new Error('Unsupported'), { code });
      if (method === 'eth_requestAccounts') return [learner];
      assert.fail(method);
    });
    assert.deepEqual(await requestWalletAccounts(provider, { requestSelection: true }), { accounts: [learner], selectionSupported: false });
  }
});

test('pending or failed permission requests cannot silently use cached accounts', async () => {
  const failure = Object.assign(new Error('Request pending'), { code: -32002 });
  await assert.rejects(requestWalletAccounts(makeProvider(() => { throw failure; }), { requestSelection: true }), error => error === failure);
});

test('missing providers, empty accounts and malformed provider responses fail clearly', async () => {
  await assert.rejects(requestWalletAccounts(undefined), /MetaMask/);
  for (const response of [[], null, ['invalid']]) {
    await assert.rejects(requestWalletAccounts(makeProvider(() => response)), /Wallet/);
  }
});

test('explicit account choice uses the selected second account instead of the old first one', async () => {
  const provider = makeProvider(({ method }) => method === 'eth_accounts' ? [owner, learner] : '0xaa36a7');
  assert.equal(await selectWalletAccount(provider, learner, SEPOLIA), learner);
});

test('an address not permitted by the wallet cannot be selected', async () => {
  const provider = makeProvider(() => [owner]);
  await assert.rejects(selectWalletAccount(provider, learner, SEPOLIA), /ยังไม่ได้รับอนุญาต/);
});

test('network switching preserves and rechecks the chosen account', async () => {
  let chain = '0x1';
  const provider = makeProvider(({ method, params }) => {
    if (method === 'eth_accounts') return [owner, learner];
    if (method === 'eth_chainId') return chain;
    if (method === 'wallet_switchEthereumChain') { assert.deepEqual(params, [{ chainId: '0xaa36a7' }]); chain = '0xaa36a7'; return null; }
    assert.fail(method);
  });
  assert.equal(await selectWalletAccount(provider, learner, SEPOLIA), learner);
});

test('account removal during network switching aborts instead of using a different account', async () => {
  let changed = false;
  const provider = makeProvider(({ method }) => {
    if (method === 'eth_accounts') return changed ? [owner] : [owner, learner];
    if (method === 'eth_chainId') return changed ? '0xaa36a7' : '0x1';
    if (method === 'wallet_switchEthereumChain') { changed = true; return null; }
    assert.fail(method);
  });
  await assert.rejects(selectWalletAccount(provider, learner, SEPOLIA), /เปลี่ยนระหว่างเชื่อมต่อ/);
});

test('a wallet that stays on the wrong chain cannot report a successful connection', async () => {
  const provider = makeProvider(({ method }) => method === 'eth_accounts' ? [owner] : method === 'eth_chainId' ? '0x1' : null);
  await assert.rejects(selectWalletAccount(provider, owner, SEPOLIA), /Sepolia/);
});

test('demo learners have no management rights until explicitly granted, and removal takes effect', () => {
  const registry = { admins: [owner], issuers: [] };
  assert.deepEqual(demoRoles(owner, registry), { owner: true, admin: true, issuer: true });
  assert.deepEqual(demoRoles(learner, registry), { owner: false, admin: false, issuer: false });
  registry.issuers.push(other);
  assert.deepEqual(demoRoles(other, registry), { owner: false, admin: false, issuer: true });
  registry.issuers = [];
  assert.equal(demoRoles(other, registry).issuer, false);
  registry.admins.push(learner);
  assert.deepEqual(demoRoles(learner, registry), { owner: false, admin: true, issuer: true });
});
