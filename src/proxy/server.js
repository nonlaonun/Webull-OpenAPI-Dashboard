// src/proxy/server.js
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import crypto from 'crypto';

const app = express();
app.use(cors());
app.use(express.json());

// ---------- Config from ENV ----------
const APP_KEY = process.env.APP_KEY || "";
const APP_SECRET = process.env.APP_SECRET || "";
const ACCESS_TOKEN = process.env.ACCESS_TOKEN || "";
const BASE_URL = "https://api.webull.co.th/";
const HOST = "api.webull.co.th";

let DEFAULT_ACCOUNT_ID = "";

// ---------- Cache ----------
const cache = {};
const CACHE_TTL = 3 * 1000;
const CLEANUP_INTERVAL = 5 * 60 * 1000;

function getCache(key) {
    const entry = cache[key];
    if (!entry) return null;
    if (Date.now() > entry.expiry) {
        delete cache[key];
        return null;
    }
    return entry.data;
}

function setCache(key, data, ttl = CACHE_TTL) {
    cache[key] = { data, expiry: Date.now() + ttl };
}

setInterval(() => {
    const now = Date.now();
    for (const key in cache) {
        if (cache[key].expiry <= now) delete cache[key];
    }
}, CLEANUP_INTERVAL);

// ---------- Throttle Queue ----------
let lastCallTime = 0;
const MIN_INTERVAL_MS = 1100;
let queue = Promise.resolve();

function throttle(fn) {
    const run = async () => {
        const now = Date.now();
        const wait = Math.max(0, MIN_INTERVAL_MS - (now - lastCallTime));
        if (wait > 0) await new Promise((r) => setTimeout(r, wait));
        lastCallTime = Date.now();
        return fn();
    };
    const result = queue.then(run, run);
    queue = result.catch(() => {});
    return result;
}

// ---------- Signature Logic ----------
function generateSignature(path, queryParams, bodyStr, appKey, appSecret, timestamp, nonce, host, algorithm = "HMAC-SHA1") {
    const allParams = {};
    Object.entries(queryParams).forEach(([k, v]) => {
        allParams[k] = String(v);
    });

    allParams["host"] = host;
    allParams["x-app-key"] = appKey;
    allParams["x-signature-algorithm"] = algorithm;
    allParams["x-signature-nonce"] = nonce;
    allParams["x-signature-version"] = "1.0";
    allParams["x-timestamp"] = timestamp;

    const str1 = Object.keys(allParams).sort().map((k) => `${k}=${allParams[k]}`).join("&");

    let str3;
    if (bodyStr) {
        const str2 = crypto.createHash("md5").update(bodyStr).digest("hex").toUpperCase();
        str3 = `${path}&${str1}&${str2}`;
    } else {
        str3 = `${path}&${str1}`;
    }

    const encodedString = encodeURIComponent(str3).replace(
        /[!'()*]/g,
        (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase()
    );

    const key = `${appSecret}&`;
    const hashAlgo = algorithm === "HMAC-SHA1" ? "sha1" : "sha256";
    return crypto.createHmac(hashAlgo, key).update(encodedString).digest("base64");
}

function generateTimestamp() {
    return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
}

function generateNonce() {
    return crypto.randomUUID().replace(/-/g, "");
}

// ---------- Generic Webull API Caller ----------
async function callWebullApi(path, queryParams, bodyStr = "", options = {}) {
    const { method = null, skipCache = false } = options;

    const cacheKey = `${path}?${JSON.stringify(queryParams)}`;
    if (!skipCache) {
        const cached = getCache(cacheKey);
        if (cached) return cached;
    }

    const doCall = async (retriesLeft = 2) => {
        const timestamp = generateTimestamp();
        const nonce = generateNonce();

        const signature = generateSignature(
            path, queryParams, bodyStr, APP_KEY, APP_SECRET, timestamp, nonce, HOST, "HMAC-SHA1"
        );

        const headers = {
            Accept: "application/json",
            "x-app-key": APP_KEY,
            "x-app-secret": APP_SECRET,
            "x-timestamp": timestamp,
            "x-signature-version": "1.0",
            "x-signature-algorithm": "HMAC-SHA1",
            "x-signature-nonce": nonce,
            "x-version": "v2",
            "x-signature": signature,
            ...(ACCESS_TOKEN ? { "x-access-token": ACCESS_TOKEN } : {}),
            ...(bodyStr ? { "Content-Type": "application/json" } : {}),
        };

        const url = new URL(`${BASE_URL}${path}`);
        Object.entries(queryParams).forEach(([k, v]) => url.searchParams.append(k, v));

        const httpMethod = method || (bodyStr ? "POST" : "GET");

        const resp = await fetch(url.toString(), {
            method: httpMethod,
            headers,
            body: bodyStr || undefined,
        });

        const data = await resp.json();
        const isRateLimited =
            resp.status === 429 || (typeof data?.message === "string" && data.message.toLowerCase().includes("rate"));

        if (isRateLimited && retriesLeft > 0) {
            await new Promise((r) => setTimeout(r, 1200));
            return doCall(retriesLeft - 1);
        }

        return { statusCode: resp.status, data };
    };

    const result = await throttle(() => doCall());
    if (!skipCache && result.statusCode === 200) {
        setCache(cacheKey, result);
    }
    return result;
}

// ---------- Auto-fetch Account ID on Startup ----------
async function initAccountId() {
    try {
        console.log("[Init] Fetching account list...");
        const { statusCode, data } = await callWebullApi("/openapi/account/list", {});
        if (statusCode === 200 && Array.isArray(data) && data.length > 0) {
            DEFAULT_ACCOUNT_ID = data[0].account_id;
            console.log(`[Init] DEFAULT_ACCOUNT_ID set to: ${DEFAULT_ACCOUNT_ID}`);
        } else {
            console.warn("[Init] Failed to fetch account_id:", statusCode, data);
        }
    } catch (err) {
        console.error("[Init] Error fetching account list:", err.message);
    }
}

// ---------- Helper: build params from req.query with defaults ----------
function buildParams(req, defaults) {
    const params = {};
    for (const key in defaults) {
        params[key] = req.query[key] !== undefined ? req.query[key] : defaults[key];
    }
    for (const key in req.query) {
        if (!(key in params)) {
            params[key] = req.query[key];
        }
    }
    return params;
}

// ---------- Create Token Endpoint ----------
// สร้าง Access Token ใหม่ ใช้แค่ APP_KEY + APP_SECRET (ไม่ต้องมี ACCESS_TOKEN เดิม)
// Rate limit ฝั่ง Webull: 10 requests / 30 วินาที ดังนั้นไม่ cache ผลลัพธ์นี้
async function handleCreateToken(req, res) {
    if (!APP_KEY || !APP_SECRET) {
        return res.status(400).json({
            error_code: "MISSING_CREDENTIALS",
            message: "APP_KEY หรือ APP_SECRET ไม่ถูกตั้งค่าใน .env",
        });
    }

    const { statusCode, data } = await callWebullApi(
        "/openapi/auth/token/create",
        {},
        "",
        { method: "POST", skipCache: true }
    );

    res.status(statusCode).json(data);
}

app.post('/create-token', handleCreateToken);
app.get('/create-token', handleCreateToken); // เผื่อทดสอบผ่าน browser ได้เลย

// ---------- Market Data Endpoints ----------
app.get('/snapshot', async (req, res) => {
    const params = buildParams(req, {
        symbols: "NVDA",
        category: "US_STOCK",
        extend_hour_required: "false",
        overnight_required: "false",
    });
    const { statusCode, data } = await callWebullApi("/openapi/market-data/stock/snapshot", params);
    res.status(statusCode).json(data);
});

app.get('/bars', async (req, res) => {
    const params = buildParams(req, {
        symbol: "AAPL",
        category: "US_STOCK",
        timespan: "M1",
        count: "200",
        real_time_required: "true",
    });
    const { statusCode, data } = await callWebullApi("/openapi/market-data/stock/bars", params);
    res.status(statusCode).json(data);
});

app.get('/quotes', async (req, res) => {
    const params = buildParams(req, {
        symbol: "AAPL",
        category: "US_STOCK",
        depth: "1",
        overnight_required: "false",
    });
    const { statusCode, data } = await callWebullApi("/openapi/market-data/stock/quotes", params);
    res.status(statusCode).json(data);
});

app.get('/tick', async (req, res) => {
    const params = buildParams(req, {
        symbol: "AAPL",
        category: "US_STOCK",
        count: "30",
        trading_sessions: "RTH",
    });
    const { statusCode, data } = await callWebullApi("/openapi/market-data/stock/tick", params);
    res.status(statusCode).json(data);
});

app.get('/footprint', async (req, res) => {
    const params = buildParams(req, {
        symbols: "AAPL",
        category: "US_STOCK",
        timespan: "M1",
        count: "200",
        real_time_required: "false",
    });
    const { statusCode, data } = await callWebullApi("/openapi/market-data/stock/footprint", params);
    res.status(statusCode).json(data);
});

// ---------- Instrument / Company Info Endpoints ----------
app.get('/company-profile', async (req, res) => {
    const params = buildParams(req, {
        symbol: "AAPL",
        category: "US_STOCK",
    });
    const { statusCode, data } = await callWebullApi("/openapi/instrument/company/profile", params);
    res.status(statusCode).json(data);
});

app.get('/analyst-target-price', async (req, res) => {
    const params = buildParams(req, {
        symbol: "AAPL",
        category: "US_STOCK",
    });
    const { statusCode, data } = await callWebullApi("/openapi/instrument/analyst/target-price", params);
    res.status(statusCode).json(data);
});

app.get('/analyst-rating', async (req, res) => {
    const params = buildParams(req, {
        symbol: "AAPL",
        category: "US_STOCK",
    });
    const { statusCode, data } = await callWebullApi("/openapi/instrument/analyst/rating", params);
    res.status(statusCode).json(data);
});

// ---------- Account / Assets Endpoints ----------
app.get('/positions', async (req, res) => {
    const { statusCode, data } = await callWebullApi("/openapi/assets/positions", {
        account_id: req.query.account_id || DEFAULT_ACCOUNT_ID,
    });
    res.status(statusCode).json(data);
});

app.get('/balance', async (req, res) => {
    const { statusCode, data } = await callWebullApi("/openapi/assets/balance", {
        account_id: req.query.account_id || DEFAULT_ACCOUNT_ID,
    });
    res.status(statusCode).json(data);
});

app.get('/account', (req, res) => {
    res.status(200).json({ account_id: DEFAULT_ACCOUNT_ID });
});

app.get('/check-status', (req, res) => {
    res.status(200).json({ status: 200, message: 'OK', account_id: DEFAULT_ACCOUNT_ID });
});

app.get('/orders', async (req, res) => {
    const params = {
        account_id: req.query.account_id || DEFAULT_ACCOUNT_ID,
    };
    if (req.query.start_date) params.start_date = req.query.start_date;
    if (req.query.page_size) params.page_size = req.query.page_size;
    if (req.query.last_client_order_id) params.last_client_order_id = req.query.last_client_order_id;

    const { statusCode, data } = await callWebullApi("/openapi/trade/order/history", params);
    res.status(statusCode).json(data);
});

// ---------- Start Server ----------
const PORT = process.env.PORT || 3001;

initAccountId().then(() => {
    app.listen(PORT, () => {
        console.log(`[Server] Running on port ${PORT}`);
    });
});
