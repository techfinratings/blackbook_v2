/* 자료실 목록 — Supabase(archive_files) 우선, 미설정 시 구글시트 첫 탭 A2:I
   응답은 시트 values 형태({ values: [...] })로 통일해 클라이언트 변경을 최소화.
   Supabase 경로는 10번째 컬럼(J)에 행 id를 실어 다운로드 카운트에 사용한다. */
const sb = require('../lib/supabase');

const SHEET_ID = '1gsjz9DXDHaFgGTOrx42i6_XEgqETq_n1db3zO6ZMH6Y';
const API_KEY  = 'AIzaSyBpaRMklAo95BOau2BcebuZv5kMsWV6zik';   // Supabase 이관 완료 시 시트 경로와 함께 제거 예정
const RANGE    = 'A2:I';

module.exports = async function (req, res) {
  res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=86400');

  if (sb.ready()) {
    try {
      const rows = await sb.select('archive_files?visible=eq.true&order=dated.desc,id.desc&select=*');
      const values = (rows || []).map(r => [
        r.name, r.description, r.category, r.file_type, r.prep,
        r.related_url, r.download_url, r.dated, String(r.downloads || 0), String(r.id),
      ]);
      return res.status(200).json({ values });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  const url = 'https://sheets.googleapis.com/v4/spreadsheets/' + SHEET_ID
            + '/values/' + encodeURIComponent(RANGE) + '?key=' + API_KEY;
  try {
    const r    = await fetch(url);
    const data = await r.json();
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
