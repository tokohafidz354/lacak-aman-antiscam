# Lacak Aman Anti-Scam

Web/PWA untuk membantu pemeriksaan awal penipuan online, pengelolaan kasus dan bukti, serta berbagi lokasi GPS berbasis persetujuan.

## Prinsip penting

- Nomor HP saja tidak dapat digunakan aplikasi ini untuk menentukan GPS perangkat atau status terakhir aktif WhatsApp.
- Pemeriksaan sumber resmi pada MVP dicatat secara manual; belum ada integrasi API otomatis.
- Lokasi hanya dibaca pada perangkat yang menjalankan aplikasi setelah pengguna menekan tombol mulai dan menyetujui izin lokasi browser.
- Data yang belum terhubung ke backend tidak akan ditampilkan sebagai data nyata.

## Menjalankan proyek

```bash
npm install
npm run dev
```

## Status awal

UI MVP dan alur sisi-klien akan dibangun terlebih dahulu. Backend autentikasi, database, private storage, serta kebijakan akses perlu dikonfigurasi dan diuji sebelum digunakan untuk menyimpan data sensitif secara produksi.

## Sumber resmi

- https://aduannomor.id/
- https://cekrekening.id/
- https://iasc.ojk.go.id/
