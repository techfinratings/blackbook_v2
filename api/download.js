/* 자료실 다운로드 카운트 증가 — Supabase(archive_files.downloads +1)
   [이관 완료: 구글시트 경로·하드코딩 키 제거] */
const sb = require('../lib/supabase');

module.exports = async function (req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { id } = req.body || {};
  if (!id) return res.status(400).json({ error: 'id required' });
  if (!sb.ready()) return res.status(503).json({ error: 'SUPABASE_SERVICE_ROLE_KEY 미설정' });

  try {
    const cur = await sb.select('archive_files?id=eq.' + encodeURIComponent(id) + '&select=downloads');
    const count = ((cur && cur[0] && cur[0].downloads) || 0) + 1;
    await sb.rest('archive_files?id=eq.' + encodeURIComponent(id), {
      method: 'PATCH', body: { downloads: count }, headers: { Prefer: 'return=minimal' },
    });
    return res.status(200).json({ count });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
