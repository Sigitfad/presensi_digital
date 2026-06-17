============================================================
  PRESENSI DIGITAL SDN KARANGPAWITAN 1
  Node.js + SQLite (Tanpa XAMPP/Laragon)
============================================================

TEKNOLOGI YANG DIGUNAKAN
-------------------------
- Backend   : Node.js + Express.js
- Database  : SQLite (sql.js — pure JavaScript, tanpa install database)
- Frontend  : Bootstrap 5 + Vanilla JavaScript
- Session   : express-session + session-file-store
- Upload    : Multer
- Export    : xlsx (Excel)
- Login     : Kartu RFID (UID 10 digit)
- Layout    : Bootstrap 5 Sidebar


PERSYARATAN
-----------
1. Node.js versi 16+  →  https://nodejs.org (pilih LTS)
2. Browser: Chrome / Edge / Firefox
3. Koneksi internet (hanya saat npm install pertama kali)
4. RFID Reader USB (untuk scan kartu, opsional — bisa input manual)


CARA MENJALANKAN
=================

LANGKAH 1 — Install Node.js (jika belum)
  → Buka https://nodejs.org
  → Klik tombol hijau "LTS"
  → Install, pilih Next-Next-Finish
  → RESTART komputer setelah install

LANGKAH 2 — Install Dependencies
  → Buka folder aplikasi di CMD/PowerShell
  → Ketik: npm install
  → Tunggu hingga selesai (download paket dari internet)

LANGKAH 3 — Jalankan Aplikasi
  → Double-click: Jalankan.bat
    ATAU
  → Ketik di terminal: node server.js
  → Tunggu muncul "Server berjalan pada port 3000"
  → Buka browser: http://localhost:3000
  → Login: Tempelkan kartu RFID UID yang sudah terdaftar

CATATAN PENTING:
  - JANGAN TUTUP jendela terminal selama aplikasi dipakai
  - Tutup terminal = aplikasi mati
  - Jika port 3000 sudah dipakai, otomatis coba 3001, 3002, dst


PERTAMA KALI PAKAI — INSTALASI & SETUP
========================================
1. Install Node.js LTS dari https://nodejs.org
2. Install aplikasi: npm install
3. Jalankan: node server.js
4. Buka http://localhost:3000
5. Login menggunakan UID kartu RFID yang sudah didaftarkan
   (Jika belum ada user sama sekali, data awal kosong —
    daftarkan operator pertama melalui menu Pengguna)

LOGIN — KARTU RFID (UID)
=========================
Aplikasi ini login menggunakan UID kartu RFID (10 digit).
Tidak ada login username/password.

- Setiap kartu RFID memiliki UID 10 digit unik
- Daftarkan UID melalui menu Pengguna → Tambah User
- Login: tempelkan kartu ke reader USB
- Alternatif: input UID manual jika kartu tidak terbaca


FITUR LENGKAP
==============
✓ Login dengan Kartu RFID (UID)
✓ Role: Operator / Guru / Kepala Sekolah / Penjaga Sekolah / Guru Bidang
✓ Dashboard statistik real-time (Total siswa, hadir, terlambat, dll)
✓ CRUD Siswa + Upload Foto (max 2MB)
✓ CRUD Pengguna (Guru & Staf) + Upload Foto
✓ Data Lulusan (Alumni) + Upload Ijazah (PDF/gambar, max 10MB)
✓ Data Pindahan + Upload Surat Pindah (PDF/gambar, max 10MB)
✓ Kenaikan Kelas & Kelulusan Massal
✓ Import Data Siswa dari CSV
✓ Import Data Pengguna GTK dari CSV
✓ Export CSV (Siswa, Pengguna GTK)
✓ Export Excel (Rekap per Siswa, per Kelas, per Siswa Detail)
✓ Rekap Presensi Bulanan (per siswa & per kelas)
✓ Riwayat Presensi + Filter Tanggal, Kelas, Tahun Ajaran
✓ Scan RFID via USB Reader
✓ Presensi Manual (input langsung jika RFID gagal)
✓ Pengaturan Jam Masuk, Batas Terlambat, Batas Alpha
✓ Identitas Sekolah (nama, alamat, logo, tahun ajaran)
✓ Manajemen Tahun Ajaran & filter per tahun ajaran
✓ Hari Libur Nasional (sync otomatis dari API libur.deno.dev)
✓ Hari Libur Sekolah & Kegiatan (manual)
✓ Notifikasi WhatsApp (via API Fonnte)
✓ Broadcast WhatsApp ke orang tua siswa
✓ Log Aktivitas (login, edit, hapus, scan, dll)
✓ Backup & Restore Database (.db & .json)
✓ Responsive Mobile-friendly
✓ Sidebar Collapse (ikon saja / ikon + teks)
✓ Filter berdasarkan kelas pengampu (Guru hanya lihat kelasnya)


STRUKTUR FOLDER
================

presensi_digital/
│
├── server.js              → Server utama (Express + Session)
├── database.js            → Inisialisasi SQLite + query helper
├── package.json           → Daftar dependencies Node.js
├── Jalankan.bat           → Script untuk menjalankan aplikasi
│
├── routes/                → API Backend (Express Router)
│   ├── _helpers.js        → Fungsi bersama (auth, getKelasFilter, CSV parser)
│   ├── auth.js            → Login/logout via UID RFID
│   ├── pages.js           → Routing halaman HTML frontend
│   ├── dashboard.js       → Statistik dashboard (7 kategori)
│   ├── siswa.js           → CRUD siswa + kenaikan kelas + impor CSV
│   ├── presensi.js        → Scan RFID + riwayat presensi
│   ├── rekap.js           → Rekap presensi bulanan + export Excel
│   ├── users.js           → Manajemen pengguna & role + impor CSV GTK
│   ├── settings.js        → Pengaturan jam, WA, dll
│   ├── identitas.js       → Identitas sekolah (publik & admin)
│   ├── kelas.js           → Manajemen daftar kelas
│   ├── alumni.js          → Data lulusan + upload ijazah
│   ├── pindahan.js        → Data pindahan + upload surat
│   ├── hari_libur.js      → Hari libur (sync API + manual)
│   ├── tahun_ajaran.js    → Manajemen tahun ajaran
│   ├── whatsapp.js        → Notifikasi & broadcast WhatsApp
│   ├── backup.js          → Backup & restore database
│   ├── actlog.js          → Log aktivitas pengguna
│
├── views/                 → Halaman Frontend (HTML + JS inline)
│   ├── login.html
│   ├── dashboard.html
│   ├── siswa.html         → CRUD siswa + hapus massal
│   ├── view_siswa.html    → Detail siswa & rekap per siswa
│   ├── scan.html          → Scan RFID + popup absen
│   ├── riwayat.html       → Riwayat presensi + filter
│   ├── rekap.html         → Rekap bulanan + export Excel
│   ├── users.html         → Manajemen pengguna & role
│   ├── alumni.html        → Data lulusan + upload ijazah
│   ├── pindahan.html      → Data pindahan + upload surat
│   ├── settings.html      → Pengaturan jam masuk, WA, identitas
│   ├── backup.html        → Backup & restore database
│   ├── broadcast.html     → Broadcast WhatsApp ke orang tua
│   ├── hari_libur.html    → Kelola hari libur + sync nasional
│   ├── actlog.html        → Log aktivitas
│   ├── view_user.html     → Detail pengguna
│   ├── forbidden.html     → Halaman akses ditolak
│
├── public/
│   ├── css/
│   │   └── style.css      → Stylesheet utama (Bootstrap 5 + kustom)
│   ├── js/
│   │   └── app.js         → JavaScript utama (session, layout, helpers)
│   └── uploads/
│       ├── foto-siswa/    → Foto siswa
│       ├── foto-user/     → Foto pengguna
│       ├── ijazah/        → Scan ijazah (PDF/gambar)
│       ├── surat-pindah/  → Surat pindah (PDF/gambar)
│       └── logo/          → Logo sekolah
│
├── database/
│   ├── presensi.db        → File database SQLite (semua data)
│   ├── sessions/          → Session login (file-based)
│   └── backups/           → File backup (.db / .json)


DATABASE
=========
- SQLite (file-based, tanpa server database)
- Satu file: database/presensi.db
- Library: sql.js (SQLite compiled to JavaScript)

TABEL:
  operators        → Pengguna (guru, staf, operator)
  siswa            → Data siswa
  presensi         → Catatan presensi harian
  settings         → Pengaturan aplikasi
  identitas_sekolah → Profil sekolah
  activity_log     → Log aktivitas
  kelas            → Daftar kelas
  alumni           → Data lulusan
  pindahan         → Data pindah sekolah
  tahun_ajaran     → Tahun ajaran
  hari_libur       → Hari libur (nasional + sekolah)


MIGRASI & UPDATE DATABASE
==========================
Database otomatis di-migrasi saat server dijalankan pertama kali.
- Kolom baru ditambahkan otomatis
- Struktur tabel diperbarui tanpa kehilangan data
- Data lama tetap aman


BACKUP DATA
=============
Semua data dalam 1 file: database/presensi.db

Backup via menu Backup Database di aplikasi:
  - Backup .db (format asli SQLite, siap restore langsung)
  - Backup .json (data portabel, bisa dibaca/diedit)
  - Backup otomatis sebelum restore

Restore:
  - Upload file .db atau .json, lalu klik Restore
  - Backup otomatis database saat ini sebelum overwrite
  - Server reload otomatis setelah restore


ERROR UMUM DAN SOLUSINYA
=========================

ERROR: "node tidak dikenal"
→ Node.js belum terinstall / belum restart setelah install
→ Download: https://nodejs.org → install → restart komputer

ERROR: "Cannot find module 'express'" (atau modul lain)
→ npm install belum dijalankan
→ Buka terminal di folder aplikasi, ketik: npm install

ERROR: "Port 3000 already in use"
→ Port 3000 sudah dipakai aplikasi lain
→ Server otomatis coba port 3001, 3002, dst
→ Buka browser ke port yang tertera di terminal

ERROR: Terminal langsung keluar / crash
→ Ada error saat startup
→ Jalankan via CMD: cd /d "path_folder" && node server.js
→ Screenshot error untuk diagnosis

ERROR: "EPERM" atau permission error
→ Jalankan terminal sebagai Administrator
→ Atau pindahkan folder ke Desktop (bukan di OneDrive/system)

MASALAH: Browser tidak terbuka otomatis
→ Buka manual: http://localhost:3000 (atau port lain yang tertera)

MASALAH: RFID tidak terbaca
→ Pastikan kartu ditempelkan langsung ke reader USB
→ Tunggu bunyi beep reader
→ Jika sering gagal, daftarkan ulang UID via menu Pengguna
→ Gunakan input manual (UID teks) sebagai alternatif

MASALAH: Foto tidak muncul setelah upload
→ Pastikan folder uploads/ tersedia (dibuat otomatis oleh server)
→ Ukuran foto maksimal 2MB (siswa) / 10MB (ijazah/surat)
→ Format yang didukung: JPG, PNG, WebP (foto) + PDF (ijazah/surat)


INFO
=====
Versi    : 2.1.0
Backend  : Node.js + Express.js
Database : SQLite (sql.js)
Frontend : Bootstrap 5 + Vanilla JavaScript
Session  : File-based (session-file-store)
Port     : 3000 (default, auto-increment jika dipakai)
============================================================
