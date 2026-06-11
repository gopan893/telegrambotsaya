'use strict';

jest.mock('axios');

const axios = require('axios');
const alerter = require('../../src/alerting/telegram-alerter');

describe('Telegram Alerter', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetAllMocks();
    process.env = { ...originalEnv };
    process.env.ALERT_ENABLED = 'true';
    process.env.ALERT_MIN_LEVEL = 'warning';
    process.env.TELEGRAM_TOKEN = 'test:token';
    process.env.OWNER_CHAT_ID = '12345';
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  test('sends alert to Telegram API', async () => {
    axios.post.mockResolvedValue({
      data: { ok: true, result: { message_id: 1 } }
    });

    const result = await alerter.sendOwnerAlert('Test warning message', 'warning');
    expect(result.ok).toBe(true);
    expect(axios.post).toHaveBeenCalledTimes(1);
    expect(axios.post.mock.calls[0][0]).toContain('api.telegram.org/bot');
    expect(axios.post.mock.calls[0][1].chat_id).toBe('12345');
    expect(axios.post.mock.calls[0][1].text).toContain('[WARNING]');
  });

  test('does not send when alerting is disabled', async () => {
    process.env.ALERT_ENABLED = 'false';
    const result = await alerter.sendOwnerAlert('Test', 'warning');
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('alerting_disabled');
    expect(axios.post).not.toHaveBeenCalled();
  });

  test('does not send when token is missing', async () => {
    process.env.TELEGRAM_TOKEN = '';
    process.env.TELEGRAM_TOKEN_ORCHESTRATOR = '';
    const result = await alerter.sendOwnerAlert('Test', 'warning');
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('missing_config');
    expect(axios.post).not.toHaveBeenCalled();
  });

  test('does not send when owner chat id is missing', async () => {
    process.env.OWNER_CHAT_ID = '';
    const result = await alerter.sendOwnerAlert('Test', 'warning');
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('missing_config');
    expect(axios.post).not.toHaveBeenCalled();
  });

  test('does not send if level is below minimum', async () => {
    process.env.ALERT_MIN_LEVEL = 'critical';
    const result = await alerter.sendOwnerAlert('Test info', 'info');
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('below_min_level');
    expect(axios.post).not.toHaveBeenCalled();
  });

  test('sends info level when min level is info', async () => {
    process.env.ALERT_MIN_LEVEL = 'info';
    axios.post.mockResolvedValue({
      data: { ok: true, result: { message_id: 1 } }
    });
    const result = await alerter.sendOwnerAlert('Test info message', 'info');
    expect(result.ok).toBe(true);
    expect(axios.post).toHaveBeenCalledTimes(1);
    expect(axios.post.mock.calls[0][1].text).toContain('[INFO]');
  });

  test('handles API error gracefully', async () => {
    axios.post.mockRejectedValue(new Error('Network error'));
    const result = await alerter.sendOwnerAlert('Test', 'warning');
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('Network error');
  });

  test('rate limits same error type', async () => {
    axios.post.mockResolvedValue({
      data: { ok: true, result: { message_id: 1 } }
    });

    const first = await alerter.sendOwnerAlert('Same error message', 'warning');
    expect(first.ok).toBe(true);

    const second = await alerter.sendOwnerAlert('Same error message', 'warning');
    expect(second.ok).toBe(false);
    expect(second.reason).toBe('rate_limited');

    expect(axios.post).toHaveBeenCalledTimes(1);
  });

  test('critical level sends even with higher rate', async () => {
    axios.post.mockResolvedValue({
      data: { ok: true, result: { message_id: 1 } }
    });
    const result = await alerter.sendOwnerAlert('Critical alert test', 'critical');
    expect(result.ok).toBe(true);
    expect(axios.post.mock.calls[0][1].text).toContain('[CRITICAL]');
  });
});
