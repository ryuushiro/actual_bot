require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
const { scanReceipt } = require('./gemini');
const { addTransaction } = require('./actual');
const https = require('https');

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

// Temporary storage for pending transactions and edit state
const pendingTransactions = {};
const editState = {};

// Download image from Telegram
async function downloadImage(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    });
  });
}

// Format confirmation message
function formatConfirmMessage(result) {
  const itemList = result.items?.map(i => `  • ${i.name}: Rp ${Number(i.price).toLocaleString('id-ID')}`).join('\n') || '';
  return `📄 *Receipt Scanned!*\n\n` +
    `🏪 *Merchant:* ${result.merchant}\n` +
    `📅 *Date:* ${result.date}\n` +
    `💰 *Total:* Rp ${Number(result.total).toLocaleString('id-ID')}\n` +
    `🏷️ *Category:* ${result.category_guess}\n` +
    (itemList ? `\n*Items:*\n${itemList}\n` : '') +
    `\nAdd this to your budget?`;
}

// Confirmation keyboard
function confirmKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('✅ Confirm', 'confirm')],
    [Markup.button.callback('✏️ Edit', 'edit')],
    [Markup.button.callback('❌ Cancel', 'cancel')],
  ]);
}

// Edit field keyboard
function editKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('📅 Date', 'edit_date')],
    [Markup.button.callback('💰 Amount', 'edit_amount')],
    [Markup.button.callback('🏪 Merchant', 'edit_merchant')],
    [Markup.button.callback('🏷️ Category', 'edit_category')],
    [Markup.button.callback('🔙 Back', 'edit_back')],
  ]);
}

// Category keyboard
function categoryKeyboard() {
  const categories = ['Food & Drink', 'Groceries', 'Transport', 'Shopping', 'Health', 'Entertainment', 'Bills', 'Other'];
  return Markup.inlineKeyboard(
    categories.map(c => [Markup.button.callback(c, `set_category_${c}`)])
  );
}

// Handle photo messages
bot.on('photo', async (ctx) => {
  const telegramId = ctx.from.id.toString();

  try {
    await ctx.reply('🔍 Scanning your receipt...');

    const photo = ctx.message.photo[ctx.message.photo.length - 1];
    const fileUrl = await ctx.telegram.getFileLink(photo.file_id);
    const imageBuffer = await downloadImage(fileUrl.href);

    const result = await scanReceipt(imageBuffer);

    if (result.error) {
      return ctx.reply('❌ Could not read the receipt. Please try a clearer photo.');
    }

    // Default date to today if receipt date seems old (over 30 days)
    const receiptDate = new Date(result.date);
    const today = new Date();
    const diffDays = (today - receiptDate) / (1000 * 60 * 60 * 24);
    if (diffDays > 30) {
      result.date = today.toISOString().split('T')[0];
    }

    pendingTransactions[telegramId] = { ...result, telegramId };

    await ctx.reply(formatConfirmMessage(result), {
      parse_mode: 'Markdown',
      ...confirmKeyboard(),
    });

  } catch (err) {
    console.error(err);
    await ctx.reply('❌ Something went wrong. Please try again.');
  }
});

// Handle confirm
bot.action('confirm', async (ctx) => {
  const telegramId = ctx.from.id.toString();
  const transaction = pendingTransactions[telegramId];

  if (!transaction) {
    return ctx.answerCbQuery('⚠️ No pending transaction found.');
  }

  try {
    await ctx.answerCbQuery('Adding transaction...');
    await addTransaction(telegramId, transaction);
    delete pendingTransactions[telegramId];
    delete editState[telegramId];
    await ctx.reply('✅ Transaction added to your budget!');
  } catch (err) {
    console.error(err);
    if (err.message === 'No budget found for this user') {
      await ctx.reply('⚠️ Your Telegram ID is not linked to any budget. Please contact the admin.');
    } else {
      await ctx.reply('❌ Failed to add transaction. Please try again.');
    }
  }
});

// Handle edit
bot.action('edit', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.reply('✏️ What would you like to edit?', editKeyboard());
});

// Handle back
bot.action('edit_back', async (ctx) => {
  const telegramId = ctx.from.id.toString();
  const transaction = pendingTransactions[telegramId];
  delete editState[telegramId];
  await ctx.answerCbQuery();
  await ctx.reply(formatConfirmMessage(transaction), {
    parse_mode: 'Markdown',
    ...confirmKeyboard(),
  });
});

// Handle edit fields
bot.action('edit_date', async (ctx) => {
  const telegramId = ctx.from.id.toString();
  editState[telegramId] = 'date';
  await ctx.answerCbQuery();
  await ctx.reply('📅 Enter the new date (YYYY-MM-DD):\nExample: 2026-05-14');
});

bot.action('edit_amount', async (ctx) => {
  const telegramId = ctx.from.id.toString();
  editState[telegramId] = 'amount';
  await ctx.answerCbQuery();
  await ctx.reply('💰 Enter the correct amount (numbers only):\nExample: 27000');
});

bot.action('edit_merchant', async (ctx) => {
  const telegramId = ctx.from.id.toString();
  editState[telegramId] = 'merchant';
  await ctx.answerCbQuery();
  await ctx.reply('🏪 Enter the correct merchant name:');
});

bot.action('edit_category', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.reply('🏷️ Select a category:', categoryKeyboard());
});

// Handle category selection
bot.action(/^set_category_(.+)$/, async (ctx) => {
  const telegramId = ctx.from.id.toString();
  const category = ctx.match[1];
  const transaction = pendingTransactions[telegramId];

  transaction.category_guess = category;
  pendingTransactions[telegramId] = transaction;
  delete editState[telegramId];

  await ctx.answerCbQuery(`Category set to ${category}`);
  await ctx.reply(formatConfirmMessage(transaction), {
    parse_mode: 'Markdown',
    ...confirmKeyboard(),
  });
});

// Handle text input for edits
bot.on('text', async (ctx) => {
  const telegramId = ctx.from.id.toString();
  const state = editState[telegramId];
  const transaction = pendingTransactions[telegramId];

  if (!state || !transaction) return;

  const input = ctx.message.text.trim();

  if (state === 'date') {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input)) {
      return ctx.reply('❌ Invalid date format. Please use YYYY-MM-DD\nExample: 2026-05-14');
    }
    transaction.date = input;
  } else if (state === 'amount') {
    const amount = Number(input.replace(/[^0-9]/g, ''));
    if (isNaN(amount) || amount <= 0) {
      return ctx.reply('❌ Invalid amount. Please enter numbers only.\nExample: 27000');
    }
    transaction.total = amount;
  } else if (state === 'merchant') {
    transaction.merchant = input;
  }

  pendingTransactions[telegramId] = transaction;
  delete editState[telegramId];

  await ctx.reply(formatConfirmMessage(transaction), {
    parse_mode: 'Markdown',
    ...confirmKeyboard(),
  });
});

// Handle cancel
bot.action('cancel', async (ctx) => {
  const telegramId = ctx.from.id.toString();
  delete pendingTransactions[telegramId];
  delete editState[telegramId];
  await ctx.answerCbQuery('Cancelled');
  await ctx.reply('❌ Transaction cancelled.');
});

// Start command
bot.start((ctx) => {
  ctx.reply(
    `👋 Hello ${ctx.from.first_name}!\n\n` +
    `Send me a photo of your receipt and I'll add it to your Actual Budget automatically.\n\n` +
    `Your Telegram ID is: \`${ctx.from.id}\``,
    { parse_mode: 'Markdown' }
  );
});

bot.launch();
console.log('🤖 Budget bot is running...');

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
