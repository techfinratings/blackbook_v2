const BIZMANG_KEY = 'hCd7Cu';

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=3600');

  const { year, month } = req.query;
  const y = parseInt(year)  || new Date().getFullYear();
  const m = parseInt(month) || new Date().getMonth() + 1;

  const url = `https://www.bizinfo.go.kr/uss/rss/bizinfoApi.do?crtfcKey=${BIZMANG_KEY}&dataType=json&searchLclasId=01&pageUnit=100&pageIndex=1`;

  try {
    const r = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Blackbook/1.0)',
        'Accept': 'application/json, */*',
        'Referer': 'https://blackbook-red.vercel.app',
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!r.ok) throw new Error(`bizinfo ${r.status}`);

    const data   = await r.json();
    const items  = data.jsonArray || [];
    const events = [];

    items.forEach(item => {
      const title   = item.pblancNm       || '';
      const link    = item.pblancUrl      || '';
      const reqstDt = item.reqstBeginEndDe || '';

      // 날짜 없는 항목 제외 ("예산 소진시까지" 등)
      if (!title || !reqstDt || !reqstDt.includes('~')) return;

      // "2026-06-01 ~ 2026-06-08" 형태 파싱
      const parts = reqstDt.split('~').map(s => s.trim());

      const parseDate = str => {
        if (!str) return null;
        const p = str.trim().split(' ')[0].split('-');
        if (p.length < 3) return null;
        return { y: parseInt(p[0]), m: parseInt(p[1]), d: parseInt(p[2]) };
      };

      const start = parseDate(parts[0]);
      const end   = parseDate(parts[1]);

      if (start && start.y === y && start.m === m)
        events.push({ day: start.d, title, link, type: 'policy', tag: 'start' });
      if (end && end.y === y && end.m === m)
        events.push({ day: end.d, title, link, type: 'policy', tag: 'end' });
    });

    res.status(200).json({ events, year: y, month: m });
  } catch (err) {
    console.error('Calendar API error:', err.message);
    res.status(200).json({ error: err.message, events: [] });
  }
};
