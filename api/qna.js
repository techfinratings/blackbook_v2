/* 문답 기입 적재 — POST { category, title, content, tags?, anonymous }
   → Google Sheets: 문답 탭에 append */
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

  const title = String(body.title || '').trim();
  const content = String(body.content || '').trim();
  if (!title || !content) { res.status(400).json({ error: '제목과 내용을 입력해 주세요.' }); return; }

  const now = new Date().toISOString();
  const ua = (req.headers['user-agent'] || '').slice(0, 200);
  try {
    await appendRow('문답', [
      now,
      String(body.category || ''),
      title.slice(0, 300),
      content.slice(0, 4000),
      String(body.tags || ''),
      body.anonymous ? 'Y' : 'N',
      ua,
    ]);
    res.status(200).json({ ok: true });
  } catch (e) {
    console.error('qna append error:', e.message);
    res.status(500).json({ error: '적재 실패' });
  }
};
