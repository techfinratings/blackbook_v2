/* ============================================================
   Google Sheets 서비스계정 헬퍼 (리드/문답 적재 공용)
   기존 api/download.js와 동일한 서비스계정을 사용합니다.
   보안: 운영에서는 PRIVATE_KEY를 환경변수(GOOGLE_SA_KEY)로 옮기는 것을 권장.
   ============================================================ */
const crypto = require('crypto');

const SA_EMAIL = "blackbook-sheets@blackbook-497708.iam.gserviceaccount.com";
const PRIVATE_KEY = (process.env.GOOGLE_SA_KEY || "-----BEGIN PRIVATE KEY-----\\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQDKQxFzrWQREBTX\\nA1mwgyplUHPYGwSdL9ZF7gLBiDNzvS0fdHXKGfK+38QiwzG6xv7/yPelen8qBiga\\nO4C5i2c9lF2+mKLdAQnxmTPT/hCUSfNdmbfK1Ee7F9B4vqckqR8S75wC/DJ9NNS6\\nlwmNi50g9OZhV9fksa0QvRuhFV4gHsoMh9TPolIwNw9hrVxS9D6lszDdCZuRlPMk\\n0NH7K0gjXqzBNlrKAJniAnQu6nalFyB7E1YOK99JwniC1ljw/luTx9Y5baYkn0W2\\nuEJBtvCbqDRXFQZrSUff22YYLRXtN9FfDUt9vyU0dsaYlqLT73qRtLuWzwkipJmC\\nx3FVvGVvAgMBAAECggEARfjy4iqDmlWOaB4cGrEd6yPsl8AtFfYVMmcXY/2rEyjI\\nof+nuk3EyVzfXUla/GtYj4PmjMR2lsK/f+fC7i24fzjDP6tNeJih6IegQwA7mxmE\\nTIbf6xcKY8Lm18bZSxkJC4OCXRQDoYYz7ANRhjrdFqgyxU1e/pqrLUXG97DNOd3f\\nhabfruoxV1CkSSHJs2oHPM4BiSyR5GFFYNMqDVR6QErZHMdz7qUASOtnXVk64290\\nsWzGTXqD7evfiVTYFCy3DCFTLCJtMfsk0xwaN9J8JI4zQgGrxEdpj+ChBghk1fLM\\nh1DD5cpbmTY1HASBPGndVRacYY0kE61goHV2VRr06QKBgQDkG/sWJZagk73d3dw7\\nLKFMadx/J2hKiT17iL6HBzNLpx4EU9VD8GlfS6CiLwihOGZvqUUhed5Mvv8mdd9R\\nXevvjHEKt3Jx/smmhUWFuarQAjh6OCtwpXQtN0xILJiH5n00BOXFr4zrUrkrXR53\\nkb2IN3YILniS4JAjhAzBS5kdeQKBgQDi/gtA3Zdp/D7j3ig1jmjSPICIYbIbFuIG\\nQB2HZ/2/4HGrIr5dExYadY0AFmD7OcY0ZEloKQzDDL/nx/XG+6ARVuMXKjsBsa2N\\nMS2S9rRgyhkByhUWReJRD9Ztee31yHNlRefquFPv8MV9WmxIOLFCCnB0tKS8oIO1\\ntSHS7b4oJwKBgQC3lAk7pp6VtrEcCHxAJ0fcnmm073sQWWjgrYlgVBwlK2aN5wYA\\nek/jQJMTUzTnwuM1xA19xn1wWFoxkrVZ33OMwwMKs95n/bw9xo3P9D+Szeaz/dZ/\\n/rgD17gNcc6DuKxUnAhrUz/e9yFM09E8O09EfBYCuZuR4SY/XvuA6J1eSQKBgGeK\\nRgvSiCyaGP3L6j9ztDCh1GdhWOKub282c8G+F6scb/0GHhtKh3yOPkDZ9GbkFZr0\\nW9+dSer2t9q8BUo8oOkH3xJD+yJsr6OF2Sn+So0T4pBEY5YDTpZ3SPIq+fZw9uIt\\nHvqcFf2OsCbbxiSzZ3eeV2mEtNgtx6Zs9v7F30VlAoGBAKHB+TIn4GoSEwn9hABs\\n8JguSdsJk7cE2mQ5DQFJcXoVRlzNdph/zTQl2BDkudWIRNRBxxcNmISS/XJDnC6p\\n8Ej+OVWIAO+IDOnLlondB7nr8pga3Bo1y+idViXZWx7DhPgIarHDBS7+kvZHtDs9\\n3MSzv9j/m8L/Dme7C2x6ui/h\\n-----END PRIVATE KEY-----\\n").replace(/\\n/g, '\n');
const SHEET_ID = process.env.LEADS_SHEET_ID || "1gsjz9DXDHaFgGTOrx42i6_XEgqETq_n1db3zO6ZMH6Y";

async function getAccessToken(scope) {
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
  return data.access_token;
}

// 탭 메타(제목→sheetId) 조회
async function sheetMeta(token) {
  const r = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}?fields=sheets.properties(sheetId,title)`,
    { headers: { Authorization: 'Bearer ' + token } });
  const d = await r.json();
  return (d.sheets || []).map(s => s.properties);
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
