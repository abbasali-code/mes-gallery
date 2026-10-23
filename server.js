const express = require("express");
const session = require("express-session");
const crypto = require("node:crypto");

const app = express();
const PORT = process.env.PORT || 10000;
const OWNER = process.env.GITHUB_REPO_OWNER || "abbasali-code";
const REPO = process.env.GITHUB_REPO_NAME || "mes-gallery";
const ADMIN = (process.env.ADMIN_GITHUB_USERNAME || "abbasali-code").toLowerCase();
const CLIENT_ID = process.env.GITHUB_CLIENT_ID;
const CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;
const SESSION_SECRET = process.env.SESSION_SECRET;
const CALLBACK_URL = process.env.GITHUB_CALLBACK_URL;
const REPO_TOKEN = process.env.GITHUB_REPO_TOKEN;

app.set("trust proxy", 1);
app.use(express.json({ limit: "1mb" }));
app.use(session({
  name: "mesgallery.sid",
  secret: SESSION_SECRET || "development-secret-change-before-deploy",
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: 8 * 60 * 60 * 1000 }
}));

const configReady = () => Boolean(CLIENT_ID && CLIENT_SECRET && SESSION_SECRET && CALLBACK_URL && REPO_TOKEN);
function requireLogin(req, res, next) {
  if (!req.session?.user || !req.session?.repoToken) return res.status(401).json({ error: "ابتدا با حساب مجاز GitHub وارد شو." });
  next();
}
const noStore = (req, res, next) => { res.set("Cache-Control", "no-store"); next(); };

app.get("/", (req, res) => res.redirect("/admin.html"));
app.get("/api/health", (req, res) => res.json({ ok: true, service: "mes-gallery-admin" }));

app.get("/auth/login", (req, res) => {
  if (!configReady()) return res.status(503).send("تنظیمات امن سرویس هنوز کامل نشده است.");
  const state = crypto.randomBytes(24).toString("hex");
  req.session.oauthState = state;
  const params = new URLSearchParams({ client_id: CLIENT_ID, redirect_uri: CALLBACK_URL, scope: "repo read:user", state });
  res.redirect("https://github.com/login/oauth/authorize?" + params.toString());
});

app.get("/auth/callback", async (req, res) => {
  try {
    if (!configReady()) return res.status(503).send("تنظیمات امن سرویس هنوز کامل نشده است.");
    if (!req.query.code || !req.query.state || req.query.state !== req.session.oauthState) return res.status(400).send("درخواست ورود معتبر نیست. دوباره تلاش کن.");
    delete req.session.oauthState;
    const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST", headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET, code: req.query.code })
    });
    const tokenData = await tokenResponse.json();
    if (!tokenResponse.ok || !tokenData.access_token) return res.status(401).send("ورود GitHub انجام نشد. دوباره تلاش کن.");
    const userResponse = await fetch("https://api.github.com/user", {
      headers: { Authorization: "Bearer " + tokenData.access_token, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" }
    });
    const user = await userResponse.json();
    if (!userResponse.ok || !user.login || user.login.toLowerCase() !== ADMIN) return res.status(403).send("این حساب GitHub اجازهٔ مدیریت فروشگاه را ندارد.");
    req.session.user = { login: user.login, avatar_url: user.avatar_url || "" };
    req.session.repoToken = REPO_TOKEN;
    res.redirect("/admin.html");
  } catch (error) {
    console.error("OAuth callback failed:", error.message);
    res.status(500).send("خطای موقت هنگام ورود. دوباره تلاش کن.");
  }
});

app.get("/api/me", noStore, (req, res) => res.json({ authenticated: Boolean(req.session?.user), user: req.session?.user || null }));

app.get("/api/products", requireLogin, noStore, async (req, res) => {
  try {
    const url = `https://api.github.com/repos/${OWNER}/${REPO}/contents/products.json`;
    const response = await fetch(url, { headers: { Authorization: "Bearer " + req.session.repoToken, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" } });
    const data = await response.json();
    if (!response.ok || !data.content) return res.status(502).json({ error: "خواندن محصولات از GitHub ناموفق بود." });
    const parsed = JSON.parse(Buffer.from(data.content, "base64").toString("utf8"));
    res.json({ products: Array.isArray(parsed.products) ? parsed.products : [], sha: data.sha });
  } catch (error) {
    console.error("Load products failed:", error.message);
    res.status(500).json({ error: "خواندن محصولات ناموفق بود." });
  }
});

app.put("/api/products", requireLogin, async (req, res) => {
  try {
    const products = req.body?.products;
    if (!Array.isArray(products) || products.length > 500) return res.status(400).json({ error: "فهرست محصولات معتبر نیست." });
    for (const item of products) {
      if (!item || typeof item !== "object" || typeof item.id !== "string" || typeof item.name !== "string" || typeof item.price !== "number" || !Number.isFinite(item.price) || item.price < 0) {
        return res.status(400).json({ error: "یکی از محصولات اطلاعات معتبر ندارد." });
      }
    }
    const url = `https://api.github.com/repos/${OWNER}/${REPO}/contents/products.json`;
    const currentResponse = await fetch(url, { headers: { Authorization: "Bearer " + req.session.repoToken, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" } });
    const current = await currentResponse.json();
    if (!currentResponse.ok || !current.sha) return res.status(502).json({ error: "گرفتن نسخهٔ فعلی فایل از GitHub ناموفق بود." });
    const content = Buffer.from(JSON.stringify({ products }, null, 2) + "\n").toString("base64");
    const updateResponse = await fetch(url, {
      method: "PUT",
      headers: { Authorization: "Bearer " + req.session.repoToken, Accept: "application/vnd.github+json", "Content-Type": "application/json", "X-GitHub-Api-Version": "2022-11-28" },
      body: JSON.stringify({ message: "Update store products from admin panel", content, sha: current.sha, branch: "main" })
    });
    const result = await updateResponse.json();
    if (!updateResponse.ok) {
      console.error("GitHub write failed:", result.message || updateResponse.status);
      return res.status(502).json({ error: "ذخیره در GitHub انجام نشد؛ دسترسی مخزن را بررسی کن." });
    }
    res.json({ ok: true, message: "محصولات در GitHub ذخیره شدند؛ انتشار سایت با اجرای Pages انجام می‌شود." });
  } catch (error) {
    console.error("Save products failed:", error.message);
    res.status(500).json({ error: "ذخیرهٔ محصولات ناموفق بود." });
  }
});

app.post("/auth/logout", (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("mesgallery.sid", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" });
    res.json({ ok: true });
  });
});

app.listen(PORT, () => console.log(`Mes Gallery backend listening on port ${PORT}`));
