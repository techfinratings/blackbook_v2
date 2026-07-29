/* 관리자 API — 비밀번호(ADMIN_PASSWORD) 보호
   POST { key, action, ... }
     action=overview                      → 문답/답변/리드/의견 전체 데이터
     action=answer   { qid, content }     → 운영사(크레디뷰) 공식 답변 등록
     action=hideQuestion { row, value }   → 문답 노출(H열) 'N'=숨김 / ''=표시
     action=hideAnswer   { row, value }   → 답변 노출(G열)
     action=delete   { tab, row }         → 행 삭제 (문답/답변/리드/의견)
     action=migrate  { force? }           → 구글시트 → Supabase 1회성 이관
   Supabase 키가 설정돼 있으면 Supabase를, 아니면 구글시트를 관리한다.
   (row 필드는 Supabase 모드에서 테이블 행 id를 담는다)
*/
const { readRows, appendRow, updateCell, deleteRow } = require('../lib/sheets');
const sb = require('../lib/supabase');

function objQuestions(rows) {
  return rows.slice(1).map((r, i) => ({
    row: i + 2, ts: r[0] || '', category: r[1] || '', title: r[2] || '',
    content: r[3] || '', tags: r[4] || '', anonymous: (r[5] || '') === 'Y',
    hidden: String(r[7] || '').toUpperCase() === 'N',
  }));
}
function objAnswers(rows) {
  return rows.slice(1).map((r, i) => ({
    row: i + 2, ts: r[0] || '', qid: r[1] || '', author: r[2] || '',
    official: (r[3] || '').toUpperCase() === 'Y', content: r[4] || '',
    helpful: parseInt(r[5] || '0', 10) || 0, hidden: (r[6] || '').toUpperCase() === 'N',
  }));
}
function objLeads(rows) {
  return rows.slice(1).map((r, i) => ({
    row: i + 2, ts: r[0] || '', source: r[1] || '', email: r[2] || '',
    consent: r[3] || '', detail: r[4] || '',
  }));
}
function objFeedback(rows) {
  return rows.slice(1).map((r, i) => ({
    row: i + 2, ts: r[0] || '', text: r[1] || '', email: r[2] || '',
  }));
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'POST only' }); return; }

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  body = body || {};

  const key = process.env.ADMIN_PASSWORD;
  if (!key) { res.status(503).json({ error: '관리자 비밀번호(ADMIN_PASSWORD)가 서버에 설정되지 않았습니다.' }); return; }
  if (String(body.key || '') !== key) { res.status(401).json({ error: '비밀번호가 올바르지 않습니다.' }); return; }

  const action = body.action;
  try {
    if (action === 'migrate') {
      const result = await require('../lib/migrate').runMigration(!!body.force);
      return res.status(result.ok ? 200 : 500).json(result);
    }
    /* ── 자료실 관리 (Supabase 전용) ── */
    if (action === 'archiveList') {
      if (!sb.ready()) return res.status(503).json({ error: 'Supabase 미설정' });
      const rows = await sb.select('archive_files?order=id.desc&select=*');
      return res.status(200).json({ files: rows || [] });
    }
    if (action === 'archiveAdd') {
      if (!sb.ready()) return res.status(503).json({ error: 'Supabase 미설정' });
      const name = String(body.name || '').trim();
      const url = String(body.download_url || '').trim();
      if (!name || !url) return res.status(400).json({ error: '파일명과 다운로드 링크는 필수입니다.' });
      await sb.insert('archive_files', [{
        name: name.slice(0, 200),
        description: String(body.description || '').slice(0, 500),
        category: String(body.category || '실무'),
        file_type: String(body.file_type || '').toUpperCase().slice(0, 10),
        prep: String(body.prep || '').slice(0, 200),
        related_url: String(body.related_url || '').slice(0, 500),
        download_url: url.slice(0, 500),
        dated: String(body.dated || '').slice(0, 10),
      }]);
      return res.status(200).json({ ok: true });
    }
    if (action === 'archiveVisible') {
      if (!sb.ready()) return res.status(503).json({ error: 'Supabase 미설정' });
      await sb.rest('archive_files?id=eq.' + parseInt(body.id, 10), {
        method: 'PATCH', body: { visible: !!body.visible }, headers: { Prefer: 'return=minimal' },
      });
      return res.status(200).json({ ok: true });
    }
    if (action === 'archiveDelete') {
      if (!sb.ready()) return res.status(503).json({ error: 'Supabase 미설정' });
      await sb.rest('archive_files?id=eq.' + parseInt(body.id, 10), { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
      return res.status(200).json({ ok: true });
    }

    if (action === 'guideFlags') {
      // 실무백과 '검토 필요' 플래그 목록 (크론이 개정 법령 감지 시 적재)
      if (!sb.ready()) return res.status(200).json({ flags: [] });
      try {
        const rows = await sb.select('guide_flags?order=created_at.desc&select=*');
        return res.status(200).json({ flags: rows || [] });
      } catch (e) { return res.status(200).json({ flags: [], error: e.message.slice(0, 120) }); }
    }
    if (action === 'ackFlag') {
      // 확인 처리 = 플래그 삭제 (백과 내용 반영을 마친 뒤 누른다)
      if (!sb.ready()) return res.status(503).json({ error: 'Supabase 미설정' });
      await sb.rest('guide_flags?id=eq.' + parseInt(body.id, 10), { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
      return res.status(200).json({ ok: true });
    }
    if (action === 'diag') {
      // Supabase 연결 점검: 키 유무 + 테이블별 접근 가능 여부/행 수
      const out = { supabase_key: sb.ready() ? '설정됨' : '미설정(폴백: 구글시트)', tables: {} };
      if (sb.ready()) {
        for (const t of ['leads', 'feedback', 'qna_questions', 'qna_answers', 'archive_files', 'calendar_events']) {
          try {
            const rows = await sb.select(t + '?select=id&limit=1000');
            out.tables[t] = 'OK · ' + (rows ? rows.length : 0) + '행' + ((rows && rows.length === 1000) ? '+' : '');
          } catch (e) {
            out.tables[t] = '오류: ' + e.message.slice(0, 120);
          }
        }
      }
      return res.status(200).json(out);
    }

    /* ── Supabase 모드 ── */
    if (sb.ready()) {
      if (action === 'overview') {
        const [q, a, l, f] = await Promise.all([
          sb.select('qna_questions?order=created_at.asc&select=*'),
          sb.select('qna_answers?order=created_at.asc&select=*'),
          sb.select('leads?order=created_at.asc&select=*'),
          sb.select('feedback?order=created_at.asc&select=*'),
        ]);
        return res.status(200).json({
          questions: (q || []).map(x => ({
            row: x.id, ts: x.legacy_ts || x.created_at, category: x.category || '',
            title: x.title, content: x.content || '', tags: x.tags || '',
            anonymous: !!x.anonymous, hidden: !!x.hidden,
          })).reverse(),
          answers: (a || []).map(x => ({
            row: x.id, ts: x.created_at, qid: x.question_ts, author: x.author || '',
            official: !!x.official, content: x.content, helpful: 0, hidden: !!x.hidden,
          })),
          leads: (l || []).map(x => ({
            row: x.id, ts: x.created_at, source: x.source || '', email: x.email,
            consent: x.consent ? 'Y' : 'N', detail: x.detail || '',
          })).reverse(),
          feedback: (f || []).map(x => ({
            row: x.id, ts: x.created_at, text: x.content, email: x.email || '',
          })).reverse(),
        });
      }
      if (action === 'answer') {
        const qid = String(body.qid || '').trim();
        const content = String(body.content || '').trim();
        if (!qid || !content) { res.status(400).json({ error: 'qid·내용 필요' }); return; }
        await sb.insert('qna_answers', [{ question_ts: qid, author: '크레디뷰 리서치', official: true, content: content.slice(0, 4000) }]);
        return res.status(200).json({ ok: true });
      }
      if (action === 'hideQuestion' || action === 'hideAnswer') {
        const table = action === 'hideQuestion' ? 'qna_questions' : 'qna_answers';
        await sb.rest(table + '?id=eq.' + parseInt(body.row, 10), {
          method: 'PATCH', body: { hidden: body.value === 'N' }, headers: { Prefer: 'return=minimal' },
        });
        return res.status(200).json({ ok: true });
      }
      if (action === 'delete') {
        const tableMap = { question: 'qna_questions', answer: 'qna_answers', lead: 'leads', feedback: 'feedback' };
        const table = tableMap[body.tab]; if (!table) { res.status(400).json({ error: 'bad tab' }); return; }
        await sb.rest(table + '?id=eq.' + parseInt(body.row, 10), { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
        return res.status(200).json({ ok: true });
      }
      return res.status(400).json({ error: 'unknown action' });
    }

    /* ── 구글시트 모드(폴백) ── */
    if (action === 'overview') {
      const [q, a, l, f] = await Promise.all([
        readRows('문답'), readRows('답변'), readRows('리드'), readRows('의견'),
      ]);
      return res.status(200).json({
        questions: objQuestions(q).reverse(),
        answers: objAnswers(a),
        leads: objLeads(l).reverse(),
        feedback: objFeedback(f).reverse(),
      });
    }
    if (action === 'answer') {
      const qid = String(body.qid || '').trim();
      const content = String(body.content || '').trim();
      if (!qid || !content) { res.status(400).json({ error: 'qid·내용 필요' }); return; }
      await appendRow('답변', [new Date().toISOString(), qid, '크레디뷰 리서치', 'Y', content.slice(0, 4000), 0, '']);
      return res.status(200).json({ ok: true });
    }
    if (action === 'hideQuestion') {
      await updateCell('문답', 'H' + parseInt(body.row, 10), body.value === 'N' ? 'N' : '');
      return res.status(200).json({ ok: true });
    }
    if (action === 'hideAnswer') {
      await updateCell('답변', 'G' + parseInt(body.row, 10), body.value === 'N' ? 'N' : '');
      return res.status(200).json({ ok: true });
    }
    if (action === 'delete') {
      const tabMap = { question: '문답', answer: '답변', lead: '리드', feedback: '의견' };
      const tab = tabMap[body.tab]; if (!tab) { res.status(400).json({ error: 'bad tab' }); return; }
      await deleteRow(tab, parseInt(body.row, 10));
      return res.status(200).json({ ok: true });
    }
    return res.status(400).json({ error: 'unknown action' });
  } catch (e) {
    console.error('admin error:', e.message);
    return res.status(500).json({ error: e.message });
  }
};
