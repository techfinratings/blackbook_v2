/* 자료실 다운로드 카운트 증가 — I열(다운로드 수) +1
   서비스계정 인증은 lib/sheets.js 공용 헬퍼 사용(비밀키는 환경변수 GOOGLE_SA_KEY). */
const { getAccessToken, SHEET_ID } = require('../lib/sheets');

module.exports = async function (req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { row } = req.body || {};
  if (!row) return res.status(400).json({ error: 'row required' });

  try {
    const token   = await getAccessToken();
    const range   = `자료실!I${row}`;
    const baseUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(range)}`;

    const readData = await (await fetch(baseUrl, {
      headers: { Authorization: `Bearer ${token}` },
    })).json();
    const current = parseInt(readData.values?.[0]?.[0] || '0', 10);

    await fetch(`${baseUrl}?valueInputOption=RAW`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ values: [[current + 1]] }),
    });

    res.status(200).json({ count: current + 1 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
