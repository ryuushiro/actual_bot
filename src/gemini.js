const { GoogleGenAI } = require('@google/genai');

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function scanReceipt(imageBuffer) {
  const model = 'gemini-3.1-flash-lite';

  const response = await ai.models.generateContent({
    model,
    contents: [
      {
        parts: [
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: imageBuffer.toString('base64'),
            },
          },
          {
            text: `Analyze this receipt image and extract the information in JSON format only, no markdown, no explanation:
{
  "merchant": "store name",
  "date": "YYYY-MM-DD",
  "total": 0000,
  "currency": "IDR",
  "items": [
    { "name": "item name", "price": 0000 }
  ],
  "category_guess": "one of: Food & Drink, Groceries, Transport, Shopping, Health, Entertainment, Bills, Other"
}
If you cannot read the receipt clearly, return { "error": "cannot read receipt" }`,
          },
        ],
      },
    ],
  });

  const text = response.text.trim();
  return JSON.parse(text);
}

module.exports = { scanReceipt };
