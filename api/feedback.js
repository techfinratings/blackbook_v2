/* 의견 적재 — POST { text, email? } → Google Sheets '의견' 탭 */
const { appendRow } = require('../lib/sheets');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'POST only' }); return; }

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  body = body || {};

  const text = String(body.text || '').trim();
  const email = String(body.email || '').trim();
  if (!text) { res.status(400).json({ error: '의견 내용을 입력해 주세요.' }); return; }

  const now = new Date().toISOString();
  const ua = (req.headers['user-agent'] || '').slice(0, 200);
  try {
    await appendRow('의견', [now, text.slice(0, 2000), email, ua]);
    res.status(200).json({ ok: true });
  } catch (e) {
    console.error('feedback append error:', e.message);
    res.status(500).json({ error: '적재 실패' });
  }
};
