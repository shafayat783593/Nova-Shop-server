


// import { createTransport } from "nodemailer";

// const sendMail = async ({ email, subject, html, attachments = [] }) => {
//   const transport = createTransport({
//     host: "smtp.gmail.com",
//     port: 465,
//     secure: true,
//     auth: {
//       user: process.env.SMTP_USER,
//       pass: process.env.SMTP_PASSWORD,
//     },
//   });

//   await transport.sendMail({
//     from: `"Nova Shop" <${process.env.SMTP_USER}>`,
//     to: email,
//     subject,
//     html,
//     attachments, // [{ filename, content, contentType }]
//   });
// };

// export default sendMail;








import * as SibApiV3Sdk from "@getbrevo/brevo";

const sendMail = async ({ email, subject, html, attachments = [] }) => {
  const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();
  apiInstance.setApiKey(
    SibApiV3Sdk.TransactionalEmailsApiApiKeys.apiKey,
    process.env.BREVO_API_KEY   // ← এখানে পরিবর্তন
  );

  const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();
  sendSmtpEmail.subject = subject;
  sendSmtpEmail.htmlContent = html;
  sendSmtpEmail.sender = { name: "Nova Shop", email: process.env.SMTP_USER };
  sendSmtpEmail.to = [{ email }];

  if (attachments.length > 0) {
    sendSmtpEmail.attachment = attachments.map((file) => ({
      name: file.filename,
      content: Buffer.isBuffer(file.content)
        ? file.content.toString("base64")
        : file.content,
    }));
  }

  await apiInstance.sendTransacEmail(sendSmtpEmail);
};

export default sendMail;





// import { BrevoClient } from "@getbrevo/brevo";

// const brevo = new BrevoClient({
//     apiKey: process.env.SMTP_PASSWORD,
// });

// export const sendMail = async ({ to, subject, html }) => {
//     const result = await brevo.transactionalEmails.sendTransacEmail({
//         subject,
//         htmlContent: html,
//         sender: { name: "NovaShop", email: process.env.SMTP_USER },
//         to: [{ email: to }],
//     });

//     console.log("Email sent:", result);
//     return result;
// };