const actual = require('@actual-app/api');
const fs = require('fs');

const ACTUAL_SERVER_URL = process.env.ACTUAL_SERVER_URL;
const ACTUAL_PASSWORD = process.env.ACTUAL_PASSWORD;

const USER_BUDGETS = JSON.parse(process.env.USER_BUDGETS || '{}');

const categoryMap = {
  'Makanan & Minuman': 'Food & Drink',
  'Belanja': 'Shopping',
  'Transportasi': 'Transport',
  'Kesehatan': 'Health',
  'Hiburan': 'Entertainment',
  'Tagihan': 'Bills',
  'Lainnya': 'Other',
};

async function addTransaction(telegramId, { merchant, date, total, category_guess }) {
  const budgetId = USER_BUDGETS[telegramId];
  if (!budgetId) throw new Error('No budget found for this user');

  if (!fs.existsSync('./actual-data')) fs.mkdirSync('./actual-data');

  await actual.init({
    dataDir: './actual-data',
    serverURL: ACTUAL_SERVER_URL,
    password: ACTUAL_PASSWORD,
  });

  await actual.downloadBudget(budgetId);

  const accounts = await actual.getAccounts();
  const account = accounts[0];

  const categories = await actual.getCategories();

  // Translate Bahasa category to English first
  const englishCategory = categoryMap[category_guess] || category_guess;

  const category = categories.find(c =>
    c.name.toLowerCase().includes(englishCategory.toLowerCase())
  ) || categories[0];

  await actual.addTransactions(account.id, [
    {
      date: date || new Date().toISOString().split('T')[0],
      amount: -Math.abs(total * 100),
      payee_name: merchant,
      category: category?.id,
      notes: `Ditambahkan via Telegram bot`,
    },
  ]);

  await actual.shutdown();
}

module.exports = { addTransaction };
