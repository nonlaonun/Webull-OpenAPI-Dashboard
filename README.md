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
| `APP_SECRET` | App Secret คู่กับ APP_KEY
| `ACCESS_TOKEN` | Token สำหรับเรียก API อื่นๆ ได้จาก endpoint `/create-token` แล้วยืนยันผ่าน SMS ในแอป Webull ก่อน |
| `PORT` | พอร์ตที่ backend server จะรัน (ค่า default คือ 3001) |

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

- **สร้าง signature (HMAC-SHA1)** ให้อัตโนมัติทุกครั้งที่เรียก Webull API
- **ไม่มีหน้า UI ให้ดูตรงๆ** เป็น API endpoint ล้วนๆ ต้องเรียกผ่าน browser/Postman/curl หรือให้ frontend เรียกผ่าน `/api`

**Endpoint ที่ใช้งานได้บนพอร์ตนี้:**

| Endpoint | คำอธิบาย |
|---|---|
| `POST/GET /create-token` | สร้าง Access Token ใหม่ (ใช้ APP_KEY + APP_SECRET) |
| `GET /snapshot` | ราคาล่าสุดของหุ้น (snapshot) |
| `GET /bars` | ราคาย้อนหลัง (OHLC) สำหรับกราฟแท่งเทียน |
| `GET /quotes` | ราคาเสนอซื้อ-ขาย (bid/ask) |
| `GET /tick` | ข้อมูล tick การซื้อขายล่าสุด |
| `GET /footprint` | ข้อมูล footprint หุ้น |
| `GET /company-profile` | ข้อมูลโปรไฟล์บริษัท |
| `GET /analyst-target-price` | ราคาเป้าหมายจากนักวิเคราะห์ |
| `GET /analyst-rating` | คำแนะนำ Buy/Sell/Hold จากนักวิเคราะห์ |
| `GET /positions` | รายการหุ้นที่ถือครองในพอร์ต |
| `GET /balance` | ยอดเงินและมูลค่าสินทรัพย์ในบัญชี |
| `GET /account` | Account ID ปัจจุบันที่ระบบดึงอัตโนมัติ |
| `GET /check-status` | ตรวจสอบสถานะ server ว่าออนไลน์อยู่ |
| `GET /orders` | ประวัติคำสั่งซื้อขาย |


ตัวอย่างเรียกทดสอบ API Endpoint:
| Endpoint                                                                                               | คำอธิบาย                                                                                                                               |
| ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| http://localhost:3001/check-status                                                                     | ตรวจสอบว่า server ออนไลน์อยู่หรือไม่ พร้อมแสดง Account ID ที่ระบบดึงมาอัตโนมัติตอน startup                                             |
| http://localhost:3001/create-token                                                                     | สร้าง Access Token ใหม่ (ใช้แค่ APP_KEY + APP_SECRET) ผลลัพธ์จะได้ token ที่มีสถานะ PENDING ต้องยืนยัน SMS ในแอป Webull ก่อนใช้งานจริง |
| http://localhost:3001/account                                                                          | ดู Account ID ปัจจุบันที่ระบบใช้อยู่ (ดึงมาอัตโนมัติจาก /openapi/account/list ตอน server เริ่มทำงาน)                                   |
| http://localhost:3001/positions                                                                        | ดูรายการหุ้นทั้งหมดที่ถือครองอยู่ในพอร์ต พร้อมจำนวนหุ้นและราคาต้นทุน                                                                   |
| http://localhost:3001/balance                                                                          | ดูยอดเงินสดคงเหลือและมูลค่าสินทรัพย์รวมในบัญชี                                                                                         |
| http://localhost:3001/orders?page_size=50                                                              | ดูประวัติคำสั่งซื้อขาย จำกัดผลลัพธ์ 50 รายการล่าสุด (เปลี่ยนเลขได้ตามต้องการ)                                                          |
| http://localhost:3001/snapshot?symbols=AAPL&category=US_STOCK                                          | ดูราคาล่าสุดของหุ้น AAPL แบบ real-time snapshot (ราคาปัจจุบัน, high/low วันนี้)                                                        |
| http://localhost:3001/bars?symbol=AAPL&category=US_STOCK&timespan=D&count=1200&real_time_required=true | ดึงข้อมูลราคาย้อนหลังแบบ OHLC (เปิด/สูง/ต่ำ/ปิด) ของ AAPL รายวัน 1200 แท่ง ใช้วาดกราฟแท่งเทียน                                         |
| http://localhost:3001/quotes?symbol=AAPL&category=US_STOCK&depth=1                                     | ดูราคาเสนอซื้อ-ขาย (bid/ask) ของ AAPL ความลึกระดับ 1 (ราคาที่ดีที่สุดฝั่งซื้อและขาย)                                                   |
| http://localhost:3001/tick?symbol=AAPL&category=US_STOCK&count=30&trading_sessions=RTH                 | ดูรายการซื้อขายล่าสุด (tick-by-tick) ของ AAPL 30 รายการ ในช่วงเวลาซื้อขายปกติ (Regular Trading Hours)                                  |
| http://localhost:3001/footprint?symbols=AAPL&category=US_STOCK&timespan=M1&count=200                   | ดูข้อมูล footprint (ปริมาณการซื้อ-ขายในแต่ละระดับราคา) ของ AAPL ช่วงเวลา 1 นาที 200 แท่ง                                               |
| http://localhost:3001/company-profile?symbol=AAPL&category=US_STOCK                                    | ดูข้อมูลโปรไฟล์บริษัท AAPL เช่น ชื่อบริษัท, CEO, จำนวนพนักงาน, อุตสาหกรรม, ที่อยู่บริษัท                                               |
| http://localhost:3001/analyst-target-price?symbol=AAPL&category=US_STOCK                               | ดูราคาเป้าหมายจากนักวิเคราะห์ของ AAPL (ราคาสูงสุด, ต่ำสุด, เฉลี่ย, มัธยฐาน)                                                            |
| http://localhost:3001/analyst-rating?symbol=AAPL&category=US_STOCK                                     | ดูคำแนะนำจากนักวิเคราะห์ต่อ AAPL แบ่งเป็น Strong Buy, Buy, Hold, Sell, Underperform พร้อมจำนวนนักวิเคราะห์ที่ให้ความเห็น               |
