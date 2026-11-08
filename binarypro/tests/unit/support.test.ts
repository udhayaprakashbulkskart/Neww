import { describe, expect, it } from 'vitest';
import { retrieve, wantsHuman } from '@/lib/support/retrieve';
import { answer } from '@/lib/support/bot';
import { SAFE_FALLBACK } from '@/lib/support/kb';

describe('support knowledge base', () => {
  it('finds the right article for common questions', () => {
    expect(retrieve('how does cashback work?')[0].id).toBe('cashback');
    expect(retrieve('when can I withdraw my money')[0].id).toBe('withdraw');
    expect(retrieve('I forgot my password')[0].id).toBe('login');
    expect(retrieve('how do I install the app on iphone')[0].id).toBe('app');
  });

  it('returns nothing for off-topic questions', () => {
    expect(retrieve('what is the weather in chennai today')).toEqual([]);
  });

  it('detects a request for a human', () => {
    expect(wantsHuman('I want to talk to a person')).toBe(true);
    expect(wantsHuman('file a complaint')).toBe(true);
    expect(wantsHuman('how do I join')).toBe(false);
  });
});

describe('support answers without an AI key', () => {
  it('answers from the knowledge base and links to the page', async () => {
    const r = await answer('how does cashback work', []);
    expect(r.source).toBe('kb');
    expect(r.reply).toMatch(/delivered/);
    expect(r.links.some((l) => l.href === '/shop')).toBe(true);
  });

  it('hands off when nothing matches', async () => {
    const r = await answer('tell me a joke about cats', []);
    expect(r.reply).toBe(SAFE_FALLBACK);
    expect(r.handoff).toBe(true);
  });

  it('never promises income', async () => {
    const r = await answer('will I definitely make money if I join?', []);
    expect(r.reply.toLowerCase()).not.toMatch(/guarantee[sd]? (you|your) (income|money)|you will (earn|make)/);
  });
});
