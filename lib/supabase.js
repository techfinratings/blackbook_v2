/* ============================================================
   Supabase PostgREST 헬퍼 (서버 전용)
   환경변수:
     SUPABASE_URL               프로젝트 URL (기본: 블랙북 프로젝트)
     SUPABASE_SERVICE_ROLE_KEY  service_role 키 — Vercel 환경변수로만 주입.
                                RLS를 우회하므로 절대 클라이언트에 노출 금지.
   키가 없으면 ready()가 false — 호출부는 기존 동작(시트/규칙)으로 폴백한다.
   ============================================================ */
const SUPABASE_URL = (process.env.SUPABASE_URL || 'https://tguedjytddbfeekiulqf.supabase.co').replace(/\/$/, '');
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

function ready() { return !!SERVICE_KEY; }

async function rest(pathAndQuery, opts) {
  if (!SERVICE_KEY) throw new Error('SUPABASE_SERVICE_ROLE_KEY 환경변수가 설정되지 않았습니다.');
  opts = opts || {};
  const r = await fetch(SUPABASE_URL + '/rest/v1/' + pathAndQuery, {
    method: opts.method || 'GET',
    headers: Object.assign({
      apikey: SERVICE_KEY,
      Authorization: 'Bearer ' + SERVICE_KEY,
      'Content-Type': 'application/json',
    }, opts.headers || {}),
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    signal: AbortSignal.timeout(opts.timeout || 8000),
  });
  if (!r.ok) throw new Error('supabase ' + r.status + ': ' + (await r.text()).slice(0, 300));
  if (r.status === 204) return null;
  const text = await r.text();
  return text ? JSON.parse(text) : null;
}

// SELECT — query 예: "calendar_events?year=eq.2026&month=eq.7&select=*"
function select(query) { return rest(query); }

// INSERT — rows: 객체 배열
function insert(table, rows) {
  return rest(table, { method: 'POST', body: rows, headers: { Prefer: 'return=minimal' } });
}

// UPSERT — onConflict: 유니크 제약 컬럼 목록(쉼표 구분)
function upsert(table, rows, onConflict) {
  return rest(table + '?on_conflict=' + encodeURIComponent(onConflict), {
    method: 'POST', body: rows,
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
  });
}

module.exports = { ready, rest, select, insert, upsert, SUPABASE_URL };
