import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { createLlmClient, getLlmClient, LlmError, llmRetryPolicy } from '../src/services/llm/client.js';

const saved = { ...llmRetryPolicy };
beforeAll(() => Object.assign(llmRetryPolicy, { baseDelayMs: 1, maxDelayMs: 5 }));
afterAll(() => Object.assign(llmRetryPolicy, saved));
afterEach(() => vi.unstubAllGlobals());

const schema = z.object({ label: z.string(), keywords: z.array(z.string()).min(3) });
const reply = (content: string, status = 200) =>
  new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status, headers: { 'content-type': 'application/json' } });
const client = () => createLlmClient({ baseUrl: 'https://api.groq.com/openai/v1/', apiKey: 'test-key-not-real', model: 'llama-3.3-70b-versatile' });

describe('shared LLM client (services/llm/client.ts)', () => {
  it('posts an OpenAI-compatible JSON-mode request and returns schema-validated output', async () => {
    const fetchMock = vi.fn().mockResolvedValue(reply('{"label":"Gradient descent basics","keywords":["a","b","c"]}'));
    vi.stubGlobal('fetch', fetchMock);
    await expect(client().generateJson('label this', schema)).resolves.toEqual({ label: 'Gradient descent basics', keywords: ['a', 'b', 'c'] });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://api.groq.com/openai/v1/chat/completions');
    const body = JSON.parse(init.body);
    expect(body).toMatchObject({ model: 'llama-3.3-70b-versatile', temperature: 0, response_format: { type: 'json_object' } });
    expect(init.headers.Authorization).toBe('Bearer test-key-not-real');
  });

  it('retries 429/5xx, but not other 4xx', async () => {
    const flaky = vi.fn().mockResolvedValueOnce(new Response('slow down', { status: 429 })).mockResolvedValueOnce(new Response('oops', { status: 503 })).mockResolvedValue(reply('{"label":"x","keywords":["a","b","c"]}'));
    vi.stubGlobal('fetch', flaky);
    await client().generateJson('p', schema);
    expect(flaky).toHaveBeenCalledTimes(3);

    const bad = vi.fn().mockResolvedValue(new Response('bad request', { status: 400 }));
    vi.stubGlobal('fetch', bad);
    await expect(client().generateJson('p', schema)).rejects.toMatchObject({ status: 400 });
    expect(bad).toHaveBeenCalledTimes(1);
  });

  it('waits for the provider\'s Retry-After on a 429 when it is within maxDelayMs, then retries', async () => {
    vi.useFakeTimers();
    try {
      const limited = vi.fn()
        .mockResolvedValueOnce(new Response('rate limited', { status: 429, headers: { 'retry-after': '2' } }))
        .mockResolvedValue(reply('{"label":"x","keywords":["a","b","c"]}'));
      vi.stubGlobal('fetch', limited);
      Object.assign(llmRetryPolicy, { baseDelayMs: 1, maxDelayMs: 5_000 });
      const pending = client().generateJson('p', schema);
      await vi.advanceTimersByTimeAsync(1_999);
      expect(limited).toHaveBeenCalledTimes(1); // still waiting out Retry-After: 2 s
      await vi.advanceTimersByTimeAsync(2);
      await expect(pending).resolves.toMatchObject({ label: 'x' });
      expect(limited).toHaveBeenCalledTimes(2);
    } finally {
      Object.assign(llmRetryPolicy, { baseDelayMs: 1, maxDelayMs: 5 });
      vi.useRealTimers();
    }
  });

  it('fails fast — no retries — when the provider asks for a longer wait than maxDelayMs (e.g. a daily quota)', async () => {
    const limited = vi.fn().mockResolvedValue(
      new Response('Rate limit reached for model on tokens per day (TPD) in organization org_abc123XYZ', { status: 429, headers: { 'retry-after': '521' } }),
    );
    vi.stubGlobal('fetch', limited);
    const error = await client().generateJson('p', schema).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(LlmError);
    expect(error).toMatchObject({ status: 429, retryAfterSec: 521 });
    expect((error as Error).message).not.toMatch(/org_abc123XYZ/); // account ids stay out of logs
    expect(limited).toHaveBeenCalledOnce();
  });

  it('reports the provider\'s token usage, summed over attempts', async () => {
    const withUsage = (content: string, prompt: number, completion: number) =>
      new Response(JSON.stringify({ choices: [{ message: { content } }], usage: { prompt_tokens: prompt, completion_tokens: completion } }), { status: 200 });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(withUsage('not json', 100, 5)).mockResolvedValueOnce(withUsage('{"label":"x","keywords":["a","b","c"]}', 120, 9)));
    const { data, usage } = await client().generateJsonWithUsage!('p', schema);
    expect(data).toMatchObject({ label: 'x' });
    expect(usage).toEqual({ promptTokens: 220, completionTokens: 14 });
  });

  it('asks once more when the output is not valid JSON or fails the schema, then gives up with LlmError', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(reply('Sure! Here is JSON:')).mockResolvedValueOnce(reply('{"label":"x","keywords":["only one"]}'));
    vi.stubGlobal('fetch', fetchMock);
    const err = await client().generateJson('p', schema).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(LlmError);
    expect((err as Error).message).toMatch(/did not match the schema/);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('is absent when no API key is configured (tests run without keys), so callers use their fallback', () => {
    expect(getLlmClient()).toBeNull();
  });
});
