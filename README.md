
# 📊 Webull Portfolio Dashboard

แดชบอร์ดแสดงข้อมูลพอร์ตการลงทุนแบบเรียลไทม์ เชื่อมต่อกับ Webull OpenAPI แสดงข้อมูลหุ้นในพอร์ต, ยอดเงินคงเหลือ, ประวัติคำสั่งซื้อขาย, กราฟราคาหุ้นย้อนหลัง, โปรไฟล์บริษัท, ราคาเป้าหมายจากนักวิเคราะห์ และคำแนะนำการลงทุน

---

## 🚀 เริ่มใช้งาน

### 1. ติดตั้ง Node.js

โหลดและติดตั้ง Node.js เวอร์ชัน 18 ขึ้นไปจาก [nodejs.org](https://nodejs.org)

ตรวจสอบว่าติดตั้งสำเร็จด้วยคำสั่ง:

```bash
node -v
npm -v
```

### 2. ติดตั้ง Dependencies

Clone หรือดาวน์โหลดโปรเจกต์นี้มาไว้ในเครื่อง แล้วเปิด terminal ที่ root โปรเจกต์ รันคำสั่ง:

```bash
npm i
```

คำสั่งนี้จะติดตั้งทั้ง dependency ของ frontend (React, Chart.js ฯลฯ) และ backend (Express, dotenv ฯลฯ) ให้ครบตาม `package.json`

### 3. ตั้งค่า API Key ใน Environment File

ในไฟล์ชื่อ `.env` ที่ root โปรเจกต์ (ระดับเดียวกับ `package.json`) ใส่ Webull API Key:

```env
APP_KEY=your_app_key_here
APP_SECRET=your_app_secret_here
ACCESS_TOKEN=your_access_token_here
PORT=3001
```

| ตัวแปร | คำอธิบาย |
|---|---|
| `APP_KEY` | App Key ที่ได้จาก Webull Developer Console |
| `APP_SECRET` | App Secret ที่ใช้คู่กับ `APP_KEY` |
| `ACCESS_TOKEN` | Token สำหรับเรียก API อื่น ๆ โดยสร้างผ่าน endpoint `/create-token` แล้วทำการยืนยันผ่าน SMS ในแอป Webull ก่อนใช้งานจริง |
| `PORT` | พอร์ตที่ backend server จะรัน (ค่าเริ่มต้นคือ `3001`) |

> **หมายเหตุ:** อย่า commit ไฟล์ `.env` หรือเปิดเผย `APP_SECRET` และ `ACCESS_TOKEN` ต่อสาธารณะ

### 4. รันโปรเจกต์

```bash
npm run dev
```

คำสั่งนี้จะรันทั้ง 2 ฝั่งพร้อมกัน:
- **Backend (Express proxy server)** ที่ `http://localhost:3001`
- **Frontend (React + Vite dev server)** ที่ `http://localhost:5173`

เปิด browser ไปที่ `http://localhost:5173` เพื่อดูแดชบอร์ด

---

## 🌐 Localhost แต่ละพอร์ตทำอะไรได้บ้าง

### `http://localhost:3001` — Backend / API Proxy Server

พอร์ตนี้คือ **Express server** ที่ทำหน้าที่เป็นตัวกลาง (proxy) ระหว่าง frontend กับ Webull OpenAPI จริง โดย:

- สร้าง signature (HMAC-SHA1) ให้อัตโนมัติเมื่อเรียก Webull API
- ไม่มีหน้า UI ให้ดูโดยตรง เป็น API endpoint ต้องเรียกผ่าน browser, Postman, `curl` หรือให้ frontend เรียกผ่าน `/api`
- ใช้ query parameters เพื่อส่ง symbol, category, จำนวนข้อมูล และตัวกรองอื่น ๆ ตาม endpoint ที่ต้องการ

### Endpoint ที่ใช้งานได้

| Endpoint | คำอธิบาย |
|---|---|
| `GET /check-status` | ตรวจสอบว่า server ออนไลน์อยู่หรือไม่ และแสดงสถานะที่ระบบเตรียมไว้ |
| `GET /account` | ดู Account ID ปัจจุบันที่ระบบดึงมาอัตโนมัติ |
| `GET /create-token` | เริ่มสร้าง Access Token โดยใช้ `APP_KEY` และ `APP_SECRET` |
| `POST /create-token` | เริ่มสร้าง Access Token ผ่าน POST request |
| `GET /account-list` | ดูรายการบัญชีที่ API ส่งกลับมา |
| `GET /positions` | ดูรายการหุ้นที่ถือครองในบัญชี |
| `GET /balance` | ดูยอดเงินและมูลค่าสินทรัพย์ในบัญชี |
| `GET /orders` | ดูประวัติคำสั่งซื้อขาย |
| `GET /snapshot` | ดูข้อมูลราคาล่าสุดของหลักทรัพย์ |
| `GET /bars` | ดูข้อมูลราคา OHLC ย้อนหลังสำหรับกราฟ |
| `GET /quotes` | ดูราคาเสนอซื้อและเสนอขาย |
| `GET /tick` | ดูข้อมูลการซื้อขายแบบ tick |
| `GET /footprint` | ดูข้อมูล footprint ของหลักทรัพย์ |
| `GET /company-profile` | ดูข้อมูลโปรไฟล์บริษัท |
| `GET /analyst-target-price` | ดูราคาเป้าหมายจากนักวิเคราะห์ |
| `GET /analyst-rating` | ดูคำแนะนำจากนักวิเคราะห์ |
| `GET /option-contracts` | ดูรายการสัญญา Options |
| `GET /option-tick` | ดูข้อมูล tick ของ Options |
| `GET /option-snapshot` | ดู snapshot ราคาของ Options |
| `GET /option-bars` | ดูข้อมูลราคา Options ย้อนหลัง |
| `GET /income-statement` | ดูงบกำไรขาดทุน |
| `GET /cash-flow-statement` | ดูงบกระแสเงินสด |
| `GET /balance-sheets-statement` | ดูงบดุล |
| `GET /forecast-eps` | ดูประมาณการกำไรต่อหุ้น (EPS) |
| `GET /filings` | ดูเอกสารที่บริษัทยื่นต่อหน่วยงานกำกับดูแล |
| `GET /earnings-calendars` | ดูปฏิทินประกาศผลประกอบการ |
| `GET /dividend-calendars` | ดูปฏิทินเงินปันผล |
| `GET /capital-flows` | ดูข้อมูลกระแสเงินทุน |
| `GET /industry-comparisons` | เปรียบเทียบข้อมูลบริษัทกับบริษัทในอุตสาหกรรม |
| `GET /financial-indicators` | ดูตัวชี้วัดทางการเงิน |
| `GET /financial-alerts` | ดูการแจ้งเตือนหรือข้อมูลเตือนทางการเงิน |
| `GET /fund-brief` | ดูข้อมูลสรุปกองทุน |
| `GET /fund-holdings` | ดูสินทรัพย์ที่กองทุนถือครอง |
| `GET /fund-dividends` | ดูประวัติเงินปันผลของกองทุน |
| `GET /fund-net-values` | ดูมูลค่าทรัพย์สินสุทธิ (NAV) ของกองทุนย้อนหลัง |
| `GET /fund-performances` | ดูผลการดำเนินงานของกองทุน |
| `GET /fund-ratings` | ดูอันดับหรือเรตติ้งกองทุน |
| `GET /fund-splits` | ดูประวัติการแตกหน่วยหรือ split ของกองทุน |
| `GET /fund-files` | ดูเอกสารที่เกี่ยวข้องกับกองทุน |
| `GET /fund-allocations` | ดูสัดส่วนการจัดสรรสินทรัพย์ของกองทุน |

---

## 🧪 ตัวอย่างเรียกทดสอบ API Endpoint ทั้งหมด

ตัวอย่างทั้งหมดใช้ Base URL:

```text
http://localhost:3001
```

ตัวอย่างด้านล่างใช้ `AAPL` เป็นหลักทรัพย์ตัวอย่าง และ `US_STOCK` เป็น category ตัวอย่าง หากต้องการใช้หลักทรัพย์ประเภทอื่น ให้ตรวจสอบ category และพารามิเตอร์ที่ Webull OpenAPI รองรับ

### 1. สถานะระบบและบัญชี

| Endpoint | คำอธิบาย |
|---|---|
| [http://localhost:3001/check-status](http://localhost:3001/check-status) | ตรวจสอบว่า server ออนไลน์อยู่หรือไม่ พร้อมแสดงสถานะที่ระบบเตรียมไว้ |
| [http://localhost:3001/account](http://localhost:3001/account) | ดู Account ID ปัจจุบันที่ระบบใช้อยู่ |
| [http://localhost:3001/account-list](http://localhost:3001/account-list) | ดึงรายการบัญชีที่ API ส่งกลับมา |
| [http://localhost:3001/create-token](http://localhost:3001/create-token) | เริ่มสร้าง Access Token โดยใช้ `APP_KEY` และ `APP_SECRET` ผลลัพธ์อาจเป็น token สถานะ `PENDING` ซึ่งต้องยืนยัน SMS ในแอป Webull ก่อนใช้งานจริง |

> `/create-token` รองรับทั้ง GET และ POST ตามที่กำหนดใน server หากเรียกผ่าน browser จะเป็น GET โดยอัตโนมัติ

### 2. พอร์ตการลงทุนและคำสั่งซื้อขาย

| Endpoint | คำอธิบาย |
|---|---|
| [http://localhost:3001/positions](http://localhost:3001/positions) | ดูรายการหุ้นทั้งหมดที่ถือครองอยู่ในบัญชี พร้อมข้อมูลตำแหน่งการลงทุนที่ API ส่งกลับมา |
| [http://localhost:3001/balance](http://localhost:3001/balance) | ดูยอดเงินสดคงเหลือและมูลค่าสินทรัพย์ในบัญชี |
| [http://localhost:3001/orders](http://localhost:3001/orders) | ดูประวัติคำสั่งซื้อขายตามค่าเริ่มต้นของ endpoint |
| [http://localhost:3001/orders?start_time=2026-01-01&end_time=2026-01-31](http://localhost:3001/orders?start_time=2026-01-01&end_time=2026-01-31) | ดูประวัติคำสั่งซื้อขายภายในช่วงวันที่ที่ระบุ ทั้งนี้รูปแบบวันที่ต้องตรงกับที่ endpoint รองรับ |

> อย่าใช้ `page_size=50` เว้นแต่โค้ดใน `server.js` จะรองรับพารามิเตอร์นี้โดยตรง ตัวอย่างนี้จึงไม่ถือว่า `page_size` เป็นพารามิเตอร์ที่ยืนยันแล้ว

### 3. ข้อมูลราคาหุ้น

| Endpoint | คำอธิบาย |
|---|---|
| [http://localhost:3001/snapshot?symbols=AAPL&category=US_STOCK](http://localhost:3001/snapshot?symbols=AAPL&category=US_STOCK) | ดูข้อมูลราคาล่าสุดของ AAPL เช่น ราคาปัจจุบันและข้อมูลราคาในวันนั้นตามข้อมูลที่ API ส่งกลับ |
| [http://localhost:3001/bars?symbol=AAPL&category=US_STOCK&timespan=D&count=1200&real_time_required=true](http://localhost:3001/bars?symbol=AAPL&category=US_STOCK&timespan=D&count=1200&real_time_required=true) | ดึงข้อมูลราคา OHLC รายวันของ AAPL จำนวนสูงสุดตาม `count` ที่ระบุ เพื่อนำไปวาดกราฟแท่งเทียน |
| [http://localhost:3001/quotes?symbol=AAPL&category=US_STOCK&depth=1](http://localhost:3001/quotes?symbol=AAPL&category=US_STOCK&depth=1) | ดูราคาเสนอซื้อ (bid) และเสนอขาย (ask) ตามระดับความลึกที่ร้องขอ |
| [http://localhost:3001/tick?symbol=AAPL&category=US_STOCK&count=30&trading_sessions=RTH](http://localhost:3001/tick?symbol=AAPL&category=US_STOCK&count=30&trading_sessions=RTH) | ดูรายการซื้อขายแบบ tick ของ AAPL โดยร้องขอ 30 รายการในช่วงเวลาซื้อขายปกติ |
| [http://localhost:3001/footprint?symbols=AAPL&category=US_STOCK&timespan=M1&count=200](http://localhost:3001/footprint?symbols=AAPL&category=US_STOCK&timespan=M1&count=200) | ขอข้อมูล footprint ของ AAPL โดยใช้ช่วงเวลา 1 นาทีและจำนวน 200 ตามพารามิเตอร์ที่ระบุ |

### 4. โปรไฟล์บริษัทและข้อมูลนักวิเคราะห์

| Endpoint | คำอธิบาย |
|---|---|
| [http://localhost:3001/company-profile?symbol=AAPL&category=US_STOCK](http://localhost:3001/company-profile?symbol=AAPL&category=US_STOCK) | ดูข้อมูลบริษัท เช่น ชื่อบริษัท อุตสาหกรรม ที่อยู่ และรายละเอียดอื่น ๆ ที่ API มีให้ |
| [http://localhost:3001/analyst-target-price?symbol=AAPL&category=US_STOCK](http://localhost:3001/analyst-target-price?symbol=AAPL&category=US_STOCK) | ดูราคาเป้าหมายจากนักวิเคราะห์ เช่น ค่าสูงสุด ต่ำสุด ค่าเฉลี่ย หรือค่ามัธยฐาน หากมีในผลลัพธ์ |
| [http://localhost:3001/analyst-rating?symbol=AAPL&category=US_STOCK](http://localhost:3001/analyst-rating?symbol=AAPL&category=US_STOCK) | ดูคำแนะนำจากนักวิเคราะห์ เช่น Buy, Hold หรือ Sell ตามข้อมูลที่ API ส่งกลับ |

### 5. ข้อมูล Options

| Endpoint | คำอธิบาย |
|---|---|
| [http://localhost:3001/option-contracts?symbol=AAPL&category=US_STOCK](http://localhost:3001/option-contracts?symbol=AAPL&category=US_STOCK) | ขอรายการสัญญา Options ที่เกี่ยวข้องกับ AAPL ตามพารามิเตอร์ที่ endpoint รองรับ |
| [http://localhost:3001/option-tick?symbol=AAPL&category=US_STOCK](http://localhost:3001/option-tick?symbol=AAPL&category=US_STOCK) | ขอข้อมูล tick ของสัญญา Options โดยเพิ่มพารามิเตอร์สัญญาที่จำเป็นตาม API หาก endpoint ต้องการ |
| [http://localhost:3001/option-snapshot?symbol=AAPL&category=US_STOCK](http://localhost:3001/option-snapshot?symbol=AAPL&category=US_STOCK) | ขอ snapshot ราคาของ Options โดยเพิ่มรหัสสัญญาหรือพารามิเตอร์ที่จำเป็นตาม API หากต้องระบุ |
| [http://localhost:3001/option-bars?symbol=AAPL&category=US_STOCK](http://localhost:3001/option-bars?symbol=AAPL&category=US_STOCK) | ขอข้อมูลราคา Options ย้อนหลัง โดยเพิ่มรหัสสัญญา ช่วงเวลา และจำนวนแท่งตามที่ API ต้องการ |

> Endpoint กลุ่ม Options อาจต้องใช้รหัสสัญญา Options หรือพารามิเตอร์เฉพาะเพิ่มเติม ไม่ใช่ทุก endpoint จะทำงานได้ด้วย `symbol` และ `category` เพียงสองตัวนี้ ให้ตรวจสอบเงื่อนไขใน `server.js` และเอกสาร Webull OpenAPI ก่อนใช้งานจริง

### 6. งบการเงินและข้อมูลพื้นฐาน

| Endpoint | คำอธิบาย |
|---|---|
| [http://localhost:3001/income-statement?symbol=AAPL&category=US_STOCK](http://localhost:3001/income-statement?symbol=AAPL&category=US_STOCK) | ขอข้อมูลงบกำไรขาดทุนของ AAPL |
| [http://localhost:3001/cash-flow-statement?symbol=AAPL&category=US_STOCK](http://localhost:3001/cash-flow-statement?symbol=AAPL&category=US_STOCK) | ขอข้อมูลงบกระแสเงินสดของ AAPL |
| [http://localhost:3001/balance-sheets-statement?symbol=AAPL&category=US_STOCK](http://localhost:3001/balance-sheets-statement?symbol=AAPL&category=US_STOCK) | ขอข้อมูลงบดุลของ AAPL |
| [http://localhost:3001/forecast-eps?symbol=AAPL&category=US_STOCK](http://localhost:3001/forecast-eps?symbol=AAPL&category=US_STOCK) | ดูประมาณการกำไรต่อหุ้น (EPS) ของ AAPL |
| [http://localhost:3001/filings?symbol=AAPL&category=US_STOCK](http://localhost:3001/filings?symbol=AAPL&category=US_STOCK) | ดูเอกสารที่บริษัท AAPL ยื่นต่อหน่วยงานกำกับดูแล |
| [http://localhost:3001/earnings-calendars?symbol=AAPL&category=US_STOCK](http://localhost:3001/earnings-calendars?symbol=AAPL&category=US_STOCK) | ดูข้อมูลปฏิทินประกาศผลประกอบการของ AAPL |
| [http://localhost:3001/dividend-calendars?symbol=AAPL&category=US_STOCK](http://localhost:3001/dividend-calendars?symbol=AAPL&category=US_STOCK) | ดูข้อมูลปฏิทินเงินปันผลของ AAPL |
| [http://localhost:3001/capital-flows?symbol=AAPL&category=US_STOCK](http://localhost:3001/capital-flows?symbol=AAPL&category=US_STOCK) | ขอข้อมูลกระแสเงินทุนที่เกี่ยวข้องกับ AAPL |
| [http://localhost:3001/industry-comparisons?symbol=AAPL&category=US_STOCK](http://localhost:3001/industry-comparisons?symbol=AAPL&category=US_STOCK) | เปรียบเทียบข้อมูลของ AAPL กับบริษัทอื่นในอุตสาหกรรม |
| [http://localhost:3001/financial-indicators?symbol=AAPL&category=US_STOCK](http://localhost:3001/financial-indicators?symbol=AAPL&category=US_STOCK) | ขอข้อมูลตัวชี้วัดทางการเงินของ AAPL |
| [http://localhost:3001/financial-alerts?symbol=AAPL&category=US_STOCK](http://localhost:3001/financial-alerts?symbol=AAPL&category=US_STOCK) | ขอข้อมูลแจ้งเตือนทางการเงินที่เกี่ยวข้องกับ AAPL |

> ตัวอย่างพารามิเตอร์ของกลุ่มข้อมูลการเงินอาจแตกต่างกันตาม endpoint และการตั้งค่า proxy ใน `server.js` โปรดตรวจสอบพารามิเตอร์ที่โค้ดส่งต่อไปยัง Webull OpenAPI ก่อนนำไปใช้จริง

### 7. ข้อมูลกองทุน

| Endpoint | คำอธิบาย |
|---|---|
| [http://localhost:3001/fund-brief?symbol=SPY](http://localhost:3001/fund-brief?symbol=SPY) | ขอข้อมูลสรุปของกองทุน SPY |
| [http://localhost:3001/fund-holdings?symbol=SPY](http://localhost:3001/fund-holdings?symbol=SPY) | ดูสินทรัพย์หรือหลักทรัพย์ที่กองทุน SPY ถือครอง |
| [http://localhost:3001/fund-dividends?symbol=SPY](http://localhost:3001/fund-dividends?symbol=SPY) | ดูประวัติเงินปันผลของกองทุน SPY |
| [http://localhost:3001/fund-dividends?symbol=SPY&pagination_key=YOUR_PAGINATION_KEY](http://localhost:3001/fund-dividends?symbol=SPY&pagination_key=YOUR_PAGINATION_KEY) | ดึงข้อมูลเงินปันผลหน้าถัดไปโดยใช้ pagination key ที่ได้จากผลลัพธ์ก่อนหน้า |
| [http://localhost:3001/fund-net-values?symbol=SPY](http://localhost:3001/fund-net-values?symbol=SPY) | ดูประวัติมูลค่าทรัพย์สินสุทธิ (NAV) ของกองทุน |
| [http://localhost:3001/fund-net-values?symbol=SPY&count=20&last_date=2026-01-01](http://localhost:3001/fund-net-values?symbol=SPY&count=20&last_date=2026-01-01) | ขอข้อมูล NAV โดยระบุจำนวนและวันที่ล่าสุดที่ต้องการ ทั้งนี้ต้องใช้รูปแบบวันที่ที่ endpoint รองรับ และ `count` จำกัดได้สูงสุด 20 ตามข้อกำหนดใน proxy |
| [http://localhost:3001/fund-performances?symbol=SPY](http://localhost:3001/fund-performances?symbol=SPY) | ดูข้อมูลผลการดำเนินงานของกองทุน |
| [http://localhost:3001/fund-ratings?symbol=SPY](http://localhost:3001/fund-ratings?symbol=SPY) | ดูอันดับหรือเรตติ้งของกองทุน |
| [http://localhost:3001/fund-splits?symbol=SPY](http://localhost:3001/fund-splits?symbol=SPY) | ดูประวัติการ split หรือการเปลี่ยนแปลงจำนวนหน่วยของกองทุน หากมีข้อมูล |
| [http://localhost:3001/fund-files?symbol=SPY](http://localhost:3001/fund-files?symbol=SPY) | ดูเอกสารที่เกี่ยวข้องกับกองทุน |
| [http://localhost:3001/fund-allocations?symbol=SPY](http://localhost:3001/fund-allocations?symbol=SPY) | ดูข้อมูลการจัดสรรสินทรัพย์ของกองทุน |

---

## 🧭 วิธีเรียก API

### เรียกผ่าน Browser

สำหรับ endpoint แบบ `GET` สามารถคัดลอก URL ตัวอย่างไปวางใน browser ได้โดยตรง เช่น:

```text
http://localhost:3001/snapshot?symbols=AAPL&category=US_STOCK
```

### เรียกผ่าน curl

ตัวอย่างเรียกข้อมูลราคาหุ้น:

```bash
curl "http://localhost:3001/snapshot?symbols=AAPL&category=US_STOCK"
```

ตัวอย่างเรียกข้อมูลบัญชี:

```bash
curl "http://localhost:3001/account"
```

### เรียกผ่าน Postman

1. เปิด Postman แล้วสร้าง request ใหม่
2. เลือก method ให้ตรงกับ endpoint (`GET` หรือ `POST`)
3. ใส่ URL เช่น `http://localhost:3001/check-status`
4. กรอก query parameters หากจำเป็น
5. กด **Send** เพื่อดูผลลัพธ์

สำหรับ `/create-token` หากต้องการใช้ POST ให้เลือก method เป็น `POST` และส่ง body เฉพาะตามรูปแบบที่โค้ดใน `server.js` กำหนด

---

## ⚠️ หมายเหตุและการแก้ปัญหาเบื้องต้น

- ตรวจสอบว่า backend ทำงานอยู่ที่ `http://localhost:3001` ก่อนเรียก endpoint
- ตรวจสอบค่า `APP_KEY`, `APP_SECRET` และ `ACCESS_TOKEN` ใน `.env`
- หาก token ยังอยู่ในสถานะ `PENDING` ให้ดำเนินการยืนยันตามขั้นตอนในแอป Webull ก่อน
- ตรวจสอบว่า `symbol`, `category` และพารามิเตอร์อื่น ๆ ตรงกับประเภทสินทรัพย์และข้อกำหนดของ endpoint
- ข้อมูลที่ได้ขึ้นอยู่กับสิทธิ์ API, market data subscription, สถานะตลาด และความพร้อมให้บริการของ Webull ไม่ควรถือว่าทุก endpoint จะให้ข้อมูล real-time ในทุกบัญชี
- หากได้ HTTP error หรือ response error ให้ตรวจสอบข้อความตอบกลับจาก API และ log ใน terminal ของ backend
- อย่าส่ง `APP_SECRET`, `ACCESS_TOKEN` หรือข้อมูลบัญชีส่วนตัวขึ้น repository สาธารณะ

---

## 🔐 Security

- เก็บไฟล์ `.env` ไว้ในเครื่องและเพิ่มไฟล์นี้ลงใน `.gitignore`
- ห้ามเผยแพร่ `APP_SECRET` และ `ACCESS_TOKEN`
- หาก token หรือ secret รั่วไหล ให้ดำเนินการเปลี่ยนหรือเพิกถอนตามขั้นตอนที่ Webull รองรับ
- ใช้ proxy ฝั่ง backend เพื่อไม่ให้ secret ถูกเปิดเผยใน frontend

---

## 📚 เอกสารอ้างอิง

- [Node.js](https://nodejs.org)
- [Webull Developer Portal](https://developer.webull.com/)
