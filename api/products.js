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
    const token = process.env.NOTION_TOKEN || req.body?.token;
    const { productDbId } = req.body || {};

    if (!token || !productDbId) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    const notion = new Client({ auth: token });

    const response = await notion.databases.query({
      database_id: productDbId
    });

    const products = response.results.map(page => {
      const props = page.properties;
      
      return {
        id: page.id,
        name: props['商品名']?.title?.[0]?.text?.content || '',
        category: props['カテゴリ']?.select?.name || '',
        priceWholesale: props['納品価格(帳合)']?.number || props['納品価格（帳合）']?.number || 0,
        priceDirect: props['納品価格(直接)']?.number || props['納品価格（直接）']?.number || 0,
        price: props['希望小売価格']?.number || 0,
        retailPrice: props['希望小売価格']?.number || 0,
        taxRate: props['消費税率']?.select?.name || '10%',
        expiryDate: props['賞味期限']?.rich_text?.[0]?.text?.content || '',
        janCode: props['JANコード']?.number?.toString() || 
                 props['JANコード']?.rich_text?.[0]?.text?.content || '',
        containerType: props['容器/形態']?.select?.name || '',
        storageMethod: props['保存方法']?.select?.name || '',
        // 新しいプロパティ（既存プロパティ名を使用）
        abv: props['ABV（％）']?.number || '',
        specification: props['規格/内容量']?.rich_text?.[0]?.text?.content || '',
        blockWeight: props['ブロック重量']?.rich_text?.[0]?.text?.content || '',
        yieldRate: props['歩留率']?.number || '',
        deliveryUnit: props['納品単位（最小）']?.rich_text?.[0]?.text?.content || ''
      };
    });

    res.status(200).json({ products });

  } catch (error) {
    console.error('Products API Error:', error);
    res.status(500).json({ 
      error: error.message,
      details: error.body || error.stack
    });
  }
};
