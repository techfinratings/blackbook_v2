/* 문답 API
   GET  → 문답 탭의 게시글 목록(최신순). 관리자가 H열(노출)을 'N'으로 두면 숨김.
   POST { category, title, content, tags?, anonymous } → 문답 탭에 append */
const { appendRow, readRows } = require('../lib/sheets');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  if (req.method === 'GET') {
    res.setHeader('Cache-Control', 's-maxage=15, stale-while-revalidate=60');
    try {
      const rows = await readRows('문답');
      const items = rows.slice(1)                 // 헤더 제외
        .map((r, i) => ({
          row: i + 2,
          ts: r[0] || '', category: r[1] || '', title: r[2] || '',
          content: r[3] || '', tags: r[4] || '', anonymous: (r[5] || '') === 'Y',
          hidden: String(r[7] || '').toUpperCase() === 'N',   // H열=노출, 'N'이면 숨김
        }))
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
