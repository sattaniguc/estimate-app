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
    const { caseId, estimateUrl } = req.body;

    if (!token || !caseId || !estimateUrl) {
      return res.status(400).json({ error: '必須パラメータが不足しています' });
    }

    const notion = new Client({ auth: token });

    // 案件の見積書URLを更新
    await notion.pages.update({
      page_id: caseId,
      properties: {
        '見積書URL': {
          url: estimateUrl
        }
      }
    });

    console.log('見積書URL更新成功:', caseId);

    res.status(200).json({ 
      success: true,
      message: '見積書URLを更新しました' 
    });

  } catch (error) {
    console.error('Update Estimate URL API Error:', error);
    res.status(500).json({ 
      error: error.message,
      details: error.body || error.stack
    });
  }
};
