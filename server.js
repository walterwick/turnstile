import express from 'express';
import multer from 'multer';
import fetch from 'node-fetch';
import path from 'path';
import FormData from 'form-data';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

const TELEGRAM_BOT_TOKEN = '6435977146:AAExFsusLAtoivKFKW01Ca1hCsQOVIf2H7I';
const TELEGRAM_CHAT_ID = '2090459804';
const TURNSTILE_SECRET_KEY = '0x4AAAAAAAK6BS4HjRMNopZfG5kNBpfkAjI';

const upload = multer();

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static('public'));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

async function verifyTurnstile(token) {
  try {
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        secret: TURNSTILE_SECRET_KEY,
        response: token,
      }),
    });

    const data = await response.json();
    if (!data.success) {
      console.error('Turnstile verification failed:', data['error-codes']);
    }
    return data.success;
  } catch (error) {
    console.error('Turnstile verification error:', error);
    return false;
  }
}

async function sendTelegramMessage(text) {
  try {
    const response = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: TELEGRAM_CHAT_ID,
          text: text,
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Telegram API Error:', errorData);
      throw new Error('Failed to send message to Telegram');
    }
    return response.json();
  } catch (error) {
    console.error('Error sending Telegram message:', error);
    throw error;
  }
}

async function sendTelegramDocument(formData) {
  try {
    const response = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendDocument?chat_id=${TELEGRAM_CHAT_ID}`,
      {
        method: 'POST',
        body: formData,
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Telegram API Document Error:', errorData);
      throw new Error('Failed to send document to Telegram');
    }
    return response.json();
  } catch (error) {
    console.error('Error sending Telegram document:', error);
    throw error;
  }
}

app.post('/api/submit', upload.single('attachment'), async (req, res) => {
  try {
    const turnstileToken = req.body.cfTurnstileResponse;
    if (!turnstileToken) {
      return res.status(400).json({ success: false, message: 'Turnstile token is required' });
    }

    const isVerified = await verifyTurnstile(turnstileToken);
    if (!isVerified) {
      return res.status(400).json({ success: false, message: 'Turnstile verification failed' });
    }

    const { name, email, subject, message } = req.body;

    if (!name || !email || !subject || !message) {
      return res.status(400).json({ success: false, message: 'All fields are required' });
    }

    const messageText = `Yeni iletişim mesajı:\n\nAd Soyad: ${name}\nE-posta: ${email}\nKonu: ${subject}\nMesaj: ${message}`;

    if (req.file) {
      const formData = new FormData();
      formData.append('document', req.file.buffer, {
        filename: req.file.originalname,
        contentType: req.file.mimetype,
      });
      formData.append('caption', messageText);
      await sendTelegramDocument(formData);
    } else {
      await sendTelegramMessage(messageText);
    }

    res.json({ success: true, message: 'Message sent successfully' });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ success: false, message: 'Failed to send message' });
  }
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
