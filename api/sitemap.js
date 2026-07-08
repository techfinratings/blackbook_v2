/* /sitemap.xml — 정적 라우트 + Inblog 발행 콘텐츠 상세(URL) 자동 수집 */
const { fetchPublished } = require('../lib/inblog');
const { GUIDES } = require('../lib/guides');
const STATIC = ['/', '/content', '/guide', '/community/talk', '/archive', '/calendar', '/finder'];

module.exports = async (req, res) => {
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'blackbook-red.vercel.app';
  const proto = (req.headers['x-forwarded-proto'] || 'https').split(',')[0];
  const base = `${proto}://${host}`;

  const urls = STATIC.map(p => ({ loc: base + p, priority: p === '/' ? '1.0' : '0.7' }));
  GUIDES.forEach(g => urls.push({ loc: `${base}/guide/${g.slug}`, priority: '0.8' }));

  const key = process.env.INBLOG_API_KEY;
  if (key) {
    try {
      const posts = await fetchPublished(key);
      posts.forEach(p => {
        urls.push({ loc: `${base}/p/${encodeURIComponent(p.slug)}`, priority: '0.8', lastmod: p.date });
      });
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
