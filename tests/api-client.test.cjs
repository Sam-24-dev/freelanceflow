const test = require('node:test');
const assert = require('node:assert/strict');

function loadClient({ cookie = '', fetchImpl }) {
  const originalFetch = global.fetch;
  const originalDocument = global.document;
  global.fetch = fetchImpl;
  global.document = { cookie };
  delete require.cache[require.resolve('../assets/js/api-client.js')];
  const api = require('../assets/js/api-client.js');
  return {
    api,
    restore() {
      global.fetch = originalFetch;
      global.document = originalDocument;
      delete global.FreelanceFlowApi;
      delete require.cache[require.resolve('../assets/js/api-client.js')];
    }
  };
}

test('clients omits cursor when absent and preserves the API data', async () => {
  const calls = [];
  const responseData = { items: [{ public_id: 'client-1' }], next_cursor: 'next' };
  const harness = loadClient({
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return { ok: true, status: 200, json: async () => ({ data: responseData }) };
    }
  });

  try {
    assert.deepEqual(await harness.api.clients(), responseData);
    assert.deepEqual(calls, [{
      url: '/api/v1/clients/',
      options: { credentials: 'same-origin', headers: { Accept: 'application/json' } }
    }]);
  } finally {
    harness.restore();
  }
});

test('clients URL-encodes a cursor and preserves the API data', async () => {
  const calls = [];
  const responseData = { items: [], next_cursor: null };
  const harness = loadClient({
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return { ok: true, status: 200, json: async () => ({ data: responseData }) };
    }
  });

  try {
    assert.deepEqual(await harness.api.clients('next page/ß'), responseData);
    assert.equal(calls[0].url, '/api/v1/clients/?cursor=next%20page%2F%C3%9F');
    assert.equal(calls[0].options.credentials, 'same-origin');
  } finally {
    harness.restore();
  }
});

test('createClient delegates JSON and CSRF handling to the existing POST behavior', async () => {
  const calls = [];
  const payload = { legal_name: 'Acme', contact_email: 'contact@example.com' };
  const responseData = { client: { public_id: 'client-1' } };
  const harness = loadClient({
    cookie: 'csrftoken=csrf%20token',
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return { ok: true, status: 201, json: async () => ({ data: responseData }) };
    }
  });

  try {
    assert.deepEqual(await harness.api.createClient(payload), responseData);
    assert.deepEqual(calls, [{
      url: '/api/v1/clients/',
      options: {
        credentials: 'same-origin',
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'X-CSRFToken': 'csrf token'
        },
        body: JSON.stringify(payload)
      }
    }]);
  } finally {
    harness.restore();
  }
});

test('clients preserves API error status and error code', async () => {
  const harness = loadClient({
    fetchImpl: async () => ({
      ok: false,
      status: 409,
      json: async () => ({ error: { code: 'client_conflict' } })
    })
  });

  try {
    await assert.rejects(harness.api.clients(), (error) => {
      assert.equal(error.status, 409);
      assert.equal(error.code, 'client_conflict');
      assert.equal(error.message, 'client_conflict');
      return true;
    });
  } finally {
    harness.restore();
  }
});

test('createClient preserves API error status and error code', async () => {
  const harness = loadClient({
    cookie: 'csrftoken=csrf-token',
    fetchImpl: async () => ({
      ok: false,
      status: 422,
      json: async () => ({ error: { code: 'validation_failed' } })
    })
  });

  try {
    await assert.rejects(harness.api.createClient({}), (error) => {
      assert.equal(error.status, 422);
      assert.equal(error.code, 'validation_failed');
      assert.equal(error.message, 'validation_failed');
      return true;
    });
  } finally {
    harness.restore();
  }
});
