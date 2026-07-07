/* 이메일 리드 적재 — 파인더/자료실 공용, 단일 '리드' 탭에 구분 컬럼으로 통합
   POST { type:'finder'|'download', email, consent, source?, item?, row? }
   → Google Sheets '리드' 탭: [일시, 구분, 이메일, 마케팅동의, 상세, User-Agent] */
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

  // 유입 출처 구분
  const isDownload = body.type === 'download';
  const source = isDownload ? '자료실' : '정책자금 파인더';
  const detail = isDownload ? String(body.item || '') : String(body.source || '파인더 사전신청');

  try {
    await appendRow('리드', [now, source, email, consent, detail, ua]);
    res.status(200).json({ ok: true });
  } catch (e) {
    console.error('lead append error:', e.message);
    res.status(500).json({ error: '적재 실패' });
  }
};
