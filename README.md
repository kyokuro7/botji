# XAGENT AI Studio

Generate kode pakai AI, langsung preview di web.

## Fitur
- Dua mode: Website dan Bot Telegram
- Mode Bot Telegram menghasilkan kode bot asli (index.js / bot.py + dependensi + .env.example) plus bot.json untuk preview simulasi
- Sesi tanya sebelum generate: AI menyiapkan pertanyaan pilihan ganda, user memilih jawaban lalu menekan Kirim (bisa dimatikan lewat centang "Tanya dulu")
- Export chat (.json) dan Import chat untuk melanjutkan percakapan sebelumnya
- Output multi-file (index.html + style.css + script.js)
- Preview website lewat iframe sandbox
- Preview bot Telegram sebagai simulasi chat dari bot.json
- API key disimpan di localStorage browser, diteruskan lewat serverless proxy
- Riwayat chat tersimpan otomatis di localStorage

## Deploy ke Vercel
1. Push folder ini ke repo GitHub.
2. Import repo di vercel.com.
3. Framework terdeteksi Next.js. Deploy. Tidak perlu environment variable.
4. Buka situs, isi provider, model, dan API key di panel Setelan.

## Test lokal
```bash
npm install
npm run dev
