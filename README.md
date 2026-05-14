# actual_bot

A Telegram bot that integrates with [Actual Budget](https://actualbudget.org/) for personal expense tracking. Supports receipt scanning via Google Gemini Vision and manual transaction entry.

## Features

- Scan receipts by sending a photo to the bot
- Manual transaction entry via `/tambah` command
- Edit scanned data before confirming
- Multi-user support with separate budgets per Telegram ID
- Auto-deploy via GitHub Actions on every push

## Architecture

Telegram → Bot (Node.js) → Gemini Vision API → Actual Budget API → SQLite

## Tech Stack

- **Runtime:** Node.js 22
- **Bot framework:** Telegraf
- **OCR:** Google Gemini 3.1 Flash Lite
- **Budget:** Actual Budget (self-hosted)
- **Containerization:** Docker + Docker Compose
- **CI/CD:** GitHub Actions + AWS EC2

## Requirements

- Docker & Docker Compose
- Telegram Bot Token (via [@BotFather](https://t.me/botfather))
- Google Gemini API Key (via [Google AI Studio](https://aistudio.google.com))
- Actual Budget server (self-hosted)

## 

## Installation

### 1. Clone the repository

```bash
git clone https://github.com/ryuushiro/actual_bot.git
cd actual_bot
```

### 2. Configure environment variables

```bash
cp .env.example .env
```

Edit `.env` with your values:

```env
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
GEMINI_API_KEY=your_gemini_api_key
ACTUAL_SERVER_URL=http://actual:5006
ACTUAL_PASSWORD=your_actual_password
USER_BUDGETS={"telegram_id":"actual_sync_id"}
```

`USER_BUDGETS` is a JSON map of Telegram user ID to Actual Budget sync ID. To get your Telegram ID, send `/id` to the bot after it is running. To get the Actual sync ID, go to **Settings → Advanced → Sync ID** in the Actual web UI.

### 3. Run

```bash
docker compose up -d
```

Actual Budget will be available at `http://localhost:5006` on first run. Set a password and create a budget, then update `USER_BUDGETS` in `.env` with the sync ID.

Restart after updating `.env`:

```bash
docker compose down && docker compose up -d
```

## Bot Commands

| Command                              | Description                |
| ------------------------------------ | -------------------------- |
| `/start`                             | Welcome message            |
| `/help`                              | List all commands          |
| `/id`                                | Show your Telegram ID      |
| `/tambah [jumlah] [toko] [kategori]` | Add a transaction manually |

### Available categories for `/tambah`

`Makanan & Minuman`, `Belanja`, `Transportasi`, `Kesehatan`, `Hiburan`, `Tagihan`, `Lainnya`

### Example

```
/tambah 27000 Indomaret Belanja
```

It'll add expenses of Rp 27000, from "Shopping" in Indomaret.

 

## CI/CD

The pipeline runs on every push to `main`. It fetches the EC2 public IP dynamically via AWS CLI, SSHs into the server, pulls the latest code, and rebuilds the containers.

Required GitHub Actions secrets:

| Secret                  | Description                        |
| ----------------------- | ---------------------------------- |
| `AWS_ACCESS_KEY_ID`     | AWS IAM access key                 |
| `AWS_SECRET_ACCESS_KEY` | AWS IAM secret key                 |
| `AWS_REGION`            | AWS region (e.g. `ap-southeast-3`) |
| `EC2_INSTANCE_ID`       | EC2 instance ID                    |
| `EC2_USER`              | SSH user (e.g. `ubuntu`)           |
| `EC2_SSH_KEY`           | Private SSH key contents           |

## License

MIT
EOF


1~# actual_bot

A Telegram bot that integrates with [Actual Budget](https://actualbudget.org/) for personal expense tracking. Supports receipt scanning via Google Gemini Vision and manual transaction entry.

## Features

- Scan receipts by sending a photo to the bot
- Manual transaction entry via `/tambah` command
- Edit scanned data before confirming
- Multi-user support with separate budgets per Telegram ID
- Auto-deploy via GitHub Actions on every push

## Architecture

Telegram → Bot (Node.js) → Gemini Vision API → Actual Budget API → SQLite

## Tech Stack

- **Runtime:** Node.js 22
- **Bot framework:** Telegraf
- **OCR:** Google Gemini 3.1 Flash Lite
- **Budget:** Actual Budget (self-hosted)
- **Containerization:** Docker + Docker Compose
- **CI/CD:** GitHub Actions + AWS EC2

## Requirements

- Docker & Docker Compose
- Telegram Bot Token (via [@BotFather](https://t.me/botfather))
- Google Gemini API Key (via [Google AI Studio](https://aistudio.google.com))
- Actual Budget server (self-hosted)

## 

## Installation

### 1. Clone the repository

```bash
git clone https://github.com/ryuushiro/actual_bot.git
cd actual_bot
```

### 2. Configure environment variables

```bash
cp .env.example .env
```

Edit `.env` with your values:

```env
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
GEMINI_API_KEY=your_gemini_api_key
ACTUAL_SERVER_URL=http://actual:5006
ACTUAL_PASSWORD=your_actual_password
USER_BUDGETS={"telegram_id":"actual_sync_id"}
```

`USER_BUDGETS` is a JSON map of Telegram user ID to Actual Budget sync ID. To get your Telegram ID, send `/id` to the bot after it is running. To get the Actual sync ID, go to **Settings → Advanced → Sync ID** in the Actual web UI.

### 3. Run

```bash
docker compose up -d
```

Actual Budget will be available at `http://localhost:5006` on first run. Set a password and create a budget, then update `USER_BUDGETS` in `.env` with the sync ID.

Restart after updating `.env`:

```bash
docker compose down && docker compose up -d
```

## Bot Commands

| Command                              | Description                |
| ------------------------------------ | -------------------------- |
| `/start`                             | Welcome message            |
| `/help`                              | List all commands          |
| `/id`                                | Show your Telegram ID      |
| `/tambah [jumlah] [toko] [kategori]` | Add a transaction manually |

### Available categories for `/tambah`

`Makanan & Minuman`, `Belanja`, `Transportasi`, `Kesehatan`, `Hiburan`, `Tagihan`, `Lainnya`

### Example

```
/tambah 27000 Indomaret Belanja
```

It'll add expenses of Rp 27000, from "Shopping" in Indomaret.

 

## CI/CD

The pipeline runs on every push to `main`. It fetches the EC2 public IP dynamically via AWS CLI, SSHs into the server, pulls the latest code, and rebuilds the containers.

Required GitHub Actions secrets:

| Secret                  | Description                        |
| ----------------------- | ---------------------------------- |
| `AWS_ACCESS_KEY_ID`     | AWS IAM access key                 |
| `AWS_SECRET_ACCESS_KEY` | AWS IAM secret key                 |
| `AWS_REGION`            | AWS region (e.g. `ap-southeast-3`) |
| `EC2_INSTANCE_ID`       | EC2 instance ID                    |
| `EC2_USER`              | SSH user (e.g. `ubuntu`)           |
| `EC2_SSH_KEY`           | Private SSH key contents           |

## License

MIT
EOF



