# Xiaozhi Music Tools Server - NO DEMO FIX

Bản này đã xóa `local-demo`. Nếu chưa cấu hình nguồn nhạc thật hoặc chưa thêm MP3 riêng, `/music/play?q=...` sẽ trả `ok:false`, không trả demo giả nữa.

## Kiểm tra nguồn nhạc

Mở:

```txt
/debug/music-sources
```

Nếu `hasZingApiBase:false`, `hasNctApiBase:false`, `hasSoundCloudApiBase:false` nghĩa là server chưa nối nguồn nhạc online. Cần thêm biến môi trường trên Render, ví dụ:

```txt
ZING_API_BASE=https://server-zing-api-khac.onrender.com
```

Hoặc thêm nhạc MP3 của bạn vào `public/music` và khai báo trong `public/music/catalog.json`.

---

# Xiaozhi / AIBI Music + Tools Server for Render

Server Node.js dùng cho Xiaozhi/ESP32/AIBI. Bản này có 2 nhóm chức năng:

1. **Nhạc**: tìm/phát nhạc local, proxy stream, nối upstream Zing/SoundCloud/Nhaccuatui nếu bạn có API riêng.
2. **Tiện ích**: giá vàng, xổ số miền Bắc, thời tiết, coin, tin tức, endpoint hỏi nhanh cho firmware.

> Lưu ý: Các nguồn public như Zing, giá vàng, xổ số, RSS tin tức có thể đổi định dạng. Server đã viết theo kiểu dễ thay nguồn bằng biến môi trường trên Render.

---

## Chạy local

```bash
npm install
npm start
```

Mặc định chạy ở:

```txt
http://localhost:5555
```

Kiểm tra server sống:

```txt
http://localhost:5555/health
```

---

## Deploy lên Render

1. Giải nén ZIP.
2. Upload toàn bộ lên GitHub.
3. Vào Render > New > Web Service > chọn repo.
4. Dùng cấu hình:

```txt
Build Command: npm install
Start Command: npm start
```

Sau khi có domain Render, thêm biến môi trường:

```txt
PUBLIC_BASE_URL=https://ten-server-cua-ban.onrender.com
```

---

# API nhạc

## Tìm bài

```txt
GET /music/search?q=lac%20troi
```

## Phát bài theo tên

```txt
GET /music/play?q=lac%20troi
```

Firmware Xiaozhi nên lấy trường `url` hoặc `stream` trong JSON để phát.

## Stream bài theo ID

```txt
GET /music/stream/:id
```

## Proxy link MP3 trực tiếp

```txt
GET /music/proxy?url=https://example.com/song.mp3
```

---

# Thêm nhạc riêng

Cho file `.mp3` vào:

```txt
public/music/
```

Sửa:

```txt
public/music/catalog.json
```

Ví dụ:

```json
[
  {
    "id": "bao-thuc-minion",
    "title": "New Minion Wake Up",
    "artist": "Alarm",
    "file": "New Minion Wake Up-nhacchuong123.com.mp3",
    "keywords": ["bao thuc", "wake up", "minion"]
  }
]
```

Test:

```txt
/music/play?q=bao%20thuc
```

---

# API tiện ích cho Xiaozhi

## Liệt kê chức năng

```txt
GET /api/tools
```

## Giá vàng

```txt
GET /api/gold
GET /api/gold?type=SJL1L10
GET /api/gold?type=DOHNL
```

Mặc định dùng `https://www.vang.today/api/prices`. Có thể đổi nguồn bằng biến môi trường:

```txt
GOLD_API_BASE=https://www.vang.today
```

Một số mã vàng thường dùng:

```txt
SJL1L10     SJC 9999
SJ9999      Nhẫn SJC
DOHNL       DOJI Hà Nội
DOHCML      DOJI HCM
BTSJC       Bảo Tín SJC
BT9999NTT   Bảo Tín 9999
PQHNVM      PNJ Hà Nội
PQHN24NTT   PNJ 24K
XAUUSD      Vàng thế giới
```

## Xổ số miền Bắc

```txt
GET /api/lottery/xsmb
```

Mặc định đọc RSS:

```txt
LOTTERY_RSS_URL=https://xskt.com.vn/rss-feed/mien-bac-xsmb.rss
```

Nếu bạn có API xổ số riêng, thêm biến môi trường:

```txt
LOTTERY_API_URL=https://api-cua-ban.example/xsmb
```

Khi có `LOTTERY_API_URL`, server sẽ ưu tiên gọi API đó.

## Thời tiết

```txt
GET /api/weather?city=Hanoi
GET /api/weather?city=Phu%20Tho
GET /api/weather?city=Ho%20Chi%20Minh
```

Dùng Open-Meteo, không cần API key.

## Coin / crypto

```txt
GET /api/coin?symbol=BTC
GET /api/coin?symbol=ETH
GET /api/coin?symbol=SOL
GET /api/coin?symbol=DOGE
```

Mặc định dùng CoinGecko public API:

```txt
COINGECKO_API_BASE=https://api.coingecko.com/api/v3
```

Nếu có key CoinGecko demo/pro, thêm:

```txt
COINGECKO_API_KEY=key-cua-ban
```

## Tin tức

```txt
GET /api/news
GET /api/news?category=tin-moi
GET /api/news?category=thoi-su
GET /api/news?category=cong-nghe
GET /api/news?category=kinh-doanh
```

Mặc định đọc RSS VnExpress. Có thể ép nguồn RSS khác:

```txt
NEWS_RSS_URL=https://vnexpress.net/rss/tin-moi-nhat.rss
```

## Endpoint hỏi nhanh cho firmware

Dùng khi Xiaozhi gửi một câu tự nhiên:

```txt
GET /api/speak?q=gia%20vang
GET /api/speak?q=thoi%20tiet%20ha%20noi
GET /api/speak?q=xsmb
GET /api/speak?q=gia%20btc
GET /api/speak?q=tin%20tuc%20cong%20nghe
```

Hoặc:

```txt
GET /api/assistant?q=thoi%20tiet%20ha%20noi
```

Server sẽ trả về trường `text` hoặc `reply` để Xiaozhi đọc bằng TTS.

---

# Biến môi trường nên thêm trên Render

Tối thiểu:

```txt
PUBLIC_BASE_URL=https://ten-server-cua-ban.onrender.com
```

Tùy chọn:

```txt
ZING_API_BASE=https://server-zing-cua-ban.onrender.com
SOUNDCLOUD_API_BASE=https://server-soundcloud-cua-ban.onrender.com
NCT_API_BASE=https://server-nhaccuatui-cua-ban.onrender.com
GOLD_API_BASE=https://www.vang.today
LOTTERY_RSS_URL=https://xskt.com.vn/rss-feed/mien-bac-xsmb.rss
LOTTERY_API_URL=
NEWS_RSS_URL=
COINGECKO_API_KEY=
API_TIMEOUT_MS=9000
```

---

# Endpoint nên gắn vào firmware Xiaozhi

Phát nhạc:

```txt
https://ten-server-cua-ban.onrender.com/music/play?q=<ten bai hat>
```

Hỏi tiện ích:

```txt
https://ten-server-cua-ban.onrender.com/api/speak?q=<cau hoi>
```

Ví dụ:

```txt
/api/speak?q=gia%20vang
/api/speak?q=xsmb
/api/speak?q=thoi%20tiet%20ha%20noi
/api/speak?q=gia%20btc
/api/speak?q=tin%20tuc
```
