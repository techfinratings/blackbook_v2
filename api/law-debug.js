module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');

  // 여러 URL 포맷 동시 테스트
  const urls = {
    ascii:   'https://www.law.go.kr/DRF/lawSearch.do?OC=blackbook2026&target=lsSearch&type=JSON&query=law',
    encoded: 'https://www.law.go.kr/DRF/lawSearch.do?OC=blackbook2026&target=lsSearch&type=JSON&query=%EC%84%B8%EB%B2%95',
    raw:     'https://www.law.go.kr/DRF/lawSearch.do?OC=blackbook2026&target=lsSearch&type=JSON&query=세법',
    noquery: 'https://www.law.go.kr/DRF/lawSearch.do?OC=blackbook2026&target=lsSearch&type=JSON',
  };

  const results = {};
  for (const [key, url] of Object.entries(urls)) {
    try {
      const r = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' },
        signal: AbortSignal.timeout(6000),
      });
      const text = await r.text();
      results[key] = { status: r.status, body: text.slice(0, 300) };
    } catch (e) {
      results[key] = { error: e.message };
    }
  }

  res.status(200).json(results);
};
