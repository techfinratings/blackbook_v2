// Inblog 포스트 프록시 — API 키를 서버에서만 사용
// Vercel 환경변수: INBLOG_API_KEY

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
    const r = await fetch(
      'https://inblog.ai/api/v1/posts?blog_id=10195&per_page=9&sort=published_at',
      { headers: { Authorization: `Bearer ${key}` } }
    );

    if (!r.ok) throw new Error(`Inblog API ${r.status}`);
    const data = await r.json();

    const posts = (data.data || [])
      .filter(p => p.attributes.published_at) // 발행된 글만
      .sort((a, b) => (b.attributes.published_at || '').localeCompare(a.attributes.published_at || '')) // 최신순
      .map(p => ({
        id:          p.id,
        title:       p.attributes.title || '',
        slug:        p.attributes.slug  || p.id,
        description: p.attributes.description || '',
        date:        (p.attributes.published_at || '').slice(0, 10),
        image:       p.attributes.image?.url || null,
      }));

    res.status(200).json({ posts });
  } catch (err) {
    console.error('Inblog API error:', err.message);
    res.status(500).json({ error: err.message });
  }
};
