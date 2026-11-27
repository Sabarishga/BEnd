const axios = require('axios');
const nodemailer = require('nodemailer');
const MailComposer = require('nodemailer/lib/mail-composer');
const AppError = require('../utils/AppError');
const { env } = require('../config/env');

const escapeHtml = (value = '') =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const safeUrl = (url) => (/^https?:\/\//i.test(url || '') ? url : '#');

const getTransport = () => {
  const user = process.env.EMAIL_USER?.trim();
  if (!user) return { type: 'none', reason: 'EMAIL_USER is not set' };
  if (
    process.env.GOOGLE_CLIENT_ID &&
    process.env.GOOGLE_CLIENT_SECRET &&
    process.env.GOOGLE_REFRESH_TOKEN
  ) {
    return { type: 'gmail-api', user };
  }
  if (process.env.EMAIL_PASS) return { type: 'smtp', user };
  return {
    type: 'none',
    reason: 'Set GOOGLE_CLIENT_ID/SECRET/REFRESH_TOKEN (Gmail API) or EMAIL_PASS (SMTP)',
  };
};

/* Gmail API */

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
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 15000 }
  );
  cachedToken = { value: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return cachedToken.value;
};

const buildRaw = (mail) =>
  new Promise((resolve, reject) => {
    new MailComposer(mail).compile().build((err, message) => {
      if (err) return reject(err);
      return resolve(message.toString('base64url'));
    });
  });

const sendWithGmailApi = async (mail) => {
  const accessToken = await getAccessToken();
  const raw = await buildRaw(mail);
  await axios.post(
    'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
    { raw },
    { headers: { Authorization: `Bearer ${accessToken}` }, timeout: 15000 }
  );
};

/*  SMTP  */

let smtpTransporter = null;

const getSmtpTransporter = () => {
  if (!smtpTransporter) {
    smtpTransporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: process.env.EMAIL_USER.trim(), pass: process.env.EMAIL_PASS },
      connectionTimeout: 15000,
    });
  }
  return smtpTransporter;
};

const sendWithSmtp = (mail) => getSmtpTransporter().sendMail(mail);

/*  Public API  */

const describeError = (err) => {
  const e = err.response?.data;
  return (
    e?.error_description ||
    e?.error?.message ||
    (typeof e?.error === 'string' ? e.error : null) ||
    err.message
  );
};

const sendMail = async ({ to, subject, html, text }) => {
  const transport = getTransport();
  if (transport.type === 'none') {
    console.error(`[email] not configured: ${transport.reason}`);
    throw AppError.unavailable('Email is not configured on the server yet.');
  }

  const mail = {
    from: `${process.env.EMAIL_FROM_NAME || 'News Alerts'} <${transport.user}>`,
    to,
    subject,
    text,
    html,
  };

  try {
    if (transport.type === 'gmail-api') await sendWithGmailApi(mail);
    else await sendWithSmtp(mail);
  } catch (err) {
    const detail = describeError(err);
    console.error(`[email] ${transport.type} send to ${to} failed: ${detail}`);
    if (/invalid_grant/i.test(detail)) {
      console.error(
        '[email] The Google refresh token was rejected. If the OAuth app is in "Testing", tokens ' +
          'expire after 7 days: publish the app and create a new refresh token (see README).'
      );
    }
    throw new AppError(502, 'We could not send the email right now. Please try again later.');
  }
};

/** Called once at startup so email problems show up in the logs immediately. */
const verifyEmailSetup = async () => {
  const transport = getTransport();
  if (transport.type === 'none') {
    console.warn(`[email] NOT configured (${transport.reason}). Alerts and reset emails will fail.`);
    return transport;
  }
  try {
    if (transport.type === 'gmail-api') await getAccessToken();
    else await getSmtpTransporter().verify();
    console.log(`[email] ready (${transport.type}, sending as ${transport.user})`);
    return { ...transport, ok: true };
  } catch (err) {
    console.error(`[email] ${transport.type} check FAILED: ${describeError(err)}`);
    return { ...transport, ok: false };
  }
};

const layout = (title, body) => `
<div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;color:#0f172a">
  <h2 style="font-family:Georgia,serif;margin:0 0 16px">${escapeHtml(title)}</h2>
  ${body}
  <p style="margin-top:24px;font-size:12px;color:#64748b">
    You are receiving this because you subscribed to Real-Time News Alerts.
    <a href="${escapeHtml(env.primaryClientUrl)}/feed" style="color:#4f3cf5">Manage your alerts</a>.
  </p>
</div>`;

const sendNewsAlertEmail = async (to, articles) => {
  if (!articles?.length) return;

  const listHtml = articles
    .map(
      (a) => `
      <li style="margin-bottom:14px">
        <a href="${escapeHtml(safeUrl(a.url))}" style="color:#4f3cf5;font-weight:bold;text-decoration:none">${escapeHtml(a.title)}</a>
        <div style="font-size:12px;color:#64748b">${escapeHtml(a.source?.name || '')}${
          a.category ? ` · ${escapeHtml(a.category)}` : ''
        }</div>
      </li>`
    )
    .join('');

  const listText = articles
    .map((a) => `- ${a.title}${a.category ? ` (${a.category})` : ''}\n  ${a.url}`)
    .join('\n');

  await sendMail({
    to,
    subject: `${articles.length} new ${articles.length === 1 ? 'story' : 'stories'} for you`,
    html: layout('Latest news for you', `<ul style="padding-left:18px">${listHtml}</ul>`),
    text: `Latest news for you\n\n${listText}\n\nManage your alerts: ${env.primaryClientUrl}/feed`,
  });
};

const sendTestEmail = async (to) => {
  await sendMail({
    to,
    subject: 'Your news alerts are working',
    html: layout(
      'Your news alerts are working',
      '<p>This is a test message. There are no new stories since your last alert, ' +
        'so nothing else was sent. New stories will arrive on your chosen schedule.</p>'
    ),
    text:
      'Your news alerts are working. This is a test message. There are no new stories since ' +
      'your last alert, so nothing else was sent.',
  });
};

const sendPasswordResetEmail = async (to, token) => {
  const resetUrl = new URL('/reset-password', env.primaryClientUrl);
  resetUrl.searchParams.set('email', to);
  resetUrl.searchParams.set('token', token);

  await sendMail({
    to,
    subject: 'Reset your password',
    text: `Use this link to reset your password. It expires in 1 hour:\n${resetUrl}`,
    html: layout(
      'Reset your password',
      `<p>Use the button below to choose a new password. The link expires in 1 hour.</p>
       <p><a href="${escapeHtml(resetUrl.toString())}" style="display:inline-block;background:#4f3cf5;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">Reset password</a></p>
       <p style="font-size:12px;color:#64748b">If you did not ask for this, you can ignore this email.</p>`
    ),
  });
};

module.exports = {
  getTransport,
  verifyEmailSetup,
  sendMail,
  sendNewsAlertEmail,
  sendTestEmail,
  sendPasswordResetEmail,
};
