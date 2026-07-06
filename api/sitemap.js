/* /sitemap.xml — 정적 라우트 + Inblog 콘텐츠 상세(URL) 자동 수집 */
const BLOG_ID = '10195';
const STATIC = ['/', '/content', '/community/talk', '/archive', '/calendar', '/finder'];

module.exports = async (req, res) => {
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'blackbook-red.vercel.app';
  const proto = (req.headers['x-forwarded-proto'] || 'https').split(',')[0];
  const base = `${proto}://${host}`;

  const urls = STATIC.map(p => ({ loc: base + p, priority: p === '/' ? '1.0' : '0.7' }));

  const key = process.env.INBLOG_API_KEY;
  if (key) {
    try {
      const r = await fetch(
        `https://inblog.ai/api/v1/posts?blog_id=${BLOG_ID}&per_page=100&sort=published_at`,
        { headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(8000) });
      if (r.ok) {
        const data = await r.json();
        (data.data || []).forEach(p => {
          const slug = p.attributes?.slug || p.id;
          const lastmod = (p.attributes?.published_at || '').slice(0, 10);
          urls.push({ loc: `${base}/p/${encodeURIComponent(slug)}`, priority: '0.8', lastmod });
        });
      }
    } catch (e) { /* 정적 라우트만이라도 반환 */ }
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url><loc>${u.loc}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}<priority>${u.priority}</priority></url>`).join('\n')}
</urlset>`;

  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
  res.status(200).send(xml);
};
