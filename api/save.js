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
    const { caseDbId, detailDbId, customerName, tradeType, items, notes } = req.body;

    if (!token || !caseDbId || !detailDbId || !customerName || !items) {
      return res.status(400).json({ error: '必須パラメータが不足しています' });
    }

    const notion = new Client({ auth: token });

    // 見積書番号を生成（例: TKB202501XXXXX）
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const random = Math.floor(Math.random() * 100000).toString().padStart(5, '0');
    const estimateNumber = `TKB${year}${month}${random}`;
    const caseName = `${customerName} - ${estimateNumber}`;

    // 案件管理DBのスキーマを取得してタイトルプロパティを特定
    const dbInfo = await notion.databases.retrieve({ database_id: caseDbId });
    const properties = dbInfo.properties;
    
    // タイトルプロパティを見つける
    let titlePropName = null;
    for (const [propName, propData] of Object.entries(properties)) {
      if (propData.type === 'title') {
        titlePropName = propName;
        break;
      }
    }

    // プロパティを構築
    const caseProperties = {
      '顧客名': { 
        rich_text: [{ text: { content: customerName } }] 
      },
      '取引形態': { 
        select: { name: tradeType } 
      },
      '見積書番号': {
        rich_text: [{ text: { content: estimateNumber } }]
      },
      'その他記載事項': {
        rich_text: notes ? [{ text: { content: notes } }] : []
      },
      'ステータス': {
        status: { name: '見積中' }
      }
    };

    // タイトルプロパティが見つかった場合のみ追加
    if (titlePropName) {
      caseProperties[titlePropName] = {
        title: [{ text: { content: caseName } }]
      };
    }

    // 案件を作成
    const caseResponse = await notion.pages.create({
      parent: { database_id: caseDbId },
      properties: caseProperties
    });

    const caseId = caseResponse.id;
    console.log(`案件作成成功: ${caseId}, 見積番号: ${estimateNumber}`);

    // 明細を作成（sortOrderを保存）
    for (const item of items) {
      const detailData = {
        parent: { database_id: detailDbId },
        properties: {
          '明細名': { 
            title: [{ text: { content: item.productName } }] 
          },
          '数量': { 
            number: item.quantity 
          },
          '案件': { 
            relation: [{ id: caseId }] 
          },
          '並び順': {
            number: item.sortOrder || 0
          }
        }
      };

      // 商品マスタからの商品の場合、リレーション追加
      if (item.productId) {
        detailData.properties['商品'] = {
          relation: [{ id: item.productId }]
        };
      }

      // カスタム価格がある場合
      if (item.customPrice) {
        detailData.properties['カスタム価格'] = {
          number: item.customPrice
        };
      }

      await notion.pages.create(detailData);
    }

    console.log(`明細作成成功: ${items.length}件`);

    res.status(200).json({
      success: true,
      caseId: caseId,
      estimateNumber: estimateNumber,
      message: '見積書の保存に成功しました'
    });

  } catch (error) {
    console.error('Save API Error:', error);
    res.status(500).json({
      error: error.message,
      details: error.body || error.stack
    });
  }
};
