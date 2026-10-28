# XAGENT AI Studio

Generate kode pakai AI, langsung preview di web.

## Fitur
- Dua mode: Website dan Bot Telegram
- Output multi-file (index.html + style.css + script.js)
- Preview website lewat iframe sandbox
- Preview bot Telegram sebagai simulasi chat dari bot.json
- API key disimpan di localStorage browser, diteruskan lewat serverless proxy
- Simpan riwayat chat di localStorage, download jadi satu file .md

## Deploy ke Vercel
1. Push folder ini ke repo GitHub.
2. Import repo di vercel.com.
3. Framework terdeteksi Next.js. Deploy. Tidak perlu environment variable.
4. Buka situs, isi provider, model, dan API key di panel Setelan.

## Test lokal
```bash
npm install
npm run dev
