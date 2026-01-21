const { Client } = require('@notionhq/client');

// 見積書番号を生成（TKB + YYYYMM + 5桁ランダム）
function generateEstimateNumber() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const random = Math.floor(Math.random() * 100000).toString().padStart(5, '0');
  return `TKB${year}${month}${random}`;
}

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
    const { caseDbId, detailDbId, customerName, tradeType, items, notes, estimateUrl } = req.body;

    if (!token || !caseDbId || !detailDbId || !customerName || !items) {
      return res.status(400).json({ error: '必須パラメータが不足しています' });
    }

    const notion = new Client({ auth: token });
    const today = new Date().toISOString().split('T')[0];
    const estimateNumber = generateEstimateNumber();

    // 案件を作成
    const caseProperties = {
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
    };

    // 見積書番号を追加
    if (estimateNumber) {
      caseProperties['見積書番号'] = {
        rich_text: [{ text: { content: estimateNumber } }]
      };
    }

    // 見積書URLを追加
    if (estimateUrl) {
      caseProperties['見積書URL'] = {
        url: estimateUrl
      };
    }

    // その他記載事項を追加
    if (notes) {
      caseProperties['その他記載事項'] = {
        rich_text: [{ text: { content: notes } }]
      };
    }

    const caseResponse = await notion.pages.create({
      parent: { database_id: caseDbId },
      properties: caseProperties
    });

    const caseId = caseResponse.id;
    console.log('案件作成成功:', caseId, '見積番号:', estimateNumber);

    // 案件明細を一括作成
    const detailPromises = items.map((item, index) => {
      console.log(`明細${index + 1}:`, {
        productId: item.productId,
        productName: item.productName,
        quantity: item.quantity,
        customPrice: item.customPrice
      });

      const detailProperties = {
        '明細名': {
          title: [{ text: { content: item.productName } }]
        },
        '案件': {
          relation: [{ id: caseId }]
        },
        '数量': {
          number: item.quantity
        }
      };

      // 商品マスタのIDがある場合はリレーション設定
      if (item.productId) {
        detailProperties['商品'] = {
          relation: [{ id: item.productId }]
        };
      }

      return notion.pages.create({
        parent: { database_id: detailDbId },
        properties: detailProperties
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
      estimateNumber,
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
