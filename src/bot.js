require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
const { scanReceipt } = require('./gemini');
const { addTransaction } = require('./actual');
const https = require('https');

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

const pendingTransactions = {};
const editState = {};

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

function formatConfirmMessage(result) {
  const itemList = result.items?.map(i => `  • ${i.name}: Rp ${Number(i.price).toLocaleString('id-ID')}`).join('\n') || '';
  return `📄 *Struk Berhasil Dipindai!*\n\n` +
    `🏪 *Toko:* ${result.merchant}\n` +
    `📅 *Tanggal:* ${result.date}\n` +
    `💰 *Total:* Rp ${Number(result.total).toLocaleString('id-ID')}\n` +
    `🏷️ *Kategori:* ${result.category_guess}\n` +
    (itemList ? `\n*Item:*\n${itemList}\n` : '') +
    `\nTambahkan ke anggaranmu?`;
}

function confirmKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('✅ Konfirmasi', 'confirm')],
    [Markup.button.callback('✏️ Edit', 'edit')],
    [Markup.button.callback('❌ Batal', 'cancel')],
  ]);
}

function editKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('📅 Tanggal', 'edit_date')],
    [Markup.button.callback('💰 Jumlah', 'edit_amount')],
    [Markup.button.callback('🏪 Nama Toko', 'edit_merchant')],
    [Markup.button.callback('🏷️ Kategori', 'edit_category')],
    [Markup.button.callback('🔙 Kembali', 'edit_back')],
  ]);
}

function categoryKeyboard() {
  const categories = ['Makanan & Minuman', 'Belanja', 'Transportasi', 'Kesehatan', 'Hiburan', 'Tagihan', 'Lainnya'];
  return Markup.inlineKeyboard(
    categories.map(c => [Markup.button.callback(c, `set_category_${c}`)])
  );
}

// /start
bot.start((ctx) => {
  ctx.reply(
    `👋 Halo ${ctx.from.first_name}!\n\n` +
    `Aku akan membantumu mencatat pengeluaran ke Actual Budget.\n\n` +
    `Ketik /help untuk melihat semua perintah yang tersedia.\n\n` +
    `Telegram ID kamu: \`${ctx.from.id}\``,
    { parse_mode: 'Markdown' }
  );
});

// /help
bot.help((ctx) => {
  ctx.reply(
    `📖 *Daftar Perintah*\n\n` +
    `📸 *Foto Struk*\n` +
    `Kirim foto struk belanjamu dan aku akan memindainya otomatis.\n\n` +
    `✏️ */tambah [jumlah] [toko] [kategori]*\n` +
    `Tambah transaksi secara manual.\n` +
    `Contoh: \`/tambah 27000 Indomaret Belanja\`\n\n` +
    `📋 *Kategori yang tersedia:*\n` +
    `Makanan & Minuman, Belanja, Transportasi, Kesehatan, Hiburan, Tagihan, Lainnya\n\n` +
    `❓ */help*\n` +
    `Tampilkan pesan ini.\n\n` +
    `🆔 */id*\n` +
    `Tampilkan Telegram ID kamu.`,
    { parse_mode: 'Markdown' }
  );
});

// /id
bot.command('id', (ctx) => {
  ctx.reply(`🆔 Telegram ID kamu: \`${ctx.from.id}\``, { parse_mode: 'Markdown' });
});

// /tambah
bot.command('tambah', async (ctx) => {
  const telegramId = ctx.from.id.toString();
  const args = ctx.message.text.split(' ').slice(1);

  if (args.length < 2) {
    return ctx.reply(
      `❌ Format salah. Gunakan:\n\`/tambah [jumlah] [toko] [kategori]\`\n\nContoh:\n\`/tambah 27000 Indomaret Belanja\``,
      { parse_mode: 'Markdown' }
    );
  }

  const jumlah = Number(args[0].replace(/[^0-9]/g, ''));
  if (isNaN(jumlah) || jumlah <= 0) {
    return ctx.reply('❌ Jumlah tidak valid. Masukkan angka saja.\nContoh: `/tambah 27000 Indomaret Belanja`', { parse_mode: 'Markdown' });
  }

  const toko = args[1];
  const kategori = args.slice(2).join(' ') || 'Lainnya';
  const today = new Date().toISOString().split('T')[0];

  const transaction = {
    merchant: toko,
    date: today,
    total: jumlah,
    category_guess: kategori,
    telegramId,
  };

  pendingTransactions[telegramId] = transaction;

  await ctx.reply(formatConfirmMessage(transaction), {
    parse_mode: 'Markdown',
    ...confirmKeyboard(),
  });
});

// Handle photo
bot.on('photo', async (ctx) => {
  const telegramId = ctx.from.id.toString();

  try {
    await ctx.reply('🔍 Memindai struk kamu...');

    const photo = ctx.message.photo[ctx.message.photo.length - 1];
    const fileUrl = await ctx.telegram.getFileLink(photo.file_id);
    const imageBuffer = await downloadImage(fileUrl.href);

    const result = await scanReceipt(imageBuffer);

    if (result.error) {
      return ctx.reply('❌ Struk tidak dapat dibaca. Coba foto yang lebih jelas.');
    }

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
    await ctx.reply('❌ Terjadi kesalahan. Silakan coba lagi.');
  }
});

// Handle confirm
bot.action('confirm', async (ctx) => {
  const telegramId = ctx.from.id.toString();
  const transaction = pendingTransactions[telegramId];

  if (!transaction) {
    return ctx.answerCbQuery('⚠️ Tidak ada transaksi yang menunggu.');
  }

  try {
    await ctx.answerCbQuery('Menambahkan transaksi...');
    await addTransaction(telegramId, transaction);
    delete pendingTransactions[telegramId];
    delete editState[telegramId];
    await ctx.reply('✅ Transaksi berhasil ditambahkan ke anggaranmu!');
  } catch (err) {
    console.error(err);
    if (err.message === 'No budget found for this user') {
      await ctx.reply('⚠️ Telegram ID kamu belum terhubung ke anggaran manapun. Hubungi admin.');
    } else {
      await ctx.reply('❌ Gagal menambahkan transaksi. Silakan coba lagi.');
    }
  }
});

// Handle edit
bot.action('edit', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.reply('✏️ Apa yang ingin kamu ubah?', editKeyboard());
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

bot.action('edit_date', async (ctx) => {
  const telegramId = ctx.from.id.toString();
  editState[telegramId] = 'date';
  await ctx.answerCbQuery();
  await ctx.reply('📅 Masukkan tanggal yang benar (YYYY-MM-DD):\nContoh: 2026-05-14');
});

bot.action('edit_amount', async (ctx) => {
  const telegramId = ctx.from.id.toString();
  editState[telegramId] = 'amount';
  await ctx.answerCbQuery();
  await ctx.reply('💰 Masukkan jumlah yang benar (angka saja):\nContoh: 27000');
});

bot.action('edit_merchant', async (ctx) => {
  const telegramId = ctx.from.id.toString();
  editState[telegramId] = 'merchant';
  await ctx.answerCbQuery();
  await ctx.reply('🏪 Masukkan nama toko yang benar:');
});

bot.action('edit_category', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.reply('🏷️ Pilih kategori:', categoryKeyboard());
});

bot.action(/^set_category_(.+)$/, async (ctx) => {
  const telegramId = ctx.from.id.toString();
  const category = ctx.match[1];
  const transaction = pendingTransactions[telegramId];

  transaction.category_guess = category;
  pendingTransactions[telegramId] = transaction;
  delete editState[telegramId];

  await ctx.answerCbQuery(`Kategori diubah ke ${category}`);
  await ctx.reply(formatConfirmMessage(transaction), {
    parse_mode: 'Markdown',
    ...confirmKeyboard(),
  });
});

bot.on('text', async (ctx) => {
  const telegramId = ctx.from.id.toString();
  const state = editState[telegramId];
  const transaction = pendingTransactions[telegramId];

  if (!state || !transaction) return;

  const input = ctx.message.text.trim();

  if (state === 'date') {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input)) {
      return ctx.reply('❌ Format tanggal salah. Gunakan YYYY-MM-DD\nContoh: 2026-05-14');
    }
    transaction.date = input;
  } else if (state === 'amount') {
    const amount = Number(input.replace(/[^0-9]/g, ''));
    if (isNaN(amount) || amount <= 0) {
      return ctx.reply('❌ Jumlah tidak valid. Masukkan angka saja.\nContoh: 27000');
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

bot.action('cancel', async (ctx) => {
  const telegramId = ctx.from.id.toString();
  delete pendingTransactions[telegramId];
  delete editState[telegramId];
  await ctx.answerCbQuery('Dibatalkan');
  await ctx.reply('❌ Transaksi dibatalkan.');
});

bot.launch();
console.log('🤖 Bot anggaran sedang berjalan...');

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
