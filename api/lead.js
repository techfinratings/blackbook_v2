/* 이메일 리드 적재 — 파인더/자료실 공용
   POST { type:'finder'|'download', email, consent, source?, item?, row? }
   → Google Sheets: 파인더리드 / 자료리드 탭에 append */
const { appendRow } = require('../lib/sheets');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'POST only' }); return; }

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  body = body || {};

  const email = String(body.email || '').trim();
  const consent = body.consent ? 'Y' : 'N';
  const ua = (req.headers['user-agent'] || '').slice(0, 200);
  const now = new Date().toISOString();

  if (!EMAIL_RE.test(email)) { res.status(400).json({ error: '유효한 이메일이 아닙니다.' }); return; }

  try {
    if (body.type === 'download') {
      await appendRow('자료리드', [now, email, consent, String(body.item || ''), String(body.row || ''), ua]);
    } else {
      await appendRow('파인더리드', [now, email, consent, String(body.source || 'finder'), ua]);
    }
    res.status(200).json({ ok: true });
  } catch (e) {
    console.error('lead append error:', e.message);
    res.status(500).json({ error: '적재 실패' });
  }
};
