module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const url = 'https://www.law.go.kr/DRF/lawSearch.do?OC=blackbook2026&target=lsSearch&type=JSON&query=%EC%84%B8%EB%B2%95&display=5&page=1';
  try {
    const r    = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Blackbook/1.0)' },
      signal: AbortSignal.timeout(8000),
    });
    const data = await r.json();
    res.status(200).json({ status: r.status, data });
  } catch (err) {
    res.status(200).json({ error: err.message });
  }
};
