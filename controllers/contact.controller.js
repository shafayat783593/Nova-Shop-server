import sendMail from "../config/sendMail.js";

export const handleContactForm = async (req, res) => {
  const { name, email, subject, message } = req.body;

  // বেসিক ভ্যালিডেশন
  if (!name || !email || !subject || !message) {
    return res.status(400).json({ success: false, message: "All fields are required." });
  }

  try {
    // ১. ইউজারকে একটি কনফার্মেশন ইমেইল পাঠানো
    const userHtml = `
      <div style="font-family: sans-serif; padding: 20px; color: #333;">
        <h2>Hello ${name},</h2>
        <p>Thank you for reaching out to NovaShop! We have received your message regarding <strong>"${subject}"</strong>.</p>
        <p>Our support team is reviewing your request and will get back to you within 24 hours.</p>
        <br />
        <p>Best regards,</p>
        <p><strong>NovaShop Team</strong></p>
      </div>
    `;

    await sendMail({
      email: email,
      subject: "We received your message! - NovaShop",
      html: userHtml,
    });

    // ২. অ্যাডমিন বা সাপোর্ট টিমকে নোটিফিকেশন ইমেইল পাঠানো
    const adminHtml = `
      <div style="font-family: sans-serif; padding: 20px; color: #333;">
        <h2>New Contact Form Submission</h2>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Subject:</strong> ${subject}</p>
        <p><strong>Message:</strong></p>
        <p style="background: #f5f5f5; padding: 15px; rounded: 8px;">${message}</p>
      </div>
    `;

    await sendMail({
      email: process.env.SMTP_USER, // অ্যাডমিন ইমেইল (যেখানে আপনি মেসেজ রিসিভ করতে চান)
      subject: `[Contact Form] ${subject}`,
      html: adminHtml,
    });

    return res.status(200).json({ success: true, message: "Message sent successfully." });
  } catch (error) {
    console.error("Email processing error:", error);
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};