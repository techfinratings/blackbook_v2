const SHEET_ID = '1gsjz9DXDHaFgGTOrx42i6_XEgqETq_n1db3zO6ZMH6Y';
const API_KEY  = 'AIzaSyBpaRMklAo95BOau2BcebuZv5kMsWV6zik';
const RANGE    = '시트1!A2:H';

module.exports = async function (req, res) {
  const url = 'https://sheets.googleapis.com/v4/spreadsheets/'
    + SHEET_ID + '/values/'
    + encodeURIComponent(RANGE) + '?key=' + API_KEY;

  try {
    const r    = await fetch(url);
    const data = await r.json();
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=60');
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
