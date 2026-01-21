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
    // 環境変数からトークンを取得
    const token = process.env.NOTION_TOKEN || req.body.token;
    const { caseDbId, detailDbId, customerName, tradeType, items } = req.body;

    if (!token || !caseDbId || !detailDbId || !customerName || !items) {
      return res.status(400).json({ error: '必須パラメータが不足しています' });
    }

    const notion = new Client({ auth: token });
    const today = new Date().toISOString().split('T')[0];

    const caseResponse = await notion.pages.create({
      parent: { database_id: caseDbId },
      properties: {
        '案件名': {
          title: [{ text: { content: `${customerName} 様_${today}` } }]
        },
        '顧客名': {
          rich_text: [{ text: { content: customerName } }]
        },
        '取引形態': {
          select: { name: tradeType }
        },
        'ステータス': {
          select: { name: '見積中' }
        }
      }
    });

    const caseId = caseResponse.id;

    const detailPromises = items.map(item => {
      return notion.pages.create({
        parent: { database_id: detailDbId },
        properties: {
          '明細名': {
            title: [{ text: { content: item.productName } }]
          },
          '案件': {
            relation: [{ id: caseId }]
          },
          '商品': {
            relation: [{ id: item.productId }]
          }
          '数量': {
            number: item.quantity
          }
        }
      });
    });

    await Promise.all(detailPromises);

    res.status(200).json({ 
      success: true, 
      caseId,
      message: '見積書を保存しました' 
    });

  } catch (error) {
    console.error('Save API Error:', error);
    res.status(500).json({ error: error.message });
  }
};
