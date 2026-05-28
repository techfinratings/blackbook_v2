// 기업마당 정부공고 캘린더 프록시 — 서버에서 직접 호출 (CORS 우회)

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=3600'); // 1시간 캐시

  const { year, month } = req.query;
  const y = parseInt(year)  || new Date().getFullYear();
  const m = parseInt(month) || new Date().getMonth() + 1; // 1-based

  const pad  = n => String(n).padStart(2, '0');
  const last = new Date(y, m, 0).getDate();
  const s    = `${y}${pad(m)}01`;
  const e    = `${y}${pad(m)}${pad(last)}`;

  const url = `https://www.bizinfo.go.kr/uss/rss/bizInfoListRss.do?schFldCnt=Y&schBizCd=PBNO1&cPage=1&numOfRows=100&frmStartEndDe=${s}&frmEndStartDe=${e}`;

  try {
    const r = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Blackbook/1.0)',
        'Accept': 'application/xml, text/xml, */*',
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!r.ok) throw new Error(`bizinfo ${r.status}`);

    const xml  = await r.text();
    const events = [];

    // 간단한 XML 파싱 (DOMParser 없이)
    const getTag = (str, tag) => {
      const m = str.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tag}>|<${tag}[^>]*>([^<]*)</${tag}>`));
      return m ? (m[1] || m[2] || '').trim() : '';
    };

    const items = xml.split('<item>').slice(1);
    items.forEach(item => {
      item = item.split('</item>')[0];
      const title  = getTag(item, 'title');
      const link   = getTag(item, 'link');
      const endDe  = getTag(item, 'applEndDe')   || getTag(item, 'pblancEndDe') ||
                     getTag(item, 'rceptEndDt')  || getTag(item, 'pbancEndDt');
      const bgDe   = getTag(item, 'applBgngDe')  || getTag(item, 'pbancBgngDt') ||
                     getTag(item, 'rceptBgngDt');

      const push = (de, type) => {
        if (!de || de.length < 8) return;
        const eY = parseInt(de.slice(0,4));
        const eM = parseInt(de.slice(4,6));
        const eD = parseInt(de.slice(6,8));
        if (eY === y && eM === m) {
          events.push({ day: eD, title: title || '정부공고', link, type });
        }
      };

      push(endDe, 'end');
      if (bgDe && bgDe !== endDe) push(bgDe, 'start');
    });

    res.status(200).json({ events, year: y, month: m });
  } catch (err) {
    console.error('Calendar API error:', err.message);
    res.status(500).json({ error: err.message, events: [] });
  }
};
