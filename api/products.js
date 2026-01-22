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
    const token = process.env.NOTION_TOKEN || req.body.token;
    const { productDbId } = req.body;

    if (!token || !productDbId) {
      return res.status(400).json({ error: '必須パラメータが不足しています' });
    }

    const notion = new Client({ auth: token });

    const response = await notion.databases.query({
      database_id: productDbId
    });

    console.log('Notion Response:', JSON.stringify(response.results[0], null, 2));

    const products = response.results.map(page => {
      const props = page.properties;
      
      // 安全にプロパティを取得
      const getName = () => {
        try {
          return props['商品名']?.title?.[0]?.text?.content || '';
        } catch (e) {
          console.error('商品名取得エラー:', e);
          return '';
        }
      };

      return {
        id: page.id,
        name: getName(),
        category: props['カテゴリ']?.select?.name || '',
        priceWholesale: props['納品価格（帳合）']?.number || 0,
        priceDirect: props['納品価格（直接）']?.number || 0,
        retailPrice: props['希望小売価格']?.number || 0,
        taxRate: props['消費税率']?.select?.name || '10%',
        expiryDate: props['賞味期限']?.rich_text?.[0]?.text?.content || '',
        janCode: props['JANコード']?.number?.toString() || '',
        containerType: props['容器/形態']?.select?.name || '',
        storageMethod: props['保存方法']?.select?.name || ''
      };
    });

    console.log(`商品データ取得成功: ${products.length}件`);

    res.status(200).json({ 
      success: true,
      products
    });

  } catch (error) {
    console.error('Products API Error:', error);
    res.status(500).json({ 
      error: error.message,
      details: error.body || error.stack
    });
  }
};
