# Lacak Aman Anti-Scam

Web/PWA berbahasa Indonesia untuk pencatatan pemeriksaan awal nomor mencurigakan, pengelolaan kasus dan bukti, serta pembacaan GPS perangkat setelah persetujuan pengguna.

## Status implementasi awal

- Dashboard dan navigasi lima bagian.
- Pencatatan nomor HP dalam format internasional +62, dengan status pemeriksaan manual.
- Pengelolaan kasus, status kasus, catatan kronologi, lampiran sementara pada sesi browser, hash SHA-256 jika API kriptografi tersedia, dan ekspor ringkasan TXT.
- Pembacaan koordinat perangkat saat ini setelah persetujuan eksplisit dan izin browser.
- PWA shell dasar dengan manifest dan service worker.

## Menjalankan secara lokal

Membutuhkan Node.js dan npm.

```bash
npm install
npm run dev
```

Build produksi:

```bash
npm run build
npm run preview
```

## Batasan keamanan dan data

Versi pertama ini **belum terhubung ke backend**. Data nomor dan metadata kasus disimpan di penyimpanan lokal browser. Data tidak tersinkronisasi antarperangkat, dapat hilang jika data browser dibersihkan, dan tidak cocok untuk menyimpan bukti sensitif jangka panjang sebelum backend aman disiapkan.

File bukti dibaca dalam sesi browser dan dibuatkan URL sementara untuk pratinjau; konten file tidak diunggah ke server. Ekspor kasus masih berupa TXT, bukan PDF.

Lokasi GPS dibaca satu kali dari browser perangkat yang sedang dipakai. Koordinat tidak dikirim ke server, tidak ditampilkan ke penerima lain, dan bukan cara melacak nomor HP. Status waktu kedaluwarsa hanya penanda UI dan bukan mekanisme berbagi lokasi jaringan.

API resmi untuk memeriksa nomor/rekening belum dikonfigurasi. Hasil harus diperiksa manual melalui sumber resmi di bawah. Tidak ditemukannya laporan pada suatu sumber bukan bukti bahwa nomor aman.

## Sumber resmi

- AduanNomor: https://aduannomor.id/
- CekRekening: https://cekrekening.id/
- Indonesia Anti-Scam Centre: https://iasc.ojk.go.id/
- Pusat Bantuan WhatsApp: https://faq.whatsapp.com/

## Tahap berikutnya sebelum produksi

1. Konfigurasikan Supabase Auth dan PostgreSQL.
2. Tambahkan skema, Row Level Security (RLS), policy kepemilikan kasus, dan audit log.
3. Buat private Storage bucket dan validasi akses signed URL.
4. Pisahkan sesi GPS, daftar penerima yang berizin, kedaluwarsa sesi di server, serta kebijakan retensi lokasi.
5. Tambahkan pengujian komponen, validasi, dan alur error end-to-end.
6. Verifikasi workflow build pada GitHub Actions sebelum rilis.

Jangan menambahkan kredensial atau service_role key ke kode frontend.
