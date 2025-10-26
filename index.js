import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// In-memory databases (for prototype). For production use a real DB.
let users = {}; // email -> { name, email, passwordHash, productsCount, isSubscriber }
const PAYPAL_BUSINESS_EMAIL = "gharatimustafa@gmail.com";

function makeToken(email) {
  const payload = `${email}|${Date.now()}|${crypto.randomBytes(8).toString("hex")}`;
  return Buffer.from(payload).toString("base64");
}
function verifyToken(token) {
  try {
    const decoded = Buffer.from(token, "base64").toString("utf8");
    const parts = decoded.split("|");
    const email = parts[0];
    if (users[email]) return email;
  } catch(e){}
  return null;
}

// Endpoints
app.post("/api/register", (req, res) => {
  const { name, email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: "Email and password required" });
  if (users[email]) return res.status(400).json({ error: "User exists" });
  const hash = crypto.createHash("sha256").update(password).digest("hex");
  users[email] = { name: name || "", email, passwordHash: hash, productsCount: 0, isSubscriber: false };
  const token = makeToken(email);
  res.json({ token, user: { name: users[email].name, email, productsCount: 0, isSubscriber: false } });
});

app.post("/api/login", (req, res) => {
  const { email, password } = req.body;
  const u = users[email];
  if (!u) return res.status(400).json({ error: "Invalid credentials" });
  const hash = crypto.createHash("sha256").update(password).digest("hex");
  if (hash !== u.passwordHash) return res.status(400).json({ error: "Invalid credentials" });
  const token = makeToken(email);
  res.json({ token, user: { name: u.name, email, productsCount: u.productsCount, isSubscriber: u.isSubscriber } });
});

app.post("/api/generate", (req, res) => {
  const { type, idea, token } = req.body;
  const email = verifyToken(token) || "guest";
  if (!users[email]) {
    // treat as guest with limited allowance stored in memory by email "guest"
    if (!users["guest"]) users["guest"] = { name: "Guest", email: "guest", passwordHash: "", productsCount: 0, isSubscriber: false };
  }
  const userRecord = users[email];

  // Allow 3 free products for non-subscribers
  if (!userRecord.isSubscriber && userRecord.productsCount >= 3) {
    return res.json({ error: "free_exhausted", text: "🚫 انتهت تجربتك المجانية. يرجى الاشتراك للمتابعة." });
  }

  userRecord.productsCount++;

  const generatedText = `📦 DigitalForge - Generated Product
نوع المنتج: ${type}
الفكرة: ${idea}

مقدمة:
هذا منتج رقمي تم إنشاؤه تلقائيًا بواسطة DigitalForge. يمكنك تعديله وبيعه أو تحميله كملف PDF.

محتوى (مثال):
1) نظرة عامة على الموضوع.
2) نقاط مهمة وممارسة عملية.
3) خاتمة ونصائح تطبيقية.

(تم إنشاء النسخة التجريبية — استبدل هذه المحاكاة بربط API حقيقي لاحقًا)`;

  res.json({ text: generatedText, productsLeft: Math.max(0, 3 - userRecord.productsCount), isSubscriber: userRecord.isSubscriber });
});

// Simple pay page for PayPal checkout (opens PayPal)
app.get("/pay", (req, res) => {
  const html = `
  <html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
  <body style="font-family:sans-serif; text-align:center; padding:30px;">
  <h2>اشترك الآن للوصول غير المحدود</h2>
  <p>الاشتراك الشهري: $10</p>
  <form action="https://www.paypal.com/cgi-bin/webscr" method="post" target="_blank">
    <input type="hidden" name="cmd" value="_xclick">
    <input type="hidden" name="business" value="${PAYPAL_BUSINESS_EMAIL}">
    <input type="hidden" name="item_name" value="DigitalForge Monthly Subscription">
    <input type="hidden" name="amount" value="10.00">
    <input type="hidden" name="currency_code" value="USD">
    <button type="submit" style="background:#0070ba;color:#fff;padding:10px 18px;border:none;border-radius:6px;cursor:pointer;">ادفع الآن عبر PayPal</button>
  </form>
  <p style="margin-top:20px;"><a href="/">العودة إلى الموقع</a></p>
  </body></html>`;
  res.send(html);
});

// Serve public folder files (index.html placed in /public)
app.use(express.static(path.join(__dirname, "public")));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
