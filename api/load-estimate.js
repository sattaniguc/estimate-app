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
    const { caseDbId, detailDbId, productDbId, estimateNumber } = req.body;

    if (!token || !caseDbId || !detailDbId || !estimateNumber) {
      return res.status(400).json({ error: '必須パラメータが不足しています' });
    }

    const notion = new Client({ auth: token });

    // 見積書番号で案件を検索
    const caseQuery = await notion.databases.query({
      database_id: caseDbId,
      filter: {
        property: '見積書番号',
        rich_text: {
          equals: estimateNumber
        }
      }
    });

    if (caseQuery.results.length === 0) {
      return res.status(404).json({ error: '見積書が見つかりません' });
    }

    const caseData = caseQuery.results[0];
    const caseId = caseData.id;

    // 案件情報を取得
    const customerName = caseData.properties['顧客名']?.rich_text[0]?.text?.content || '';
    const tradeType = caseData.properties['取引形態']?.select?.name || '帳合';
    const notes = caseData.properties['その他記載事項']?.rich_text[0]?.text?.content || '';
    const createdTime = new Date(caseData.created_time);

    // 案件に紐づく明細を取得
    const detailQuery = await notion.databases.query({
      database_id: detailDbId,
      filter: {
        property: '案件',
        relation: {
          contains: caseId
        }
      }
    });

    // 商品マスタを取得（価格情報のため）
    const productQuery = await notion.databases.query({
      database_id: productDbId
    });

    const products = productQuery.results.map(page => {
      const props = page.properties;
      return {
        id: page.id,
        name: props['商品名']?.title?.[0]?.text?.content || '',
        category: props['カテゴリ']?.select?.name || '',
        priceWholesale: props['納品価格(帳合)']?.number || 0,
        priceDirect: props['納品価格(直接)']?.number || 0,
        retailPrice: props['希望小売価格']?.number || 0,
        taxRate: props['消費税率']?.select?.name || '10%',
        expiryDate: props['賞味期限']?.rich_text?.[0]?.text?.content || '',
        janCode: props['JANコード']?.number?.toString() || 
                 props['JANコード']?.rich_text?.[0]?.text?.content || '',
        containerType: props['容器/形態']?.select?.name || '',
        storageMethod: props['保存方法']?.select?.name || ''
      };
    });

    // 明細から商品リストと数量を復元
    const items = {};
    const customPrices = {};
    const customProducts = [];

    for (const detail of detailQuery.results) {
      const props = detail.properties;
      const productName = props['明細名']?.title[0]?.text?.content || '';
      const quantity = props['数量']?.number || 0;
      const productRelation = props['商品']?.relation[0]?.id;

      if (productRelation) {
        // 既存商品
        items[productRelation] = quantity;
      } else {
        // カスタム商品
        const customId = `custom_${Date.now()}_${Math.random()}`;
        const customProduct = {
          id: customId,
          name: productName,
          price: 0, // カスタム価格は明細に保存されていないため0
          quantity: quantity,
          expiryDate: '',
          janCode: '',
          taxRate: '10%'
        };
        customProducts.push(customProduct);
        items[customId] = quantity;
      }
    }

    const estimateData = {
      customerName,
      tradeType,
      showRetailPrice: false, // デフォルト値
      notes,
      items,
      customPrices,
      customProducts
    };

    res.status(200).json({
      success: true,
      estimateNumber,
      caseId,
      createdDate: createdTime,
      estimateData,
      products
    });

  } catch (error) {
    console.error('Load Estimate API Error:', error);
    res.status(500).json({ 
      error: error.message,
      details: error.body || error.stack
    });
  }
};
