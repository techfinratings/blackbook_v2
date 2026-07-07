// Inblog 포스트 프록시 — 발행(published)건만 반환
// Vercel 환경변수: INBLOG_API_KEY
const { fetchPublished, rawSample } = require('../lib/inblog');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Cache-Control', 's-maxage=300'); // 5분 캐시

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const key = process.env.INBLOG_API_KEY;
  if (!key) {
    return res.status(500).json({ error: 'INBLOG_API_KEY 환경변수가 설정되지 않았습니다.' });
  }

  try {
    // ?debug=1 → 발행 판별 필드 확인용(원본 attributes 노출)
    if (req.query && req.query.debug) {
      const sample = await rawSample(key, 4);
      return res.status(200).json({ debug: true, sample });
    }

    const list = await fetchPublished(key);
    const posts = list.map(p => ({
      id: p.id, title: p.title, slug: p.slug,
      description: p.description, date: p.date, image: p.image,
    }));
    res.status(200).json({ posts });
  } catch (err) {
    console.error('Inblog API error:', err.message);
    res.status(500).json({ error: err.message });
  }
};
