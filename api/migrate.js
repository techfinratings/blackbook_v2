/* ============================================================
   구글시트 → Supabase 1회성 이관 API
   POST /api/migrate  헤더 x-admin-key: ADMIN_PASSWORD
   · 자료실(첫 탭 A2:I) → archive_files
   · 문답 → qna_questions (legacy_ts=일시)
   · 답변 → qna_answers (question_ts=문답ID)
   · 리드 → leads · 의견 → feedback
   이미 데이터가 있는 테이블은 건너뛴다(중복 방지). ?force=1 로 재실행 가능.
   이관 완료 확인 후: GCP에서 서비스계정 키 폐기 + 시트 폴백 코드 제거.
   ============================================================ */
const { readRows, getAccessToken, SHEET_ID } = require('../lib/sheets');
const sb = require('../lib/supabase');

async function readFirstTab() {   // 자료실 = 첫 번째 탭(A2:I)
  const token = await getAccessToken();
  const r = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent('A2:I')}`,
    { headers: { Authorization: 'Bearer ' + token } });
  if (!r.ok) return [];
  return (await r.json()).values || [];
}

async function isEmpty(table) {
  const rows = await sb.select(table + '?select=id&limit=1');
  return !rows || !rows.length;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const key = process.env.ADMIN_PASSWORD;
  if (!key || (req.headers['x-admin-key'] || '') !== key) {
    return res.status(401).json({ error: '관리자 인증 실패' });
  }
  if (!sb.ready()) return res.status(503).json({ error: 'SUPABASE_SERVICE_ROLE_KEY 미설정' });

  const force = !!(req.query && req.query.force);
  const report = {};

  try {
    // 자료실
    if (force || await isEmpty('archive_files')) {
      const rows = (await readFirstTab()).filter(r => (r[0] || '').trim());
      if (rows.length) await sb.insert('archive_files', rows.map(r => ({
        name: (r[0] || '').trim(), description: (r[1] || '').trim(), category: (r[2] || '').trim(),
        file_type: (r[3] || '').trim().toUpperCase(), prep: (r[4] || '').trim(),
        related_url: (r[5] || '').trim(), download_url: (r[6] || '').trim(),
        dated: (r[7] || '').trim(), downloads: parseInt(r[8] || '0', 10) || 0,
      })));
      report.archive_files = rows.length;
    } else report.archive_files = 'skipped(비어있지 않음)';

    // 문답
    if (force || await isEmpty('qna_questions')) {
      const rows = (await readRows('문답')).slice(1).filter(r => (r[2] || '').trim());
      if (rows.length) await sb.upsert('qna_questions', rows.map(r => ({
        legacy_ts: r[0] || '', category: r[1] || '', title: (r[2] || '').slice(0, 300),
        content: (r[3] || '').slice(0, 4000), tags: r[4] || '',
        anonymous: (r[5] || '') === 'Y', ua: r[6] || '',
        hidden: String(r[7] || '').toUpperCase() === 'N',
        created_at: r[0] || undefined,
      })), 'legacy_ts');
      report.qna_questions = rows.length;
    } else report.qna_questions = 'skipped';

    // 답변
    if (force || await isEmpty('qna_answers')) {
      const rows = (await readRows('답변')).slice(1).filter(r => (r[4] || '').trim());
      if (rows.length) await sb.insert('qna_answers', rows.map(r => ({
        question_ts: r[1] || '', author: r[2] || '',
        official: (r[3] || '').toUpperCase() === 'Y', content: (r[4] || '').slice(0, 4000),
        hidden: (r[6] || '').toUpperCase() === 'N', created_at: r[0] || undefined,
      })));
      report.qna_answers = rows.length;
    } else report.qna_answers = 'skipped';

    // 리드
    if (force || await isEmpty('leads')) {
      const rows = (await readRows('리드')).slice(1).filter(r => (r[2] || '').trim());
      if (rows.length) await sb.insert('leads', rows.map(r => ({
        source: r[1] || '', email: r[2] || '', consent: (r[3] || '').toUpperCase() === 'Y',
        detail: r[4] || '', ua: r[5] || '', created_at: r[0] || undefined,
      })));
      report.leads = rows.length;
    } else report.leads = 'skipped';

    // 의견
    if (force || await isEmpty('feedback')) {
      const rows = (await readRows('의견')).slice(1).filter(r => (r[1] || '').trim());
      if (rows.length) await sb.insert('feedback', rows.map(r => ({
        content: (r[1] || '').slice(0, 2000), email: r[2] || '', ua: r[3] || '',
        created_at: r[0] || undefined,
      })));
      report.feedback = rows.length;
    } else report.feedback = 'skipped';

    res.status(200).json({ ok: true, migrated: report });
  } catch (e) {
    console.error('migrate error:', e.message);
    res.status(500).json({ error: e.message, partial: report });
  }
};
