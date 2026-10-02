import { describe, expect, it } from 'vitest';
import {
  generateLicenseKeyPair,
  importLicensePublicKey,
  normalizeLicenseKey,
  parseLicenseKey,
  signLicenseKey,
  verifyLicenseKey,
} from './license.ts';

const setup = async () => {
  const pair = await generateLicenseKeyPair();
  const jwk = await crypto.subtle.exportKey('jwk', pair.publicKey);
  const publicKey = await importLicensePublicKey(jwk);
  return { pair, publicKey };
};

describe('ключи доступа', () => {
  it('принимает правильный ключ своего аккаунта', async () => {
    const { pair, publicKey } = await setup();
    const key = await signLicenseKey(pair.privateKey, '123456789', '2026-12-31');
    expect(key.startsWith('HOS1-123456789-20261231-')).toBe(true);
    const check = await verifyLicenseKey(key, { publicKey, telegramId: '123456789', today: '2026-09-29' });
    expect(check).toEqual({ ok: true, expiresOn: '2026-12-31' });
  });

  it('ключ работает в последний день и перестаёт на следующий', async () => {
    const { pair, publicKey } = await setup();
    const key = await signLicenseKey(pair.privateKey, '1', '2026-12-31');
    expect((await verifyLicenseKey(key, { publicKey, telegramId: '1', today: '2026-12-31' })).ok).toBe(true);
    expect(await verifyLicenseKey(key, { publicKey, telegramId: '1', today: '2027-01-01' })).toEqual({
      ok: false,
      reason: 'expired',
      expiresOn: '2026-12-31',
    });
  });

  it('не работает на другом аккаунте', async () => {
    const { pair, publicKey } = await setup();
    const key = await signLicenseKey(pair.privateKey, '111', '2026-12-31');
    expect(await verifyLicenseKey(key, { publicKey, telegramId: '222', today: '2026-09-29' })).toEqual({
      ok: false,
      reason: 'other-account',
    });
  });

  it('нельзя подделать: исправленные ID или дата ломают подпись', async () => {
    const { pair, publicKey } = await setup();
    const key = await signLicenseKey(pair.privateKey, '111', '2026-10-31');
    const forged = key.replace('HOS1-111-20261031', 'HOS1-222-20991231');
    expect(await verifyLicenseKey(forged, { publicKey, telegramId: '222', today: '2026-09-29' })).toEqual({
      ok: false,
      reason: 'signature',
    });
  });

  it('ключ от чужого секретного ключа не подходит', async () => {
    const { publicKey } = await setup();
    const stranger = await generateLicenseKeyPair();
    const key = await signLicenseKey(stranger.privateKey, '1', '2026-12-31');
    expect((await verifyLicenseKey(key, { publicKey, telegramId: '1', today: '2026-09-29' })).ok).toBe(false);
  });

  it('понимает ключ с пробелами и переносами из чата', async () => {
    const { pair } = await setup();
    const key = await signLicenseKey(pair.privateKey, '42', '2026-12-31');
    const messy = ` ${key.slice(0, 30)}\n${key.slice(30)} `;
    expect(normalizeLicenseKey(messy)).toBe(key);
    expect(parseLicenseKey(messy)?.telegramId).toBe('42');
  });

  it('отклоняет мусор', () => {
    expect(parseLicenseKey('привет')).toBeNull();
    expect(parseLicenseKey('HOS1-1-20261399-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')).toBeNull();
  });
});
