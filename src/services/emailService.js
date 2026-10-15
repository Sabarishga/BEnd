const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  requireTLS: true,
  connectionTimeout: 30000,
  greetingTimeout: 30000,
  socketTimeout: 60000,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS?.replace(/\s/g, ''),
  },
});

const sendEmail = async (mailOptions, emailType) => {
  try {
    const result = await transporter.sendMail(mailOptions);
    console.log(`${emailType} email sent to ${mailOptions.to}`);
    return result;
  } catch (err) {
    console.error(`Failed to send ${emailType} email to ${mailOptions.to}:`, {
      message: err.message,
      code: err.code,
      command: err.command,
      responseCode: err.responseCode,
      response: err.response,
    });
    throw err;
  }
};

const sendNewsAlertEmail = async (toEmail, articles) => {
  if (!articles.length) return;

  const listHtml = articles
    .map(
      (a) =>
        `<li><a href="${a.url}" target="_blank">${a.title}</a> ${
          a.category ? `<em>(${a.category})</em>` : ''
        }</li>`
    )
    .join('');

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: toEmail,
    subject: 'Your News Alerts',
    html: `<h2>Latest News Updates</h2><ul>${listHtml}</ul>`,
  };

  await sendEmail(mailOptions, 'Alert');
};

const sendPasswordResetEmail = async (toEmail, token) => {
  const resetUrl = new URL('/reset-password', process.env.CLIENT_URL || 'http://localhost:5173');
  resetUrl.searchParams.set('email', toEmail);
  resetUrl.searchParams.set('token', token);

  await sendEmail({
    from: process.env.EMAIL_USER,
    to: toEmail,
    subject: 'Reset your password',
    text: `Use this link to reset your password. It expires in 1 hour: ${resetUrl.toString()}`,
    html: `<p>Use the link below to reset your password. It expires in 1 hour.</p><p><a href="${resetUrl.toString()}">Reset Password</a></p>`,
  }, 'Password reset');
};

module.exports = { sendNewsAlertEmail, sendPasswordResetEmail };
