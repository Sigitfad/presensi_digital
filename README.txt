============================================================
  PRESENSI DIGITAL SDN KARANGPAWITAN 1
  Node.js + SQLite Edition (Tanpa XAMPP/Laragon)
============================================================

PERSYARATAN
-----------
- Node.js versi 16+  →  https://nodejs.org (pilih LTS)
- Browser: Chrome / Edge / Firefox
- Koneksi internet (hanya saat install pertama kali)


============================================================
CARA MENJALANKAN
============================================================

LANGKAH 1 — Install Node.js (jika belum)
  → Buka https://nodejs.org
  → Klik tombol hijau "LTS"
  → Install, pilih Next-Next-Finish
  → RESTART komputer setelah install

LANGKAH 2 — Jalankan Aplikasi
  → Double-click: Jalankan.bat
  → Tunggu hingga muncul "Server berjalan pada port 3000"
  → Browser terbuka otomatis ke http://localhost:3000
  → Login: Tempelkan kartu RFID UID yang sudah terdaftar

CATATAN PENTING:
  ✔ JANGAN TUTUP jendela hitam (terminal) selama aplikasi dipakai
  ✔ Jendela hitam = server yang sedang berjalan
  ✔ Tutup jendela hitam = aplikasi mati


============================================================
JIKA JALANKAN.BAT LANGSUNG KELUAR / ERROR
============================================================

CARA 1 — Jalankan sebagai Administrator
  → Klik KANAN Jalankan.bat
  → Pilih "Run as administrator"
  → Klik Yes

CARA 2 — Gunakan Debug.bat
  → Double-click Debug.bat
  → Ikuti petunjuk di layar
  → Screenshot hasilnya jika masih error

CARA 3 — Install Manual
  → Double-click InstallManual.bat
  → Tunggu selesai
  → Lalu jalankan Jalankan.bat

CARA 4 — Manual via CMD
  → Tekan Windows+R, ketik "cmd", Enter
  → Ketik: cd /d "PATH_FOLDER_ANDA"
     Contoh: cd /d "C:\Users\ACER NITRO\Desktop\presensi_digital"
  → Ketik: npm install
  → Ketik: node server.js
  → Buka browser: http://localhost:3000


============================================================
LOGIN — KARTU RFID (UID)
============================================================
Aplikasi ini menggunakan kartu RFID untuk login.
Tidak ada login username/password.

- Operator: Daftarkan UID kartu RFID melalui menu Pengguna
- Guru & staf: Tempelkan kartu RFID yang sudah didaftarkan
- Login pertama: Buka menu Pengguna → Tambah → Masukkan UID
- Setiap kartu RFID memiliki UID 10 digit unik


============================================================
ERROR UMUM DAN SOLUSINYA
============================================================

ERROR: "node tidak dikenal"
→ Node.js belum terinstall atau belum restart setelah install
→ Download: https://nodejs.org → install → restart komputer

ERROR: "Cannot find module 'express'"
→ npm install gagal / belum dijalankan
→ Jalankan InstallManual.bat sebagai Administrator

ERROR: "Port 3000 already in use"
→ Port 3000 sudah dipakai aplikasi lain
→ Edit server.js baris: const PORT = 3001;
→ Buka browser ke: http://localhost:3001

ERROR: Terminal langsung keluar
→ Ada error yang terjadi sebelum pause
→ Jalankan Debug.bat untuk melihat detail error

ERROR: "EPERM" atau permission error
→ Jalankan sebagai Administrator
→ Atau pindahkan folder ke Desktop (bukan di OneDrive/sistem)

MASALAH: Browser tidak terbuka otomatis
→ Buka manual: http://localhost:3000
→ Tunggu 5-10 detik setelah server jalan

MASALAH: RFID tidak terbaca
→ Pastikan kartu ditempelkan langsung ke reader USB
→ Tunggu bunyi beep reader
→ Jika sering gagal, daftarkan ulang UID via menu Pengguna
→ Gunakan UID manual (input teks) sebagai alternatif

MASALAH: Foto tidak muncul setelah upload
→ Pastikan folder uploads tersedia
→ Ukuran foto maksimal 2MB (siswa) / 10MB (ijazah/surat)
→ Refresh halaman setelah upload


============================================================
STRUKTUR FOLDER
============================================================

presensi_digital/
│
├── server.js           → Server utama (Express)
├── database.js         → Setup SQLite + fungsi query
├── package.json        → Daftar dependensi Node.js
├── Jalankan.bat        → Klik 2x untuk menjalankan
├── Debug.bat           → Debug jika ada masalah
├── InstallManual.bat   → Install ulang dependencies
├── database.py         → Tool Python (opsional, untuk export)
│
├── routes/             → API backend
│   ├── auth.js         → Login/logout via UID
│   ├── pages.js        → Routing halaman HTML
│   ├── siswa.js        → CRUD siswa + kenaikan kelas
│   ├── presensi.js     → Scan RFID + riwayat
│   ├── rekap.js        → Rekap presensi bulanan
│   ├── users.js        → Manajemen pengguna & role
│   ├── settings.js     → Pengaturan jam & batas terlambat
│   ├── identitas.js    → Identitas sekolah
│   ├── alumni.js       → Data lulusan
│   ├── pindahan.js     → Data pindahan
│   ├── actlog.js       → Log aktivitas
│   ├── backup.js       → Backup & restore
│   └── dashboard.js    → Statistik dashboard
│
├── views/              → Halaman frontend
│   ├── login.html
│   ├── dashboard.html
│   ├── siswa.html      → CRUD siswa + hapus massal
│   ├── view_siswa.html → Detail & export rekap per siswa
│   ├── scan.html       → Scan RFID + popup absen
│   ├── riwayat.html    → Riwayat presensi + filter
│   ├── rekap.html      → Rekap bulanan + export Excel
│   ├── alumni.html     → Data lulusan + upload ijazah
│   ├── pindahan.html   → Data pindahan + surat pindah
│   ├── users.html      → Manajemen pengguna & role
│   ├── settings.html   → Jam masuk, identitas, notif WA
│   ├── actlog.html     → Log aktivitas
│   ├── backup.html     → Backup & restore database
│   └── forbidden.html  → Halaman akses ditolak
│
├── public/
│   ├── css/style.css   → Stylesheet utama
│   ├── js/app.js       → JavaScript utama (helpers, layout)
│   └── uploads/
│       ├── foto-siswa/ → Foto siswa
│       ├── foto-user/  → Foto pengguna
│       ├── ijazah/     → Scan ijazah (PDF/gambar)
│       ├── surat-pindah/ → Surat pindah (PDF/gambar)
│       └── logo/       → Logo sekolah
│
├── database/
│   ├── presensi.db     → File database SQLite
│   ├── sessions/       → Session login
│   └── backups/        → File backup (.db / .json)
│


============================================================
BACKUP DATA
============================================================
Semua data dalam 1 file: database/presensi.db

Backup via menu Backup Database di aplikasi:
  - Backup .db (format asli, siap restore langsung)
  - Backup .json (data portabel, bisa diedit)

Restore:
  - Upload file .db atau .json, lalu klik Restore
  - Server restart otomatis setelah restore
  - Refresh browser setelah ±5 detik


============================================================
FITUR LENGKAP
============================================================
✓ Login dengan Kartu RFID (UID)
✓ Role: Operator / Guru / Kepala Sekolah / Penjaga Sekolah / Guru Bidang
✓ Dashboard statistik 7 kategori (Hadir, Terlambat, Izin, Sakit, Alpha)
✓ CRUD Siswa + Upload Foto
✓ CRUD Pengguna (Guru & Staf) + Upload Foto
✓ Data Lulusan (Alumni) + Upload Ijazah (PDF/gambar)
✓ Data Pindahan + Upload Surat Pindah (PDF/gambar)
✓ Kenaikan Kelas & Kelulusan Massal
✓ Import Data Siswa dari CSV
✓ Import Data Pengguna dari CSV
✓ Export CSV (Siswa, Pengguna)
✓ Export Excel (Rekap per Siswa, per Kelas, per Siswa Detail)
✓ Loading Progress Indicators untuk Export & Proses Massal
✓ Rekap Presensi Bulanan (per siswa & per kelas)
✓ Riwayat Presensi + Filter Tanggal & Kelas
✓ Scan RFID via USB Reader (Serial)
✓ Input Manual (alternatif jika RFID gagal)
✓ Pengaturan Jam Masuk & Batas Waktu Terlambat
✓ Identitas Sekolah (nama, alamat, logo, tahun ajaran)
✓ Notifikasi WhatsApp (via API)
✓ Log Aktivitas (login, edit, hapus, scan, dll)
✓ Backup & Restore (.db & .json)
✓ Responsive Mobile-friendly
✓ Sidebar Collapse (ikon saja / ikon + teks)


============================================================
INFO
============================================================
Versi    : 2.0.0
Backend  : Node.js + Express
Database : SQLite (sql.js - pure JavaScript)
Frontend : Bootstrap 5 + Vanilla JavaScript
Port     : 3000 (default, bisa diubah di server.js)
============================================================
