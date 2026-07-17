import sendMail from "./sendMail.js";

/* ────────────────────────────────────────────────────────────
   Shared theme tokens (matches the app's tailwind theme)
   ──────────────────────────────────────────────────────────── */
const THEME = {
    primary: "#2d6a4f",
    secondary: "#40916c",
    accent: "#95d5b2",
    accentHover: "#74c69d",
    success: "#52b788",
    danger: "#d62828",
    bg: "#f8f3e6",
    cardBg: "#fffdf7",
    textMain: "#1b4332",
    textMuted: "#6b705c",
};

const getAppName = () => process.env.APP_NAME || "Nova Shop";
const getSiteUrl = () =>
    (process.env.NEXT_PUBLIC_SITE_URL || process.env.FRONTEND_URL || "http://localhost:3000").replace(/\/+$/, "");

/* ────────────────────────────────────────────────────────────
   OTP email
   ──────────────────────────────────────────────────────────── */
export const getOtpHtml = ({ email, otp }) => {
    const appName = getAppName();
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="x-apple-disable-message-reformatting" />
<title>${appName} Verification Code</title>
<style>
html, body { margin: 0; padding: 0; }
body {
  background: ${THEME.bg};
  color: ${THEME.textMain};
  -webkit-text-size-adjust: 100%;
  -ms-text-size-adjust: 100%;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, 'Apple Color Emoji','Segoe UI Emoji','Segoe UI Symbol', sans-serif;
}
table { border-collapse: collapse; }
img { border: 0; line-height: 100%; outline: none; text-decoration: none; display: block; max-width: 100%; height: auto; }
.wrapper { width: 100%; background: ${THEME.bg}; }
.container {
  width: 600px;
  max-width: 600px;
  background: ${THEME.cardBg};
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid ${THEME.accent};
}
.p-24 { padding: 24px; }
.p-32 { padding: 32px; }
.header {
  background: linear-gradient(135deg, ${THEME.primary} 0%, ${THEME.secondary} 100%);
  padding: 18px 24px;
  text-align: center;
}
.brand { display: inline-block; color: #ffffff; font-weight: 700; font-size: 16px; letter-spacing: 0.3px; text-decoration: none; }
.title { margin: 0 0 12px 0; font-size: 22px; line-height: 1.3; color: ${THEME.textMain}; font-weight: 700; }
.text { margin: 0 0 16px 0; font-size: 15px; line-height: 1.6; color: ${THEME.textMuted}; }
.muted { color: ${THEME.textMuted}; font-size: 14px; line-height: 1.6; margin: 0 0 12px 0; }
.otp-wrap { margin: 20px 0; width: 100%; }
.otp {
  display: inline-block;
  background: ${THEME.accent}33;
  border: 1px solid ${THEME.accent};
  border-radius: 10px;
  padding: 14px 18px;
  font-size: 32px;
  letter-spacing: 10px;
  font-weight: 700;
  color: ${THEME.primary};
  font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
}
.btn {
  display: inline-block;
  background: linear-gradient(135deg, ${THEME.primary}, ${THEME.secondary});
  color: #ffffff !important;
  text-decoration: none;
  padding: 12px 18px;
  border-radius: 8px;
  font-weight: 600;
  font-size: 14px;
}
.footer { text-align: center; color: ${THEME.textMuted}; font-size: 12px; line-height: 1.6; padding: 16px 24px 0 24px; }
@media only screen and (max-width: 600px) {
  .container { width: 100% !important; }
  .p-32 { padding: 24px !important; }
  .otp { font-size: 28px !important; letter-spacing: 6px !important; }
}
</style>
</head>
<body>
<table role="presentation" class="wrapper" width="100%" border="0" cellspacing="0" cellpadding="0">
<tr>
<td align="center" class="p-24">
<table role="presentation" class="container" border="0" cellspacing="0" cellpadding="0">
<tr>
<td class="header">
<span class="brand">${appName}</span>
</td>
</tr>
<tr>
<td class="p-32">
<h1 class="title">Verify your email - ${email}</h1>
<p class="text">
Use the verification code below to complete your sign-in to ${appName}.
</p>
<table role="presentation" class="otp-wrap" border="0" cellspacing="0" cellpadding="0">
<tr>
<td align="center">
<div class="otp">${otp}</div>
</td>
</tr>
</table>
<p class="muted">This code will expire in <strong>5 minutes</strong>.</p>
<p class="muted">If this wasn't initiated by you, this email can be safely ignored.</p>
</td>
</tr>
<tr>
<td class="footer">
&copy; ${new Date().getFullYear()} ${appName}. All rights reserved.
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

/* ────────────────────────────────────────────────────────────
   Verify-account email
   ──────────────────────────────────────────────────────────── */
export const getVerifyEmailHtml = ({ email, token }) => {
    const appName = getAppName();
    const baseUrl = process.env.FRONTEND_URL || "http://localhost:5173";
    const verifyUrl = `${baseUrl.replace(/\/+$/, "")}/verify/${encodeURIComponent(token)}`;
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="x-apple-disable-message-reformatting" />
<title>${appName} Verify Your Account</title>
<style>
html, body { margin: 0; padding: 0; }
body {
  background: ${THEME.bg};
  color: ${THEME.textMain};
  -webkit-text-size-adjust: 100%;
  -ms-text-size-adjust: 100%;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, 'Apple Color Emoji','Segoe UI Emoji','Segoe UI Symbol', sans-serif;
}
table { border-collapse: collapse; }
img { border: 0; line-height: 100%; outline: none; text-decoration: none; display: block; max-width: 100%; height: auto; }
.wrapper { width: 100%; background: ${THEME.bg}; }
.container {
  width: 600px;
  max-width: 600px;
  background: ${THEME.cardBg};
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid ${THEME.accent};
}
.p-24 { padding: 24px; }
.p-32 { padding: 32px; }
.header {
  background: linear-gradient(135deg, ${THEME.primary} 0%, ${THEME.secondary} 100%);
  padding: 18px 24px;
  text-align: center;
}
.brand { display: inline-block; color: #ffffff; font-weight: 700; font-size: 16px; letter-spacing: 0.3px; text-decoration: none; }
.title { margin: 0 0 12px 0; font-size: 22px; line-height: 1.3; color: ${THEME.textMain}; font-weight: 700; }
.text { margin: 0 16px 16px 0; font-size: 15px; line-height: 1.6; color: ${THEME.textMuted}; }
.muted { color: ${THEME.textMuted}; font-size: 14px; line-height: 1.6; margin: 0 0 12px 0; }
.btn {
  display: inline-block;
  background: linear-gradient(135deg, ${THEME.primary}, ${THEME.secondary});
  color: #ffffff !important;
  text-decoration: none;
  padding: 12px 18px;
  border-radius: 8px;
  font-weight: 600;
  font-size: 14px;
}
.footer { text-align: center; color: ${THEME.textMuted}; font-size: 12px; line-height: 1.6; padding: 16px 24px 0 24px; }
.link { color: ${THEME.primary}; text-decoration: underline; word-break: break-all; }
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
<tr>
<td class="header">
<span class="brand">${appName}</span>
</td>
</tr>
<tr>
<td class="p-32">
<h1 class="title">Verify your account - ${email}</h1>
<p class="text">
Thanks for registering with ${appName}. Click the button below to verify your account.
</p>
<table role="presentation" border="0" cellspacing="0" cellpadding="0" style="margin: 16px 0 20px 0;">
<tr>
<td align="center">
<a class="btn" href="${verifyUrl}" target="_blank" rel="noopener">Verify account</a>
</td>
</tr>
</table>
<p class="muted">
If the button doesn't work, copy and paste this link into your browser:
</p>
<p class="muted">
<a class="link" href="${verifyUrl}" target="_blank" rel="noopener">${verifyUrl}</a>
</p>
<p class="muted">
If this wasn't you, you can safely ignore this email.
</p>
</td>
</tr>
<tr>
<td class="footer">
&copy; ${new Date().getFullYear()} ${appName}. All rights reserved.
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

/* ────────────────────────────────────────────────────────────
   Back-in-stock notification
   ──────────────────────────────────────────────────────────── */
export const sendStockNotificationMail = async ({ email, userName, product }) => {
    const appName = getAppName();
    const siteUrl = getSiteUrl();
    const { name, images, slug, basePrice, discountedPrice } = product;
    const price = discountedPrice ?? basePrice;
    const imageUrl = images?.[0] || "";
    const productUrl = `${siteUrl}/products/${slug}`;

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
      background: ${THEME.bg};
      font-family: 'DM Sans', sans-serif;
      color: ${THEME.textMain};
      -webkit-font-smoothing: antialiased;
    }

    .wrapper {
      max-width: 560px;
      margin: 40px auto;
      background: ${THEME.cardBg};
      border-radius: 20px;
      overflow: hidden;
      border: 1px solid ${THEME.accent}55;
      box-shadow: 0 24px 64px rgba(27,67,50,0.12);
    }

    .header {
      background: linear-gradient(135deg, ${THEME.primary} 0%, ${THEME.secondary} 100%);
      padding: 36px 40px 28px;
      text-align: center;
      position: relative;
      overflow: hidden;
    }
    .header::before {
      content: '';
      position: absolute;
      inset: -40%;
      background: radial-gradient(circle at 70% 30%, rgba(255,255,255,0.12) 0%, transparent 60%);
    }
    .header-badge {
      display: inline-block;
      background: rgba(255,255,255,0.18);
      border: 1px solid rgba(255,255,255,0.3);
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
      color: rgba(255,255,255,0.85);
      font-size: 14px;
      margin-top: 8px;
      position: relative;
    }

    .body { padding: 36px 40px; }

    .greeting {
      font-size: 15px;
      color: ${THEME.textMuted};
      margin-bottom: 24px;
      line-height: 1.6;
    }
    .greeting strong { color: ${THEME.textMain}; }

    .product-card {
      background: ${THEME.bg};
      border: 1px solid ${THEME.accent}66;
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
      background: ${THEME.accent}22;
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
      color: ${THEME.textMain};
      line-height: 1.3;
    }
    .product-price {
      font-size: 22px;
      font-weight: 700;
      background: linear-gradient(90deg, ${THEME.primary}, ${THEME.secondary});
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    .stock-pill {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      background: ${THEME.success}22;
      border: 1px solid ${THEME.success}55;
      color: ${THEME.success};
      font-size: 11px;
      font-weight: 700;
      padding: 4px 10px;
      border-radius: 100px;
      width: fit-content;
    }
    .stock-dot { width: 6px; height: 6px; border-radius: 50%; background: ${THEME.success}; display: inline-block; }

    .cta-wrapper { text-align: center; margin-bottom: 28px; }
    .cta-btn {
      display: inline-block;
      background: linear-gradient(135deg, ${THEME.primary} 0%, ${THEME.secondary} 100%);
      color: #fff !important;
      text-decoration: none;
      font-size: 15px;
      font-weight: 700;
      padding: 14px 40px;
      border-radius: 14px;
      letter-spacing: 0.02em;
      box-shadow: 0 8px 32px rgba(45,106,79,0.3);
    }

    .hurry {
      background: ${THEME.accent}22;
      border: 1px solid ${THEME.accent}66;
      border-radius: 12px;
      padding: 14px 18px;
      font-size: 13px;
      color: ${THEME.primary};
      text-align: center;
      margin-bottom: 28px;
    }

    .footer {
      border-top: 1px solid ${THEME.accent}44;
      padding: 24px 40px;
      text-align: center;
    }
    .footer p { font-size: 12px; color: ${THEME.textMuted}; line-height: 1.7; }
    .footer a { color: ${THEME.primary}; text-decoration: none; }
  </style>
</head>
<body>
  <div class="wrapper">

    <div class="header">
      <div class="header-badge">&#10022; Back in Stock</div>
      <h1>Great news, ${userName}!</h1>
      <p>Something you saved is available again.</p>
    </div>

    <div class="body">
      <p class="greeting">
        Hey <strong>${userName}</strong>, the product you added to your wishlist is
        back in stock. Don't wait too long &mdash; popular items sell out fast!
      </p>

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

      <div class="hurry">
        &#9889; Stock is limited &mdash; grab yours before it's gone again!
      </div>

      <div class="cta-wrapper">
        <a href="${productUrl}" class="cta-btn">Shop Now &rarr;</a>
      </div>
    </div>

    <div class="footer">
      <p>
        You're receiving this because you wishlisted this item.<br/>
        <a href="${siteUrl}/settings/notifications">Manage notifications</a> &nbsp;&middot;&nbsp;
        <a href="${siteUrl}/wishlist">View Wishlist</a>
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

/* ────────────────────────────────────────────────────────────
   Invoice
   ──────────────────────────────────────────────────────────── */
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

    const appName = getAppName();
    const fmt = (n) => Number(n || 0).toFixed(2);
    const fmtDate = (d) => (d ? new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—");

    const statusColor = paymentStatus === "paid" ? THEME.success : paymentStatus === "failed" ? THEME.danger : "#b45309";
    const statusBg = paymentStatus === "paid" ? "#dcfce7" : paymentStatus === "failed" ? "#fee2e2" : "#fef9c3";
    const statusLabel = paymentStatus === "paid" ? "PAID" : paymentStatus === "failed" ? "FAILED" : "PENDING";

    const itemRows = items
        .map(
            (item, i) => `
        <tr style="background: ${i % 2 === 0 ? THEME.cardBg : THEME.bg};">
            <td style="padding: 14px 20px; border-bottom: 1px solid #eee5d3; font-size: 13px; color: ${THEME.textMuted};">
                <div style="font-weight: 600; color: ${THEME.textMain};">${item.name || ""}</div>
                ${item.description ? `<div style="font-size: 11px; color: ${THEME.textMuted}; margin-top: 2px;">${item.description}</div>` : ""}
            </td>
            <td style="padding: 14px 20px; border-bottom: 1px solid #eee5d3; text-align: center; font-size: 13px; color: ${THEME.textMuted};">${item.quantity}</td>
            <td style="padding: 14px 20px; border-bottom: 1px solid #eee5d3; text-align: right; font-size: 13px; color: ${THEME.textMuted};">৳${fmt(item.unitPrice)}</td>
            <td style="padding: 14px 20px; border-bottom: 1px solid #eee5d3; text-align: right; font-size: 13px; font-weight: 700; color: ${THEME.textMain};">৳${fmt(item.amount)}</td>
        </tr>
    `
        )
        .join("");

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
        background: ${THEME.cardBg};
        color: ${THEME.textMuted};
        font-size: 13px;
        line-height: 1.6;
    }
    .page {
        max-width: 794px;
        margin: 0 auto;
        background: ${THEME.cardBg};
        min-height: 1123px;
        display: flex;
        flex-direction: column;
    }
</style>
</head>
<body>
<div class="page">

    <!-- Header -->
    <div style="
        background: linear-gradient(135deg, ${THEME.primary} 0%, ${THEME.secondary} 60%, ${THEME.primary} 100%);
        padding: 40px 48px 36px;
        position: relative;
        overflow: hidden;
    ">
        <div style="position: absolute; top: -40px; right: -40px; width: 200px; height: 200px; border-radius: 50%; background: rgba(226,176,74,0.15);"></div>
        <div style="position: absolute; bottom: -30px; left: 30%; width: 120px; height: 120px; border-radius: 50%; background: rgba(226,176,74,0.08);"></div>

        <div style="display: flex; justify-content: space-between; align-items: flex-start; position: relative; z-index: 1;">
            <div>
                <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 8px;">
                    <div style="
                        width: 42px; height: 42px;
                        background: linear-gradient(135deg, #e2b04a, #d9a02f);
                        border-radius: 12px;
                        display: flex; align-items: center; justify-content: center;
                        font-size: 20px; font-weight: 900; color: white;
                        letter-spacing: -1px;
                    ">${appName.charAt(0).toUpperCase()}</div>
                    <span style="font-size: 22px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px;">${appName}</span>
                </div>
                <p style="color: rgba(255,255,255,0.7); font-size: 12px; margin-top: 4px;">${appName} Platform, Bangladesh</p>
                <p style="color: rgba(255,255,255,0.7); font-size: 12px;">support@${appName.toLowerCase().replace(/\s+/g, "")}.com</p>
            </div>

            <div style="text-align: right;">
                <div style="font-size: 28px; font-weight: 900; color: #ffffff; letter-spacing: -1px;">INVOICE</div>
                <div style="color: #e2b04a; font-size: 15px; font-weight: 700; margin-top: 2px;">#${invoiceNo}</div>
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

        <div style="display: flex; gap: 32px; margin-top: 28px; padding-top: 24px; border-top: 1px solid rgba(255,255,255,0.15); position: relative; z-index: 1;">
            <div>
                <div style="font-size: 10px; color: rgba(255,255,255,0.55); font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">Date Issued</div>
                <div style="color: #f1f5f0; font-size: 13px; font-weight: 600; margin-top: 3px;">${fmtDate(dateIssued)}</div>
            </div>
            ${dueDate
            ? `
            <div>
                <div style="font-size: 10px; color: rgba(255,255,255,0.55); font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">Due Date</div>
                <div style="color: #f1f5f0; font-size: 13px; font-weight: 600; margin-top: 3px;">${fmtDate(dueDate)}</div>
            </div>
            `
            : ""}
            ${paidAt
            ? `
            <div>
                <div style="font-size: 10px; color: rgba(255,255,255,0.55); font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">Paid On</div>
                <div style="color: #95d5b2; font-size: 13px; font-weight: 600; margin-top: 3px;">${fmtDate(paidAt)}</div>
            </div>
            `
            : ""}
        </div>
    </div>

    <!-- Bill To / Payment Details -->
    <div style="display: flex; gap: 0; border-bottom: 1px solid #eee5d3;">

        <div style="flex: 1; padding: 28px 48px; border-right: 1px solid #eee5d3;">
            <div style="font-size: 10px; color: ${THEME.textMuted}; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 12px;">Invoice To</div>
            <div style="font-size: 16px; font-weight: 700; color: ${THEME.textMain}; margin-bottom: 4px;">${customerName || "Customer"}</div>
            ${customerPhone ? `<div style="font-size: 12px; color: ${THEME.textMuted}; margin-bottom: 2px;">📞 ${customerPhone}</div>` : ""}
            ${customerEmail ? `<div style="font-size: 12px; color: ${THEME.textMuted}; margin-bottom: 2px;">✉️ ${customerEmail}</div>` : ""}
            ${customerAddress ? `<div style="font-size: 12px; color: ${THEME.textMuted}; margin-top: 6px; line-height: 1.5;">📍 ${customerAddress}</div>` : ""}
        </div>

        <div style="flex: 1; padding: 28px 48px;">
            <div style="font-size: 10px; color: ${THEME.textMuted}; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 12px;">Payment Details</div>
            <table style="width: 100%; border-collapse: collapse;">
                <tr>
                    <td style="font-size: 12px; color: ${THEME.textMuted}; padding: 3px 0;">Invoice Currency</td>
                    <td style="font-size: 12px; color: ${THEME.textMain}; font-weight: 600; text-align: right;">BDT</td>
                </tr>
                <tr>
                    <td style="font-size: 12px; color: ${THEME.textMuted}; padding: 3px 0;">Invoice Amount</td>
                    <td style="font-size: 12px; color: ${THEME.textMain}; font-weight: 600; text-align: right;">৳${fmt(total)} BDT</td>
                </tr>
                <tr>
                    <td style="font-size: 12px; color: ${THEME.textMuted}; padding: 3px 0;">Payment Method</td>
                    <td style="font-size: 12px; color: ${THEME.textMain}; font-weight: 600; text-align: right; text-transform: uppercase;">${paymentMethod}</td>
                </tr>
                <tr>
                    <td style="font-size: 12px; color: ${THEME.textMuted}; padding: 3px 0;">Payment Status</td>
                    <td style="text-align: right;">
                        <span style="font-size: 11px; font-weight: 700; color: ${statusColor};">${statusLabel}</span>
                    </td>
                </tr>
                ${paymentStatus === "paid"
            ? `
                <tr style="border-top: 1px solid #eee5d3;">
                    <td style="font-size: 12px; color: ${THEME.success}; font-weight: 700; padding: 5px 0;">Total Due</td>
                    <td style="font-size: 13px; color: ${THEME.success}; font-weight: 800; text-align: right;">৳0.00</td>
                </tr>
                `
            : `
                <tr style="border-top: 1px solid #eee5d3;">
                    <td style="font-size: 12px; color: #b45309; font-weight: 700; padding: 5px 0;">Total Due</td>
                    <td style="font-size: 13px; color: #b45309; font-weight: 800; text-align: right;">৳${fmt(total)} BDT</td>
                </tr>
                `}
            </table>
        </div>
    </div>

    <!-- Items Table -->
    <div style="padding: 0 0; flex: 1;">
        <table style="width: 100%; border-collapse: collapse;">
            <thead>
                <tr style="background: ${THEME.bg};">
                    <th style="padding: 14px 20px; text-align: left; font-size: 11px; font-weight: 700; color: ${THEME.textMuted}; text-transform: uppercase; letter-spacing: 1px; border-bottom: 2px solid #eee5d3;">Description</th>
                    <th style="padding: 14px 20px; text-align: center; font-size: 11px; font-weight: 700; color: ${THEME.textMuted}; text-transform: uppercase; letter-spacing: 1px; border-bottom: 2px solid #eee5d3;">Qty</th>
                    <th style="padding: 14px 20px; text-align: right; font-size: 11px; font-weight: 700; color: ${THEME.textMuted}; text-transform: uppercase; letter-spacing: 1px; border-bottom: 2px solid #eee5d3;">Unit Price</th>
                    <th style="padding: 14px 20px; text-align: right; font-size: 11px; font-weight: 700; color: ${THEME.textMuted}; text-transform: uppercase; letter-spacing: 1px; border-bottom: 2px solid #eee5d3;">Amount</th>
                </tr>
            </thead>
            <tbody>
                ${itemRows}
            </tbody>
        </table>

        <div style="display: flex; justify-content: flex-end; padding: 20px 20px 0;">
            <div style="width: 280px;">
                <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee5d3;">
                    <span style="font-size: 13px; color: ${THEME.textMuted};">Subtotal</span>
                    <span style="font-size: 13px; color: ${THEME.textMain}; font-weight: 600;">৳${fmt(subtotal)}</span>
                </div>
                ${discount > 0
            ? `
                <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee5d3;">
                    <span style="font-size: 13px; color: ${THEME.success};">Discount</span>
                    <span style="font-size: 13px; color: ${THEME.success}; font-weight: 600;">-৳${fmt(discount)}</span>
                </div>
                `
            : ""}
                <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee5d3;">
                    <span style="font-size: 13px; color: ${THEME.textMuted};">Shipping</span>
                    <span style="font-size: 13px; color: ${shippingFee === 0 ? THEME.success : THEME.textMain}; font-weight: 600;">${shippingFee === 0 ? "Free" : `৳${fmt(shippingFee)}`}</span>
                </div>
                ${paymentStatus === "paid"
            ? `
                <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee5d3;">
                    <span style="font-size: 13px; color: ${THEME.success};">Paid</span>
                    <span style="font-size: 13px; color: ${THEME.success}; font-weight: 600;">(-) ৳${fmt(total)}</span>
                </div>
                `
            : ""}
                <div style="
                    display: flex; justify-content: space-between;
                    padding: 12px 16px; margin-top: 8px;
                    background: linear-gradient(135deg, ${THEME.primary}, ${THEME.secondary});
                    border-radius: 12px;
                ">
                    <span style="font-size: 14px; color: #ffffff; font-weight: 700;">Total</span>
                    <span style="font-size: 16px; color: #e2b04a; font-weight: 900;">৳${paymentStatus === "paid" ? "0.00" : fmt(total)}</span>
                </div>
            </div>
        </div>
    </div>

    ${transactionId
            ? `
    <div style="padding: 24px 20px 0;">
        <div style="font-size: 12px; color: ${THEME.textMuted}; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px; padding-left: 0;">Transactions</div>
        <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
            <thead>
                <tr style="background: ${THEME.bg};">
                    <th style="padding: 10px 16px; text-align: left; color: ${THEME.textMuted}; font-weight: 600; border-bottom: 1px solid #eee5d3;">Transaction Date</th>
                    <th style="padding: 10px 16px; text-align: left; color: ${THEME.textMuted}; font-weight: 600; border-bottom: 1px solid #eee5d3;">Method</th>
                    <th style="padding: 10px 16px; text-align: left; color: ${THEME.textMuted}; font-weight: 600; border-bottom: 1px solid #eee5d3;">Transaction ID</th>
                    <th style="padding: 10px 16px; text-align: right; color: ${THEME.textMuted}; font-weight: 600; border-bottom: 1px solid #eee5d3;">Amount</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td style="padding: 10px 16px; color: ${THEME.textMuted}; border-bottom: 1px solid #f6f0df;">${fmtDate(paidAt || dateIssued)}</td>
                    <td style="padding: 10px 16px; color: ${THEME.textMuted}; text-transform: uppercase; font-weight: 600; border-bottom: 1px solid #f6f0df;">${paymentMethod}</td>
                    <td style="padding: 10px 16px; color: ${THEME.textMuted}; font-family: monospace; font-size: 11px; border-bottom: 1px solid #f6f0df;">${transactionId}</td>
                    <td style="padding: 10px 16px; text-align: right; font-weight: 700; color: ${THEME.textMain}; border-bottom: 1px solid #f6f0df;">৳${fmt(total)} BDT</td>
                </tr>
            </tbody>
        </table>
    </div>
    `
            : ""}

    <div style="
        margin-top: auto;
        padding: 24px 48px;
        background: ${THEME.bg};
        border-top: 2px solid #eee5d3;
        display: flex;
        justify-content: space-between;
        align-items: center;
    ">
        <p style="font-size: 13px; color: ${THEME.textMuted}; font-weight: 500;">
            Thank you for your business. 🙏
        </p>
        <p style="font-size: 11px; color: ${THEME.textMuted};">
            Support: support@${appName.toLowerCase().replace(/\s+/g, "")}.com | ${appName.toLowerCase().replace(/\s+/g, "")}.com
        </p>
    </div>

</div>
</body>
</html>`;
}

/* ────────────────────────────────────────────────────────────
   Delivery-partner invite
   ──────────────────────────────────────────────────────────── */
export const getInviteHtml = ({ name, inviteLink, expiresIn = "24 hours" }) => {
    const appName = getAppName();
    return `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;font-family:'Segoe UI',sans-serif;background:${THEME.bg};">
<div style="max-width:560px;margin:0 auto;background:${THEME.cardBg};border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(27,67,50,0.1);">

  <!-- Header -->
  <div style="background:linear-gradient(135deg,${THEME.primary} 0%,${THEME.secondary} 100%);padding:36px 40px;">
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:24px;">
      <div style="width:40px;height:40px;background:linear-gradient(135deg,#e2b04a,#d9a02f);border-radius:10px;display:flex;align-items:center;justify-content:center;">
        <span style="color:white;font-size:20px;font-weight:900;">${appName.charAt(0).toUpperCase()}</span>
      </div>
      <span style="color:#ffffff;font-size:20px;font-weight:800;">${appName}</span>
    </div>
    <h1 style="color:#ffffff;font-size:24px;font-weight:800;margin:0 0 8px 0;">
      You're Invited! 🚀
    </h1>
    <p style="color:rgba(255,255,255,0.75);font-size:14px;margin:0;">Delivery Partner Invitation</p>
  </div>

  <!-- Body -->
  <div style="padding:36px 40px;">
    <p style="font-size:15px;color:${THEME.textMuted};line-height:1.7;margin:0 0 20px 0;">
      Hi <strong style="color:${THEME.textMain};">${name}</strong>,<br/><br/>
      You have been selected as a <strong>Delivery Partner</strong> for ${appName}.
      Click the button below to set up your account and get started.
    </p>

    <div style="text-align:center;margin:32px 0;">
      <a href="${inviteLink}"
         style="display:inline-block;background:linear-gradient(135deg,${THEME.primary},${THEME.secondary});
                color:white;padding:16px 40px;border-radius:12px;font-weight:700;
                font-size:15px;text-decoration:none;letter-spacing:0.3px;
                box-shadow:0 4px 12px rgba(45,106,79,0.3);">
        Setup My Account &rarr;
      </a>
    </div>

    <div style="background:#fef9c3;border-radius:12px;padding:16px 20px;border-left:4px solid #e2b04a;">
      <p style="font-size:13px;color:#854d0e;margin:0;line-height:1.6;">
        ⏰ <strong>This invitation expires in ${expiresIn}.</strong><br/>
        If you didn't expect this, please ignore this email.
      </p>
    </div>
  </div>

  <!-- Footer -->
  <div style="background:${THEME.bg};padding:20px 40px;border-top:1px solid #eee5d3;text-align:center;">
    <p style="font-size:12px;color:${THEME.textMuted};margin:0;">
      &copy; ${appName} &middot; Bangladesh &middot; support@${appName.toLowerCase().replace(/\s+/g, "")}.com
    </p>
  </div>
</div>
</body>
</html>`;
};



