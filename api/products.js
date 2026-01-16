const { Client } = require('@notionhq/client');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    const { token, productDbId } = req.body;

    if (!token || !productDbId) {
      return res.status(400).json({ error: 'トークンまたはDB IDが不足しています' });
    }

    const notion = new Client({ auth: token });

    const response = await notion.databases.query({
      database_id: productDbId
    });

    const products = response.results.map(page => {
      const props = page.properties;
      return {
        id: page.id,
        name: props['商品名']?.title?.[0]?.text?.content || '商品名なし',
        category: props['カテゴリ']?.select?.name || 'その他',
        priceWholesale: props['納品価格（帳合）']?.number || 0,
        priceDirect: props['納品価格（直接）']?.number || 0,
        taxRate: props['消費税率']?.select?.name || '10%'
      };
    });

    res.status(200).json({ products });
  } catch (error) {
    console.error('Products API Error:', error);
    res.status(500).json({ error: error.message });
  }
};
