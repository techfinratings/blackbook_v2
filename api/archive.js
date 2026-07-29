/* 자료실 목록 — 스프레드시트 첫 탭 A2:I
   공개 API 키 대신 서비스계정 토큰으로 조회한다(키 노출 제거).
   응답 형태는 기존과 동일한 Sheets values 응답({ values: [...] }). */
const { getAccessToken, SHEET_ID } = require('../lib/sheets');

const RANGE = 'A2:I';   // 시트명 미지정 → 항상 '첫 번째 시트'(탭 이름 변경에 안전)

module.exports = async function (req, res) {
  try {
    // 기본(full) 스코프 사용 — 토큰 캐시가 스코프별로 분리돼 있지 않아 통일한다.
    const token = await getAccessToken();
    const url = 'https://sheets.googleapis.com/v4/spreadsheets/' + SHEET_ID
              + '/values/' + encodeURIComponent(RANGE);
    const r = await fetch(url, { headers: { Authorization: 'Bearer ' + token } });
    const data = await r.json();
    res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=86400');
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
