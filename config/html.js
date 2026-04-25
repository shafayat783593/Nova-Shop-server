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