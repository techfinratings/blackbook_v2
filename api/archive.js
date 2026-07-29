/* 자료실 목록 — Supabase(archive_files) [이관 완료: 구글시트 경로 제거]
   응답은 기존 시트 values 형태({ values: [...] })를 유지해 클라이언트 무변경.
   10번째 컬럼(J)에 행 id를 실어 다운로드 카운트에 사용한다. */
const sb = require('../lib/supabase');

module.exports = async function (req, res) {
  res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=86400');

  if (!sb.ready()) return res.status(503).json({ error: 'SUPABASE_SERVICE_ROLE_KEY 미설정' });
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
};
