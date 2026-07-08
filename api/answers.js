/* 답변 API — 문답 스레드의 답변
   GET  ?qid=<문답ID>       → 해당 질문의 표시 답변(운영사 우선, 최신)
   POST { qid, content, author?, official?, adminKey? }
        · 커뮤니티 답변(official 아님): 누구나
        · 운영사(크레디뷰) 답변(official:true): ADMIN_PASSWORD 필요
   답변 탭: [일시, 문답ID, 작성자, 운영사(Y/N), 내용, 도움돼요, 노출(N=숨김)] */
const { appendRow, readRows } = require('../lib/sheets');

function rowsToAnswers(rows) {
  return rows.slice(1).map((r, i) => ({
    row: i + 2,
    ts: r[0] || '', qid: r[1] || '', author: r[2] || '',
    official: (r[3] || '').toUpperCase() === 'Y',
    content: r[4] || '', helpful: parseInt(r[5] || '0', 10) || 0,
    hidden: (r[6] || '').toUpperCase() === 'N',
  })).filter(a => a.content && !a.hidden);
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-key');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  if (req.method === 'GET') {
    res.setHeader('Cache-Control', 's-maxage=10, stale-while-revalidate=60');
    const qid = String((req.query && req.query.qid) || '').trim();
    try {
      const all = rowsToAnswers(await readRows('답변'));
      const items = (qid ? all.filter(a => a.qid === qid) : all)
        .sort((a, b) => (b.official - a.official) || String(a.ts).localeCompare(String(b.ts)));
      return res.status(200).json({ items });
    } catch (e) { return res.status(200).json({ items: [] }); }
  }

  if (req.method !== 'POST') { res.status(405).json({ error: 'GET/POST only' }); return; }

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  body = body || {};

  const qid = String(body.qid || '').trim();
  const content = String(body.content || '').trim();
  const official = !!body.official;
  if (!qid || !content) { res.status(400).json({ error: '질문과 내용이 필요합니다.' }); return; }

  // 운영사(크레디뷰 공식) 답변은 관리자 인증 필요
  if (official) {
    const key = process.env.ADMIN_PASSWORD;
    const given = (req.headers['x-admin-key'] || body.adminKey || '');
    if (!key) { res.status(503).json({ error: '관리자 비밀번호(ADMIN_PASSWORD)가 설정되지 않았습니다.' }); return; }
    if (given !== key) { res.status(401).json({ error: '관리자 인증 실패' }); return; }
  }

  const now = new Date().toISOString();
  const author = official ? '크레디뷰 리서치' : (String(body.author || '').trim() || '익명');
  try {
    await appendRow('답변', [now, qid, author, official ? 'Y' : 'N', content.slice(0, 4000), 0, '']);
    res.status(200).json({ ok: true });
  } catch (e) {
    console.error('answer append error:', e.message);
    res.status(500).json({ error: '적재 실패' });
  }
};
