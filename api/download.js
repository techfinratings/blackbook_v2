const crypto = require('crypto');

const SA_EMAIL    = 'blackbook-sheets@blackbook-497708.iam.gserviceaccount.com';
const PRIVATE_KEY = "-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQDKQxFzrWQREBTX\nA1mwgyplUHPYGwSdL9ZF7gLBiDNzvS0fdHXKGfK+38QiwzG6xv7/yPelen8qBiga\nO4C5i2c9lF2+mKLdAQnxmTPT/hCUSfNdmbfK1Ee7F9B4vqckqR8S75wC/DJ9NNS6\nlwmNi50g9OZhV9fksa0QvRuhFV4gHsoMh9TPolIwNw9hrVxS9D6lszDdCZuRlPMk\n0NH7K0gjXqzBNlrKAJniAnQu6nalFyB7E1YOK99JwniC1ljw/luTx9Y5baYkn0W2\nuEJBtvCbqDRXFQZrSUff22YYLRXtN9FfDUt9vyU0dsaYlqLT73qRtLuWzwkipJmC\nx3FVvGVvAgMBAAECggEARfjy4iqDmlWOaB4cGrEd6yPsl8AtFfYVMmcXY/2rEyjI\nof+nuk3EyVzfXUla/GtYj4PmjMR2lsK/f+fC7i24fzjDP6tNeJih6IegQwA7mxmE\nTIbf6xcKY8Lm18bZSxkJC4OCXRQDoYYz7ANRhjrdFqgyxU1e/pqrLUXG97DNOd3f\nhabfruoxV1CkSSHJs2oHPM4BiSyR5GFFYNMqDVR6QErZHMdz7qUASOtnXVk64290\nsWzGTXqD7evfiVTYFCy3DCFTLCJtMfsk0xwaN9J8JI4zQgGrxEdpj+ChBghk1fLM\nh1DD5cpbmTY1HASBPGndVRacYY0kE61goHV2VRr06QKBgQDkG/sWJZagk73d3dw7\nLKFMadx/J2hKiT17iL6HBzNLpx4EU9VD8GlfS6CiLwihOGZvqUUhed5Mvv8mdd9R\nXevvjHEKt3Jx/smmhUWFuarQAjh6OCtwpXQtN0xILJiH5n00BOXFr4zrUrkrXR53\nkb2IN3YILniS4JAjhAzBS5kdeQKBgQDi/gtA3Zdp/D7j3ig1jmjSPICIYbIbFuIG\nQB2HZ/2/4HGrIr5dExYadY0AFmD7OcY0ZEloKQzDDL/nx/XG+6ARVuMXKjsBsa2N\nMS2S9rRgyhkByhUWReJRD9Ztee31yHNlRefquFPv8MV9WmxIOLFCCnB0tKS8oIO1\ntSHS7b4oJwKBgQC3lAk7pp6VtrEcCHxAJ0fcnmm073sQWWjgrYlgVBwlK2aN5wYA\nek/jQJMTUzTnwuM1xA19xn1wWFoxkrVZ33OMwwMKs95n/bw9xo3P9D+Szeaz/dZ/\n/rgD17gNcc6DuKxUnAhrUz/e9yFM09E8O09EfBYCuZuR4SY/XvuA6J1eSQKBgGeK\nRgvSiCyaGP3L6j9ztDCh1GdhWOKub282c8G+F6scb/0GHhtKh3yOPkDZ9GbkFZr0\nW9+dSer2t9q8BUo8oOkH3xJD+yJsr6OF2Sn+So0T4pBEY5YDTpZ3SPIq+fZw9uIt\nHvqcFf2OsCbbxiSzZ3eeV2mEtNgtx6Zs9v7F30VlAoGBAKHB+TIn4GoSEwn9hABs\n8JguSdsJk7cE2mQ5DQFJcXoVRlzNdph/zTQl2BDkudWIRNRBxxcNmISS/XJDnC6p\n8Ej+OVWIAO+IDOnLlondB7nr8pga3Bo1y+idViXZWx7DhPgIarHDBS7+kvZHtDs9\n3MSzv9j/m8L/Dme7C2x6ui/h\n-----END PRIVATE KEY-----\n";
const SHEET_ID    = '1gsjz9DXDHaFgGTOrx42i6_XEgqETq_n1db3zO6ZMH6Y';

async function getAccessToken() {
  const now     = Math.floor(Date.now() / 1000);
  const header  = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    iss: SA_EMAIL,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  })).toString('base64url');

  const toSign = `${header}.${payload}`;
  const sign   = crypto.createSign('RSA-SHA256');
  sign.update(toSign);
  const jwt = `${toSign}.${sign.sign(PRIVATE_KEY, 'base64url')}`;

  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  });
  const data = await r.json();
  if (!data.access_token) throw new Error(JSON.stringify(data));
  return data.access_token;
}

module.exports = async function (req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { row } = req.body || {};
  if (!row) return res.status(400).json({ error: 'row required' });

  try {
    const token   = await getAccessToken();
    const range   = `시트1!I${row}`;
    const baseUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(range)}`;

    const readData = await (await fetch(baseUrl, {
      headers: { Authorization: `Bearer ${token}` },
    })).json();
    const current = parseInt(readData.values?.[0]?.[0] || '0', 10);

    await fetch(`${baseUrl}?valueInputOption=RAW`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ values: [[current + 1]] }),
    });

    res.status(200).json({ count: current + 1 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
