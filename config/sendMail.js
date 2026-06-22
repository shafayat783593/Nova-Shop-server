


import { createTransport } from "nodemailer";

const sendMail = async ({ email, subject, html, attachments = [] }) => {
  const transport = createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD,
    },
  });

  await transport.sendMail({
    from: `"Nova Shop" <${process.env.SMTP_USER}>`,
    to: email,
    subject,
    html,
    attachments, // [{ filename, content, contentType }]
  });
};

export default sendMail;
