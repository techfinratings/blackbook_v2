/* 문답 API
   GET  → 문답 탭의 게시글 목록(최신순). 관리자가 H열(노출)을 'N'으로 두면 숨김.
   POST { category, title, content, tags?, anonymous } → 문답 탭에 append */
const { appendRow, readRows } = require('../lib/sheets');

// 답변 탭에서 문답ID별 답변 수·운영사여부 집계
async function answerStats() {
  try {
    const rows = await readRows('답변');
    const stat = {};
    rows.slice(1).forEach(r => {
      const content = r[4] || ''; const hidden = (r[6] || '').toUpperCase() === 'N';
      if (!content || hidden) return;
      const qid = r[1] || ''; const official = (r[3] || '').toUpperCase() === 'Y';
      if (!stat[qid]) stat[qid] = { count: 0, official: false };
      stat[qid].count++; if (official) stat[qid].official = true;
    });
    return stat;
  } catch (e) { return {}; }
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  if (req.method === 'GET') {
    res.setHeader('Cache-Control', 's-maxage=15, stale-while-revalidate=60');
    try {
      const rows = await readRows('문답');
      const stat = await answerStats();
      const items = rows.slice(1)                 // 헤더 제외
        .map((r, i) => {
          const ts = r[0] || '';
          const s = stat[ts] || { count: 0, official: false };
          return {
            row: i + 2, id: ts,                     // 문답ID = 일시(고유)
            ts: ts, category: r[1] || '', title: r[2] || '',
            content: r[3] || '', tags: r[4] || '', anonymous: (r[5] || '') === 'Y',
            hidden: String(r[7] || '').toUpperCase() === 'N',   // H열=노출, 'N'이면 숨김
            ans: s.count, official: s.official,
          };
        })
        .filter(x => x.title && !x.hidden)
        .reverse();                                // 최신순
      return res.status(200).json({ items });
    } catch (e) {
      console.error('qna read error:', e.message);
      return res.status(200).json({ items: [] });
    }
  }

  if (req.method !== 'POST') { res.status(405).json({ error: 'GET/POST only' }); return; }

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
