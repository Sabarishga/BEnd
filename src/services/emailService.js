const axios = require('axios');
const MailComposer = require('nodemailer/lib/mail-composer');

const escapeHtml = (value = '') =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const safeUrl = (url) => (/^https?:\/\//i.test(url) ? url : '#');

let cachedToken = { value: null, expiresAt: 0 };

const getAccessToken = async () => {
  if (cachedToken.value && Date.now() < cachedToken.expiresAt - 60 * 1000) {
    return cachedToken.value;
  }

  const { data } = await axios.post(
    'https://oauth2.googleapis.com/token',
    new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
      grant_type: 'refresh_token',
    }).toString(),
    {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 15000,
    }
  );

  cachedToken = {
    value: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
  return cachedToken.value;
};

const buildRaw = (mail) =>
  new Promise((resolve, reject) => {
    new MailComposer(mail).compile().build((err, message) => {
      if (err) return reject(err);
      resolve(message.toString('base64url'));
    });
  });

const sendMail = async ({ to, subject, html, text }) => {
  const from = process.env.EMAIL_USER?.trim();
  if (
    !from ||
    !process.env.GOOGLE_CLIENT_ID ||
    !process.env.GOOGLE_CLIENT_SECRET ||
    !process.env.GOOGLE_REFRESH_TOKEN
  ) {
    throw new Error(
      'EMAIL_USER, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and GOOGLE_REFRESH_TOKEN must be set'
    );
  }

  try {
    const accessToken = await getAccessToken();
    const raw = await buildRaw({
      from: `${process.env.EMAIL_FROM_NAME || 'News Alerts'} <${from}>`,
      to,
      subject,
      text,
      html,
    });

    await axios.post(
      'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
      { raw },
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        timeout: 15000,
      }
    );
  } catch (err) {
    const e = err.response?.data;
    const detail =
      e?.error_description ||
      e?.error?.message ||
      (typeof e?.error === 'string' ? e.error : null) ||
      err.message;
    throw new Error(`Gmail API error: ${detail}`);
  }
};

const sendNewsAlertEmail = async (toEmail, articles) => {
  if (!articles || !articles.length) return;

  const listHtml = articles
    .map(
      (a) =>
        `<li><a href="${escapeHtml(safeUrl(a.url))}" target="_blank">${escapeHtml(a.title)}</a> ${
          a.category ? `<em>(${escapeHtml(a.category)})</em>` : ''
        }</li>`
    )
    .join('');

  const listText = articles
    .map((a) => `- ${a.title}${a.category ? ` (${a.category})` : ''}\n  ${a.url}`)
    .join('\n');

  try {
    await sendMail({
      to: toEmail,
      subject: 'Your News Alerts',
      html: `<h2>Latest News Updates</h2><ul>${listHtml}</ul>`,
      text: `Latest News Updates\n\n${listText}`,
    });
    console.log(`Alert email sent to ${toEmail}`);
  } catch (err) {
    console.error(`Failed to send email to ${toEmail}:`, err.message);
    throw err;
  }
};

const sendPasswordResetEmail = async (toEmail, token) => {
  const resetUrl = new URL('/reset-password', process.env.CLIENT_URL || 'http://localhost:5173');
  resetUrl.searchParams.set('email', toEmail);
  resetUrl.searchParams.set('token', token);

  await sendMail({
    to: toEmail,
    subject: 'Reset your password',
    text: `Use this link to reset your password. It expires in 1 hour: ${resetUrl.toString()}`,
    html: `<p>Use the link below to reset your password. It expires in 1 hour.</p><p><a href="${escapeHtml(resetUrl.toString())}">Reset Password</a></p>`,
  });
};

module.exports = { sendNewsAlertEmail, sendPasswordResetEmail };