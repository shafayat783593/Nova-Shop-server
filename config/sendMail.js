


import { createTransport } from "nodemailer";

const sendMail = async ({ email, subject, html, attachments = [] }) => {
const transport = createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  },
  connectionTimeout: 30000,
  greetingTimeout: 30000,
  socketTimeout: 30000,
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
