/* ============================================================
   Google Sheets 서비스계정 헬퍼 (리드/문답 적재 공용)
   기존 api/download.js와 동일한 서비스계정을 사용합니다.
   보안: 비밀키는 코드에 두지 않는다 — Vercel 환경변수 필수.
     GOOGLE_SA_EMAIL  서비스계정 이메일
     GOOGLE_SA_KEY    서비스계정 PRIVATE KEY (JSON의 private_key 값 그대로,
                      개행은 \n 이스케이프 형태로 붙여넣기)
     LEADS_SHEET_ID   대상 스프레드시트 ID
   ============================================================ */
const crypto = require('crypto');

const SA_EMAIL = process.env.GOOGLE_SA_EMAIL || "blackbook-sheets@blackbook-497708.iam.gserviceaccount.com";
const PRIVATE_KEY = String(process.env.GOOGLE_SA_KEY || '').replace(/\\n/g, '\n');
const SHEET_ID = process.env.LEADS_SHEET_ID || "1gsjz9DXDHaFgGTOrx42i6_XEgqETq_n1db3zO6ZMH6Y";

function assertKey() {
  if (!PRIVATE_KEY) throw new Error('GOOGLE_SA_KEY 환경변수가 설정되지 않았습니다. Vercel 프로젝트 설정에서 서비스계정 키를 등록하세요.');
}

// 액세스 토큰 모듈 캐시(warm 인스턴스 재사용). 토큰 1h 유효 → 50분 캐시.
let _tokenCache = null; // { token, exp(ms) }
async function getAccessToken(scope) {
  assertKey();
  if (_tokenCache && Date.now() < _tokenCache.exp) return _tokenCache.token;
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    iss: SA_EMAIL,
    scope: scope || 'https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600, iat: now,
  })).toString('base64url');
  const toSign = header + '.' + payload;
  const sign = crypto.createSign('RSA-SHA256'); sign.update(toSign);
  const jwt = toSign + '.' + sign.sign(PRIVATE_KEY, 'base64url');
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=' + jwt,
  });
  const data = await r.json();
  if (!data.access_token) throw new Error('token: ' + JSON.stringify(data));
  _tokenCache = { token: data.access_token, exp: Date.now() + 50 * 60 * 1000 };
  return data.access_token;
}

// 탭 메타(제목→sheetId) 조회 — 모듈 캐시(60초). 탭 이름/구성은 자주 안 바뀜.
let _metaCache = null; // { props, at }
async function sheetMeta(token) {
  if (_metaCache && Date.now() - _metaCache.at < 60000) return _metaCache.props;
  const r = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}?fields=sheets.properties(sheetId,title)`,
    { headers: { Authorization: 'Bearer ' + token } });
  const d = await r.json();
  const props = (d.sheets || []).map(s => s.properties);
  _metaCache = { props, at: Date.now() };
  return props;
}

// 탭 이름 해석: 정확히 일치하면 그대로, 아니면 이름에 키워드가 포함된 탭.
// (사용자가 탭 이름을 바꿔도 '리드'/'의견'/'문답'/'답변' 키워드만 유지되면 안 깨짐)
async function resolveTab(token, name) {
  try {
    const props = await sheetMeta(token);
    const titles = props.map(p => p.title);
    if (titles.indexOf(name) >= 0) return name;
    const hit = titles.find(t => t.indexOf(name) >= 0);
    return hit || name;
  } catch (e) { return name; }
}

// 지정 탭 끝에 한 행 append (탭 이름은 키워드로 해석)
async function appendRow(tab, values) {
  const token = await getAccessToken();
  const resolved = await resolveTab(token, tab);
  const range = encodeURIComponent(resolved + '!A1');
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${range}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
  const r = await fetch(url, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ values: [values] }),
  });
  if (!r.ok) throw new Error('append ' + r.status + ': ' + (await r.text()).slice(0, 200));
  return r.json();
}

// 지정 탭 전체 행 읽기(헤더 포함). 없거나 오류면 [].
async function readRows(tab) {
  const token = await getAccessToken();
  const resolved = await resolveTab(token, tab);
  const range = encodeURIComponent(resolved);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${range}`;
  const r = await fetch(url, { headers: { Authorization: 'Bearer ' + token } });
  if (!r.ok) return [];
  const data = await r.json();
  return data.values || [];
}

// 셀 하나 업데이트 (관리자 모더레이션용). a1 예: 'H5'
async function updateCell(tab, a1, value) {
  const token = await getAccessToken();
  const resolved = await resolveTab(token, tab);
  const range = encodeURIComponent(resolved + '!' + a1);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${range}?valueInputOption=RAW`;
  const r = await fetch(url, {
    method: 'PUT',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ values: [[value]] }),
  });
  if (!r.ok) throw new Error('update ' + r.status);
  return r.json();
}

// 행 삭제 (1-indexed 시트 행번호)
async function deleteRow(tab, rowNumber) {
  const token = await getAccessToken();
  const props = await sheetMeta(token);
  const resolved = (props.find(p => p.title === tab) || props.find(p => p.title.indexOf(tab) >= 0) || {}).title || tab;
  const sheetId = (props.find(p => p.title === resolved) || {}).sheetId;
  if (sheetId == null) throw new Error('no sheet');
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}:batchUpdate`;
  const r = await fetch(url, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ requests: [{ deleteDimension: { range: { sheetId, dimension: 'ROWS', startIndex: rowNumber - 1, endIndex: rowNumber } } }] }),
  });
  if (!r.ok) throw new Error('delete ' + r.status);
  return r.json();
}

module.exports = { getAccessToken, appendRow, readRows, updateCell, deleteRow, SHEET_ID };
