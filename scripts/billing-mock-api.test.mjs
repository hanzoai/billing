import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';

function startMockBillingServer() {
  const plans = [
    { id: 'free', name: 'Free', priceCents: 0, currency: 'usd', interval: 'month' },
    { id: 'pro', name: 'Pro', priceCents: 2000, currency: 'usd', interval: 'month' },
    { id: 'max', name: 'Max', priceCents: 20000, currency: 'usd', interval: 'month' },
  ];
  const invoices = [
    { id: 'inv_1', status: 'paid', amountCents: 2000, currency: 'usd' },
    { id: 'inv_2', status: 'open', amountCents: 20000, currency: 'usd' },
    { id: 'inv_3', status: 'void', amountCents: 0, currency: 'usd' },
  ];
  const usage = { period: '2026-11', tokensUsed: 125000, tokenQuota: 500000 };

  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    res.setHeader('Content-Type', 'application/json');

    if (url.pathname === '/api/v1/plans') {
      res.end(JSON.stringify({ data: plans }));
      return;
    }
    if (url.pathname === '/api/v1/invoices') {
      const status = url.searchParams.get('status');
      const filtered = status ? invoices.filter((i) => i.status === status) : invoices;
      res.end(JSON.stringify({ data: filtered, total: filtered.length }));
      return;
    }
    if (url.pathname === '/api/v1/usage') {
      const utilizationPct = Number(((usage.tokensUsed / usage.tokenQuota) * 100).toFixed(2));
      res.end(JSON.stringify({ ...usage, utilizationPct }));
      return;
    }
    res.statusCode = 404;
    res.end(JSON.stringify({ error: 'Not found' }));
  });

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({ server, baseUrl: `http://127.0.0.1:${port}` });
    });
  });
}

test('plans, invoices, and usage mock API endpoints behave deterministically', async () => {
  const { server, baseUrl } = await startMockBillingServer();
  try {
    const plansRes = await fetch(`${baseUrl}/api/v1/plans`);
    assert.equal(plansRes.status, 200);
    const plansBody = await plansRes.json();
    assert.equal(plansBody.data.length, 3);
    assert.equal(plansBody.data[2].priceCents, 20000);

    const invRes = await fetch(`${baseUrl}/api/v1/invoices?status=paid`);
    assert.equal(invRes.status, 200);
    const invBody = await invRes.json();
    assert.equal(invBody.total, 1);
    assert.equal(invBody.data[0].id, 'inv_1');

    const usageRes = await fetch(`${baseUrl}/api/v1/usage`);
    assert.equal(usageRes.status, 200);
    const usageBody = await usageRes.json();
    assert.equal(usageBody.utilizationPct, 25);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
