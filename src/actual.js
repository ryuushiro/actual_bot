const actual = require('@actual-app/api');
const fs = require('fs');

const ACTUAL_SERVER_URL = process.env.ACTUAL_SERVER_URL;
const ACTUAL_PASSWORD = process.env.ACTUAL_PASSWORD;

// Map of Telegram ID -> Actual Budget ID
const USER_BUDGETS = JSON.parse(process.env.USER_BUDGETS || '{}');

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
  const category = categories.find(c =>
    c.name.toLowerCase().includes(category_guess.toLowerCase())
  ) || categories[0];

  await actual.addTransactions(account.id, [
    {
      date: date || new Date().toISOString().split('T')[0],
      amount: -Math.abs(total * 100),
      payee_name: merchant,
      category: category?.id,
      notes: `Added via Telegram bot`,
    },
  ]);

  await actual.shutdown();
}

async function getBudgets() {
  return USER_BUDGETS;
}

module.exports = { addTransaction, getBudgets };
