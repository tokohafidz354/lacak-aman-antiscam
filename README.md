# Lacak Aman Anti-Scam

Aplikasi Web/PWA berbahasa Indonesia untuk membantu pencatatan pemeriksaan awal nomor mencurigakan, pengelolaan kasus/bukti, dan pembacaan GPS perangkat setelah persetujuan eksplisit.

## Fitur yang tersedia saat ini

- Dashboard responsif dengan ringkasan nomor dan kasus dari browser lokal.
- Catatan nomor HP Indonesia yang dinormalisasi ke format internasional `+62`.
- Pencatatan pemeriksaan manual dengan sumber, hasil, waktu pemeriksaan dan catatan.
- CRUD kasus dasar: judul, jenis kejadian, status, tanggal, kronologi, nomor terkait, dan hapus.
- Lampiran sementara untuk file PNG/JPG/WEBP/PDF/TXT (maksimum 8 MB), hash SHA-256 bila browser mendukung, dan ekspor metadata laporan sebagai TXT.
- Pengambilan koordinat GPS satu kali pada perangkat saat ini setelah pengguna menekan tombol dan menyetujui izin browser.
- PWA manifest dan service worker shell offline.
- Migrasi awal Supabase dengan tabel kasus, subjek nomor, pemeriksaan, laporan, bukti, sesi lokasi, titik lokasi, audit log, RLS, dan private bucket.
- Klien Supabase opsional disiapkan, tetapi belum digunakan oleh alur halaman utama.

## Menjalankan aplikasi

Membutuhkan Node.js dan npm:

```bash
npm install
npm run dev
```

Build produksi:

```bash
npm run build
npm run preview
```

GitHub Actions menjalankan perintah build yang sama saat ada push atau pull request ke `main`.

## Status backend

**Backend belum aktif pada aplikasi yang berjalan.** UI menyimpan nomor dan metadata kasus pada localStorage. Data tidak tersinkronisasi antarperangkat dan dapat hilang ketika data browser dibersihkan. File bukti dibuatkan URL object sementara di browser; konten file tidak diunggah ke server. Ekspor laporan masih berupa TXT, bukan PDF.

Untuk menyiapkan Supabase:
1. Buat proyek Supabase.
2. Terapkan SQL migration di `supabase/migrations/20261020000000_initial_schema.sql` melalui Supabase CLI atau SQL Editor setelah meninjau kebijakannya.
3. Isi `.env` lokal dengan `VITE_SUPABASE_URL` dan `VITE_SUPABASE_ANON_KEY` berdasarkan proyek Anda. Lihat `.env.example`.
4. Jangan pernah memasukkan `service_role` key atau secret backend ke frontend.
5. Implementasikan login, pengelolaan sesi, dan integrasi CRUD sebelum memakai data sensitif. Saat ini klien Supabase yang ada belum dihubungkan ke form dan daftar pada UI.

Migrasi SQL belum diterapkan pada instance Supabase, dan policy RLS belum diuji pada database aktif. Tabel serta private bucket yang didefinisikan di migration adalah fondasi awal, bukan bukti backend siap produksi.

## Batasan lokasi dan sumber nomor

GPS dibaca satu kali dari browser perangkat yang sedang digunakan. Koordinat tidak dikirim ke server dan tidak dibagikan ke penerima lain. Tanggal kedaluwarsa sesi pada UI saat ini hanya penanda UI, bukan sesi berbagi lokasi di server.

Nomor HP saja tidak dapat digunakan untuk menemukan koordinat GPS atau waktu terakhir aktif WhatsApp. Pemeriksaan sumber eksternal masih manual; API resmi belum terhubung. Tidak ditemukannya laporan pada satu sumber bukan bukti bahwa nomor aman.

## Sumber resmi

- AduanNomor: https://aduannomor.id/
- CekRekening: https://cekrekening.id/
- Indonesia Anti-Scam Centre: https://iasc.ojk.go.id/
- Pusat Bantuan WhatsApp: https://faq.whatsapp.com/

## Sebelum digunakan untuk kasus nyata

- Hubungkan Auth, CRUD Supabase, dan private Storage ke antarmuka.
- Uji RLS dengan dua akun berbeda dan akses storage.
- Implementasikan kontrol penerima, pencabutan, kedaluwarsa server, dan retensi pada sesi GPS sebelum menamai fitur sebagai berbagi lokasi.
- Tambahkan uji otomatis pada validasi nomor, kasus, lampiran, ekspor, dan persetujuan geolokasi.
