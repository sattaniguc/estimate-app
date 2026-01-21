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
    const { caseDbId, detailDbId, customerName, tradeType, items } = req.body;

    if (!token || !caseDbId || !detailDbId || !customerName || !items) {
      return res.status(400).json({ error: '必須パラメータが不足しています' });
    }

    const notion = new Client({ auth: token });
    const today = new Date().toISOString().split('T')[0];

    // 案件を作成
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
    console.log('案件作成成功:', caseId);

    // 案件明細を一括作成
    const detailPromises = items.map((item, index) => {
      console.log(`明細${index + 1}:`, {
        productId: item.productId,
        productName: item.productName,
        quantity: item.quantity
      });

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
          },
          '数量': {
            number: item.quantity
          }
        }
      }).then(result => {
        console.log(`明細${index + 1}作成成功`);
        return result;
      }).catch(error => {
        console.error(`明細${index + 1}作成失敗:`, error.message);
        throw error;
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
    res.status(500).json({ 
      error: error.message,
      details: error.body || error.stack
    });
  }
};
