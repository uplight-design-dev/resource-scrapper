const generateJSON = require('../scripts/generate-json');

module.exports = async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const jsonData = await generateJSON();
    res.status(200).json(jsonData);
  } catch (error) {
    console.error('Error generating JSON:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

