export const getOtpHtml = ({ email, otp }) => {
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="x-apple-disable-message-reformatting" />
<title>{{APP_NAME}} Verification Code</title>
<style>
/* Base reset */
html, body {
margin: 0;
padding: 0;
}
body {
background: #f6f7fb;
color: #111;
-webkit-text-size-adjust: 100%;
-ms-text-size-adjust: 100%;
font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, 'Apple Color
Emoji','Segoe UI Emoji','Segoe UI Symbol', sans-serif;
}
table {
border-collapse: collapse;
}
img {
border: 0;
line-height: 100%;
outline: none;
text-decoration: none;
display: block;
max-width: 100%;
height: auto;
}
/* Layout */
.wrapper {
width: 100%;
background: #f6f7fb;
}
.outer {
width: 100%;
}
.container {
width: 600px;
max-width: 600px;
background: #ffffff;
border-radius: 12px;
overflow: hidden;
border: 1px solid #e9ecf3;
}
.p-24 {
padding: 24px;
}
.p-32 {
padding: 32px;
}
.header {
background: #111827;
padding: 18px 24px;
text-align: center;
}
.brand {
display: inline-block;
color: #ffffff;
font-weight: 700;
font-size: 16px;
letter-spacing: 0.3px;

text-decoration: none;
}
.title {
margin: 0 0 12px 0;
font-size: 22px;
line-height: 1.3;
color: #111;
font-weight: 700;
}
.text {
margin: 0 0 16px 0;
font-size: 15px;
line-height: 1.6;
color: #444;
}
.muted {
color: #555;
font-size: 14px;
line-height: 1.6;
margin: 0 0 12px 0;
}
/* OTP badge */
.otp-wrap {
margin: 20px 0;
width: 100%;
}
.otp {
display: inline-block;
background: #f3f4f6;
border: 1px solid #e5e7eb;
border-radius: 10px;
padding: 14px 18px;
font-size: 32px;
letter-spacing: 10px;
font-weight: 700;
color: #111;
font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
}
/* Button (optional) */
.btn {
display: inline-block;
background: #111827;
color: #ffffff !important;
text-decoration: none;
padding: 12px 18px;
border-radius: 8px;
font-weight: 600;
font-size: 14px;
}
/* Footer */
.footer {
text-align: center;
color: #6b7280;
font-size: 12px;
line-height: 1.6;
padding: 16px 24px 0 24px;
}
/* Responsive */
@media only screen and (max-width: 600px) {
.container {
width: 100% !important;
}
.p-32 {
padding: 24px !important;

}
.otp {
font-size: 28px !important;
letter-spacing: 6px !important;
}
}
</style>
</head>
<body>
<table role="presentation" class="wrapper" width="100%" border="0" cellspacing="0" cellpadding="0">
<tr>
<td align="center" class="p-24">
<table role="presentation" class="container" border="0" cellspacing="0" cellpadding="0">
<!-- Header -->
<tr>
<td class="header">
<span class="brand">Authentication App</span>
</td>
</tr>
<!-- Body -->
<tr>
<td class="p-32">
<h1 class="title">Verify your email - ${email}</h1>
<p class="text">
Use the verification code below to complete your sign-in to Authentication App.
</p>
<!-- OTP -->
<table role="presentation" class="otp-wrap" border="0" cellspacing="0" cellpadding="0">
<tr>
<td align="center">
<div class="otp">${otp}</div>
</td>
</tr>
</table>
<p class="muted">This code will expire in <strong>5 minutes</strong>.</p>
<p class="muted">If this wasn’t initiated, this email can be safely ignored.</p>
</td>
</tr>
<!-- Footer -->
<tr>
<td class="footer">
© 2025 Authentication App. All rights reserved.
</td>
</tr>
<tr>
<td height="16" aria-hidden="true"></td>
</tr>
</table>
</td>
</tr>
</table>
</body>
</html>
`;
    return html;
};
export const getVerifyEmailHtml = ({ email, token }) => {
    const appName = process.env.APP_NAME || "Authentication App";
    const baseUrl = process.env.FRONTEND_URL || "http://localhost:5173";
    const verifyUrl = `${baseUrl.replace(/\/+$/, "")}/verify/${encodeURIComponent(
        token

    )}`;
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="x-apple-disable-message-reformatting" />
<title>${appName} Verify Your Account</title>
<style>
/* Base reset */
html, body { margin: 0; padding: 0; }
body {
background: #f6f7fb;
color: #111;
-webkit-text-size-adjust: 100%;
-ms-text-size-adjust: 100%;
font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, 'Apple Color
Emoji','Segoe UI Emoji','Segoe UI Symbol', sans-serif;
}
table { border-collapse: collapse; }
img {
border: 0;
line-height: 100%;
outline: none;
text-decoration: none;
display: block;
max-width: 100%;
height: auto;
}
/* Layout */
.wrapper { width: 100%; background: #f6f7fb; }
.container {
width: 600px;
max-width: 600px;
background: #ffffff;
border-radius: 12px;
overflow: hidden;
border: 1px solid #e9ecf3;
}
.p-24 { padding: 24px; }
.p-32 { padding: 32px; }
.header {
background: #111827;
padding: 18px 24px;
text-align: center;
}
.brand {
display: inline-block;
color: #ffffff;
font-weight: 700;
font-size: 16px;
letter-spacing: 0.3px;
text-decoration: none;
}
.title {
margin: 0 0 12px 0;
font-size: 22px;
line-height: 1.3;
color: #111;
font-weight: 700;
}
.text {
margin: 0 16px 16px 0;
font-size: 15px;
line-height: 1.6;
color: #444;

}
.muted {
color: #555;
font-size: 14px;
line-height: 1.6;
margin: 0 0 12px 0;
}
/* Button */
.btn {
display: inline-block;
background: #111827;
color: #ffffff !important;
text-decoration: none;
padding: 12px 18px;
border-radius: 8px;
font-weight: 600;
font-size: 14px;
}
/* Footer */
.footer {
text-align: center;
color: #6b7280;
font-size: 12px;
line-height: 1.6;
padding: 16px 24px 0 24px;
}
/* Link fallback */
.link {
color: #111827;
text-decoration: underline;
word-break: break-all;
}
/* Responsive */
@media only screen and (max-width: 600px) {
.container { width: 100% !important; }
.p-32 { padding: 24px !important; }
}
</style>
</head>
<body>
<table role="presentation" class="wrapper" width="100%" border="0" cellspacing="0" cellpadding="0">
<tr>
<td align="center" class="p-24">
<table role="presentation" class="container" border="0" cellspacing="0" cellpadding="0">
<!-- Header -->
<tr>
<td class="header">
<span class="brand">${appName}</span>
</td>
</tr>
<!-- Body -->
<tr>
<td class="p-32">
<h1 class="title">Verify your account - ${email}</h1>
<p class="text">
Thanks for registering with ${appName}. Click the button below to verify your account.
</p>
<!-- Button -->
<table role="presentation" border="0" cellspacing="0" cellpadding="0" style="margin: 16px 0
20px 0;">
<tr>
<td align="center">

<a class="btn" href="${verifyUrl}" target="_blank" rel="noopener">Verify account</a>
</td>
</tr>
</table>
<p class="muted">
If the button doesn’t work, copy and paste this link into your browser:
</p>
<p class="muted">
<a class="link" href="${verifyUrl}" target="_blank" rel="noopener">${verifyUrl}</a>
</p>
<p class="muted">
If this wasn’t you, you can safely ignore this email.
</p>
</td>
</tr>
<!-- Footer -->
<tr>
<td class="footer">
© ${new Date().getFullYear()} ${appName}. All rights reserved.
</td>
</tr>
<tr>
<td height="16" aria-hidden="true"></td>
</tr>
</table>
</td>
</tr>
</table>
</body>
</html>`;
    return html;
};





export const sendStockNotificationMail = async ({ email, userName, product }) => {
    const { name, images, slug, basePrice, discountedPrice } = product;
    const price = discountedPrice ?? basePrice;
    const imageUrl = images?.[0] || "";
    const productUrl = `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/products/${slug}`;

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Back in Stock!</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=DM+Serif+Display&display=swap');
 
    * { margin: 0; padding: 0; box-sizing: border-box; }
 
    body {
      background: #0f0f11;
      font-family: 'DM Sans', sans-serif;
      color: #e8e8ef;
      -webkit-font-smoothing: antialiased;
    }
 
    .wrapper {
      max-width: 560px;
      margin: 40px auto;
      background: #18181c;
      border-radius: 20px;
      overflow: hidden;
      border: 1px solid #2a2a32;
      box-shadow: 0 24px 64px rgba(0,0,0,0.5);
    }
 
    /* ── Header ── */
    .header {
      background: linear-gradient(135deg, #6c47ff 0%, #ff4fa3 100%);
      padding: 36px 40px 28px;
      text-align: center;
      position: relative;
      overflow: hidden;
    }
    .header::before {
      content: '';
      position: absolute;
      inset: -40%;
      background: radial-gradient(circle at 70% 30%, rgba(255,255,255,0.08) 0%, transparent 60%);
    }
    .header-badge {
      display: inline-block;
      background: rgba(255,255,255,0.18);
      border: 1px solid rgba(255,255,255,0.25);
      color: #fff;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      padding: 5px 14px;
      border-radius: 100px;
      margin-bottom: 14px;
    }
    .header h1 {
      font-family: 'DM Serif Display', serif;
      font-size: 30px;
      color: #fff;
      line-height: 1.2;
      position: relative;
    }
    .header p {
      color: rgba(255,255,255,0.8);
      font-size: 14px;
      margin-top: 8px;
      position: relative;
    }
 
    /* ── Body ── */
    .body { padding: 36px 40px; }
 
    .greeting {
      font-size: 15px;
      color: #a0a0b0;
      margin-bottom: 24px;
      line-height: 1.6;
    }
    .greeting strong { color: #e8e8ef; }
 
    /* ── Product card ── */
    .product-card {
      background: #111114;
      border: 1px solid #2a2a32;
      border-radius: 16px;
      overflow: hidden;
      display: flex;
      gap: 0;
      margin-bottom: 28px;
    }
    .product-image {
      width: 130px;
      min-height: 130px;
      flex-shrink: 0;
      background: #1e1e24;
    }
    .product-image img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }
    .product-details {
      padding: 20px;
      display: flex;
      flex-direction: column;
      justify-content: center;
      gap: 8px;
    }
    .product-name {
      font-size: 16px;
      font-weight: 700;
      color: #e8e8ef;
      line-height: 1.3;
    }
    .product-price {
      font-size: 22px;
      font-weight: 700;
      background: linear-gradient(90deg, #6c47ff, #ff4fa3);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    .stock-pill {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      background: rgba(34, 197, 94, 0.12);
      border: 1px solid rgba(34, 197, 94, 0.25);
      color: #4ade80;
      font-size: 11px;
      font-weight: 700;
      padding: 4px 10px;
      border-radius: 100px;
      width: fit-content;
    }
    .stock-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #4ade80;
      display: inline-block;
    }
 
    /* ── CTA ── */
    .cta-wrapper { text-align: center; margin-bottom: 28px; }
    .cta-btn {
      display: inline-block;
      background: linear-gradient(135deg, #6c47ff 0%, #ff4fa3 100%);
      color: #fff !important;
      text-decoration: none;
      font-size: 15px;
      font-weight: 700;
      padding: 14px 40px;
      border-radius: 14px;
      letter-spacing: 0.02em;
      box-shadow: 0 8px 32px rgba(108,71,255,0.35);
      transition: opacity 0.2s;
    }
 
    .hurry {
      background: rgba(255, 79, 163, 0.08);
      border: 1px solid rgba(255, 79, 163, 0.18);
      border-radius: 12px;
      padding: 14px 18px;
      font-size: 13px;
      color: #ff8cc8;
      text-align: center;
      margin-bottom: 28px;
    }
 
    /* ── Footer ── */
    .footer {
      border-top: 1px solid #2a2a32;
      padding: 24px 40px;
      text-align: center;
    }
    .footer p {
      font-size: 12px;
      color: #555568;
      line-height: 1.7;
    }
    .footer a { color: #6c47ff; text-decoration: none; }
  </style>
</head>
<body>
  <div class="wrapper">
 
    <!-- Header -->
    <div class="header">
      <div class="header-badge">✦ Back in Stock</div>
      <h1>Great news, ${userName}!</h1>
      <p>Something you saved is available again.</p>
    </div>
 
    <!-- Body -->
    <div class="body">
      <p class="greeting">
        Hey <strong>${userName}</strong>, the product you added to your wishlist is 
        back in stock. Don't wait too long — popular items sell out fast!
      </p>
 
      <!-- Product -->
      <div class="product-card">
        ${imageUrl
            ? `<div class="product-image"><img src="${imageUrl}" alt="${name}" /></div>`
            : `<div class="product-image" style="display:flex;align-items:center;justify-content:center;font-size:32px;">📦</div>`
        }
        <div class="product-details">
          <div class="product-name">${name}</div>
          <div class="product-price">৳${Number(price).toLocaleString()}</div>
          <div class="stock-pill">
            <span class="stock-dot"></span> Back in Stock
          </div>
        </div>
      </div>
 
      <!-- Hurry up note -->
      <div class="hurry">
        ⚡ Stock is limited — grab yours before it's gone again!
      </div>
 
      <!-- CTA -->
      <div class="cta-wrapper">
        <a href="${productUrl}" class="cta-btn">Shop Now →</a>
      </div>
    </div>
 
    <!-- Footer -->
    <div class="footer">
      <p>
        You're receiving this because you wishlisted this item.<br/>
        <a href="${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/settings/notifications">
          Manage notifications
        </a> &nbsp;·&nbsp;
        <a href="${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/wishlist">
          View Wishlist
        </a>
      </p>
    </div>
 
  </div>
</body>
</html>
    `.trim();

    await sendMail({
        email,
        subject: `🎉 "${name}" is back in stock!`,
        html,
    });
};










export function buildInvoiceHTML(data) {
  const {
    invoiceNo,
    dateIssued = new Date(),
    dueDate,
    paymentStatus = "paid",
    customerName = "",
    customerEmail = "",
    customerPhone = "",
    customerAddress = "",
    items = [],
    subtotal = 0,
    discount = 0,
    shippingFee = 0,
    total = 0,
    paymentMethod = "",
    transactionId = null,
    paidAt = null,
  } = data;

  const fmt = (n) => Number(n || 0).toFixed(2);
  const fmtDate = (d) => d ? new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";

  const statusColor = paymentStatus === "paid"
    ? "#16a34a"
    : paymentStatus === "failed"
      ? "#dc2626"
      : "#d97706";

  const statusBg = paymentStatus === "paid"
    ? "#dcfce7"
    : paymentStatus === "failed"
      ? "#fee2e2"
      : "#fef9c3";

  const statusLabel = paymentStatus === "paid" ? "PAID" : paymentStatus === "failed" ? "FAILED" : "PENDING";

  const itemRows = items.map((item, i) => `
        <tr style="background: ${i % 2 === 0 ? "#ffffff" : "#fafafa"};">
            <td style="padding: 14px 20px; border-bottom: 1px solid #f1f5f9; font-size: 13px; color: #334155;">
                <div style="font-weight: 600; color: #0f172a;">${item.name || ""}</div>
                ${item.description ? `<div style="font-size: 11px; color: #94a3b8; margin-top: 2px;">${item.description}</div>` : ""}
            </td>
            <td style="padding: 14px 20px; border-bottom: 1px solid #f1f5f9; text-align: center; font-size: 13px; color: #475569;">${item.quantity}</td>
            <td style="padding: 14px 20px; border-bottom: 1px solid #f1f5f9; text-align: right; font-size: 13px; color: #475569;">৳${fmt(item.unitPrice)}</td>
            <td style="padding: 14px 20px; border-bottom: 1px solid #f1f5f9; text-align: right; font-size: 13px; font-weight: 700; color: #0f172a;">৳${fmt(item.amount)}</td>
        </tr>
    `).join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>Invoice ${invoiceNo}</title>
<style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
        font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif;
        background: #ffffff;
        color: #334155;
        font-size: 13px;
        line-height: 1.6;
    }
    .page {
        max-width: 794px;
        margin: 0 auto;
        background: #ffffff;
        min-height: 1123px;
        display: flex;
        flex-direction: column;
    }
</style>
</head>
<body>
<div class="page">
 
    <!-- ── Header ──────────────────────────────────────────── -->
    <div style="
        background: linear-gradient(135deg, #0f172a 0%, #1e293b 60%, #0f172a 100%);
        padding: 40px 48px 36px;
        position: relative;
        overflow: hidden;
    ">
        <!-- Decorative circle -->
        <div style="
            position: absolute; top: -40px; right: -40px;
            width: 200px; height: 200px;
            border-radius: 50%;
            background: rgba(239,68,68,0.12);
        "></div>
        <div style="
            position: absolute; bottom: -30px; left: 30%;
            width: 120px; height: 120px;
            border-radius: 50%;
            background: rgba(239,68,68,0.06);
        "></div>
 
        <div style="display: flex; justify-content: space-between; align-items: flex-start; position: relative; z-index: 1;">
            <!-- Brand -->
            <div>
                <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 8px;">
                    <div style="
                        width: 42px; height: 42px;
                        background: linear-gradient(135deg, #ef4444, #dc2626);
                        border-radius: 12px;
                        display: flex; align-items: center; justify-content: center;
                        font-size: 20px; font-weight: 900; color: white;
                        letter-spacing: -1px;
                    ">N</div>
                    <span style="font-size: 22px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px;">Nova Shop</span>
                </div>
                <p style="color: #94a3b8; font-size: 12px; margin-top: 4px;">Nova Shop Platform, Bangladesh</p>
                <p style="color: #94a3b8; font-size: 12px;">support@novashop.com</p>
            </div>
 
            <!-- Invoice title & status -->
            <div style="text-align: right;">
                <div style="font-size: 28px; font-weight: 900; color: #ffffff; letter-spacing: -1px;">INVOICE</div>
                <div style="color: #ef4444; font-size: 15px; font-weight: 700; margin-top: 2px;">#${invoiceNo}</div>
                <div style="
                    display: inline-block;
                    margin-top: 10px;
                    background: ${statusBg};
                    color: ${statusColor};
                    font-size: 11px; font-weight: 800;
                    padding: 4px 14px;
                    border-radius: 20px;
                    letter-spacing: 1px;
                ">${statusLabel}</div>
            </div>
        </div>
 
        <!-- Date row -->
        <div style="
            display: flex; gap: 32px;
            margin-top: 28px;
            padding-top: 24px;
            border-top: 1px solid rgba(255,255,255,0.08);
            position: relative; z-index: 1;
        ">
            <div>
                <div style="font-size: 10px; color: #64748b; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">Date Issued</div>
                <div style="color: #e2e8f0; font-size: 13px; font-weight: 600; margin-top: 3px;">${fmtDate(dateIssued)}</div>
            </div>
            ${dueDate ? `
            <div>
                <div style="font-size: 10px; color: #64748b; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">Due Date</div>
                <div style="color: #e2e8f0; font-size: 13px; font-weight: 600; margin-top: 3px;">${fmtDate(dueDate)}</div>
            </div>
            ` : ""}
            ${paidAt ? `
            <div>
                <div style="font-size: 10px; color: #64748b; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">Paid On</div>
                <div style="color: #86efac; font-size: 13px; font-weight: 600; margin-top: 3px;">${fmtDate(paidAt)}</div>
            </div>
            ` : ""}
        </div>
    </div>
 
    <!-- ── Bill To / Payment Details ───────────────────────── -->
    <div style="display: flex; gap: 0; border-bottom: 1px solid #f1f5f9;">
 
        <!-- Bill To -->
        <div style="flex: 1; padding: 28px 48px; border-right: 1px solid #f1f5f9;">
            <div style="font-size: 10px; color: #94a3b8; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 12px;">Invoice To</div>
            <div style="font-size: 16px; font-weight: 700; color: #0f172a; margin-bottom: 4px;">${customerName || "Customer"}</div>
            ${customerPhone ? `<div style="font-size: 12px; color: #64748b; margin-bottom: 2px;">📞 ${customerPhone}</div>` : ""}
            ${customerEmail ? `<div style="font-size: 12px; color: #64748b; margin-bottom: 2px;">✉️ ${customerEmail}</div>` : ""}
            ${customerAddress ? `<div style="font-size: 12px; color: #64748b; margin-top: 6px; line-height: 1.5;">📍 ${customerAddress}</div>` : ""}
        </div>
 
        <!-- Payment Details -->
        <div style="flex: 1; padding: 28px 48px;">
            <div style="font-size: 10px; color: #94a3b8; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 12px;">Payment Details</div>
            <table style="width: 100%; border-collapse: collapse;">
                <tr>
                    <td style="font-size: 12px; color: #64748b; padding: 3px 0;">Invoice Currency</td>
                    <td style="font-size: 12px; color: #0f172a; font-weight: 600; text-align: right;">BDT</td>
                </tr>
                <tr>
                    <td style="font-size: 12px; color: #64748b; padding: 3px 0;">Invoice Amount</td>
                    <td style="font-size: 12px; color: #0f172a; font-weight: 600; text-align: right;">৳${fmt(total)} BDT</td>
                </tr>
                <tr>
                    <td style="font-size: 12px; color: #64748b; padding: 3px 0;">Payment Method</td>
                    <td style="font-size: 12px; color: #0f172a; font-weight: 600; text-align: right; text-transform: uppercase;">${paymentMethod}</td>
                </tr>
                <tr>
                    <td style="font-size: 12px; color: #64748b; padding: 3px 0;">Payment Status</td>
                    <td style="text-align: right;">
                        <span style="font-size: 11px; font-weight: 700; color: ${statusColor};">${statusLabel}</span>
                    </td>
                </tr>
                ${paymentStatus === "paid" ? `
                <tr style="border-top: 1px solid #f1f5f9;">
                    <td style="font-size: 12px; color: #16a34a; font-weight: 700; padding: 5px 0;">Total Due</td>
                    <td style="font-size: 13px; color: #16a34a; font-weight: 800; text-align: right;">৳0.00</td>
                </tr>
                ` : `
                <tr style="border-top: 1px solid #f1f5f9;">
                    <td style="font-size: 12px; color: #d97706; font-weight: 700; padding: 5px 0;">Total Due</td>
                    <td style="font-size: 13px; color: #d97706; font-weight: 800; text-align: right;">৳${fmt(total)} BDT</td>
                </tr>
                `}
            </table>
        </div>
    </div>
 
    <!-- ── Items Table ──────────────────────────────────────── -->
    <div style="padding: 0 0; flex: 1;">
        <table style="width: 100%; border-collapse: collapse;">
            <thead>
                <tr style="background: #f8fafc;">
                    <th style="padding: 14px 20px; text-align: left; font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 1px; border-bottom: 2px solid #e2e8f0;">Description</th>
                    <th style="padding: 14px 20px; text-align: center; font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 1px; border-bottom: 2px solid #e2e8f0;">Qty</th>
                    <th style="padding: 14px 20px; text-align: right; font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 1px; border-bottom: 2px solid #e2e8f0;">Unit Price</th>
                    <th style="padding: 14px 20px; text-align: right; font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 1px; border-bottom: 2px solid #e2e8f0;">Amount</th>
                </tr>
            </thead>
            <tbody>
                ${itemRows}
            </tbody>
        </table>
 
        <!-- ── Totals ── -->
        <div style="display: flex; justify-content: flex-end; padding: 20px 20px 0;">
            <div style="width: 280px;">
                <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f1f5f9;">
                    <span style="font-size: 13px; color: #64748b;">Subtotal</span>
                    <span style="font-size: 13px; color: #0f172a; font-weight: 600;">৳${fmt(subtotal)}</span>
                </div>
                ${discount > 0 ? `
                <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f1f5f9;">
                    <span style="font-size: 13px; color: #16a34a;">Discount</span>
                    <span style="font-size: 13px; color: #16a34a; font-weight: 600;">-৳${fmt(discount)}</span>
                </div>
                ` : ""}
                <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f1f5f9;">
                    <span style="font-size: 13px; color: #64748b;">Shipping</span>
                    <span style="font-size: 13px; color: ${shippingFee === 0 ? "#16a34a" : "#0f172a"}; font-weight: 600;">${shippingFee === 0 ? "Free" : `৳${fmt(shippingFee)}`}</span>
                </div>
                ${paymentStatus === "paid" ? `
                <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f1f5f9;">
                    <span style="font-size: 13px; color: #16a34a;">Paid</span>
                    <span style="font-size: 13px; color: #16a34a; font-weight: 600;">(-) ৳${fmt(total)}</span>
                </div>
                ` : ""}
                <div style="
                    display: flex; justify-content: space-between;
                    padding: 12px 16px; margin-top: 8px;
                    background: linear-gradient(135deg, #0f172a, #1e293b);
                    border-radius: 12px;
                ">
                    <span style="font-size: 14px; color: #ffffff; font-weight: 700;">Total</span>
                    <span style="font-size: 16px; color: #ef4444; font-weight: 900;">৳${paymentStatus === "paid" ? "0.00" : fmt(total)}</span>
                </div>
            </div>
        </div>
    </div>
 
    <!-- ── Transactions ─────────────────────────────────────── -->
    ${transactionId ? `
    <div style="padding: 24px 20px 0;">
        <div style="font-size: 12px; color: #64748b; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px; padding-left: 0;">Transactions</div>
        <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
            <thead>
                <tr style="background: #f8fafc;">
                    <th style="padding: 10px 16px; text-align: left; color: #64748b; font-weight: 600; border-bottom: 1px solid #e2e8f0;">Transaction Date</th>
                    <th style="padding: 10px 16px; text-align: left; color: #64748b; font-weight: 600; border-bottom: 1px solid #e2e8f0;">Method</th>
                    <th style="padding: 10px 16px; text-align: left; color: #64748b; font-weight: 600; border-bottom: 1px solid #e2e8f0;">Transaction ID</th>
                    <th style="padding: 10px 16px; text-align: right; color: #64748b; font-weight: 600; border-bottom: 1px solid #e2e8f0;">Amount</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td style="padding: 10px 16px; color: #334155; border-bottom: 1px solid #f8fafc;">${fmtDate(paidAt || dateIssued)}</td>
                    <td style="padding: 10px 16px; color: #334155; text-transform: uppercase; font-weight: 600; border-bottom: 1px solid #f8fafc;">${paymentMethod}</td>
                    <td style="padding: 10px 16px; color: #64748b; font-family: monospace; font-size: 11px; border-bottom: 1px solid #f8fafc;">${transactionId}</td>
                    <td style="padding: 10px 16px; text-align: right; font-weight: 700; color: #0f172a; border-bottom: 1px solid #f8fafc;">৳${fmt(total)} BDT</td>
                </tr>
            </tbody>
        </table>
    </div>
    ` : ""}
 
    <!-- ── Footer ───────────────────────────────────────────── -->
    <div style="
        margin-top: auto;
        padding: 24px 48px;
        background: #f8fafc;
        border-top: 2px solid #f1f5f9;
        display: flex;
        justify-content: space-between;
        align-items: center;
    ">
        <p style="font-size: 13px; color: #64748b; font-weight: 500;">
            Thank you for your business. 🙏
        </p>
        <p style="font-size: 11px; color: #94a3b8;">
            Support: support@novashop.com | novashop.com
        </p>
    </div>
 
</div>
</body>
</html>`;
}
