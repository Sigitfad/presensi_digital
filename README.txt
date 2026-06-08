============================================================
  PRESENSI SISWA-SISWI SDN KARANGPAWITAN 1 v2.0
  Node.js + SQLite Edition
  TANPA XAMPP / LARAGON / DATABASE SERVER
============================================================

PERSYARATAN
-----------
- Node.js versi 16 ke atas  →  https://nodejs.org  (pilih LTS)
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
  → Tunggu hingga muncul "Server berjalan..."
  → Browser terbuka otomatis ke http://localhost:3000

  Login: username = admin / password = password

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
     Contoh: cd /d "C:\Users\ACER NITRO\Desktop\presensi-node"
  → Ketik: npm install
  → Ketik: node server.js
  → Buka browser: http://localhost:3000


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

MASALAH: Kamera tidak bisa scan QR
→ Gunakan Chrome atau Edge
→ Akses via localhost (sudah aman, tidak perlu HTTPS)
→ Klik Allow/Izinkan saat minta akses kamera
→ Gunakan Input Manual NISN sebagai alternatif

MASALAH: Foto tidak muncul setelah upload
→ Pastikan folder public/uploads/foto-siswa/ ada
→ Ukuran foto maksimal 2MB


============================================================
STRUKTUR FOLDER
============================================================

presensi-node/
│
├── server.js           → Server utama
├── database.js         → Setup database SQLite otomatis
├── package.json        → Daftar paket Node.js
│
├── routes/
│   ├── auth.js         → Login, register, logout
│   ├── pages.js        → Routing halaman HTML
│   ├── siswa.js        → API data siswa + foto
│   ├── presensi.js     → API scan + riwayat + export
│   ├── rekap.js        → API rekap bulanan
│   ├── users.js        → API manajemen pengguna
│   ├── settings.js     → API pengaturan jam masuk
│   ├── identitas.js    → API identitas sekolah
│   ├── actlog.js       → API log aktivitas
│   ├── backup.js       → API backup database
│   └── dashboard.js    → API statistik
│
├── views/              → Halaman HTML
│   ├── login.html
│   ├── register.html
│   ├── dashboard.html
│   ├── siswa.html      → CRUD siswa + upload foto
│   ├── scan.html       → Scan QR + popup berhasil
│   ├── riwayat.html    → Riwayat + export CSV/Excel
│   ├── rekap.html      → Rekap bulanan + kalender
│   ├── qrcode.html     → Cetak QR dengan identitas
│   ├── users.html      → Manajemen pengguna & role
│   ├── settings.html   → Pengaturan jam + identitas sekolah
│   ├── actlog.html     → Log aktivitas
│   ├── backup.html     → Backup & restore database
│   └── forbidden.html  → Halaman akses ditolak
│
├── public/
│   ├── css/style.css   → Stylesheet
│   ├── js/app.js       → JavaScript utama
│   └── uploads/
│       ├── foto-siswa/ → Foto siswa (dibuat otomatis)
│       └── logo/       → Logo sekolah (dibuat otomatis)
│
├── database/
│   ├── presensi.db     → File database (dibuat otomatis)
│   ├── sessions/       → Session login (dibuat otomatis)
│   └── backups/        → File backup (dibuat otomatis)
│
├── Jalankan.bat        → Klik 2x untuk menjalankan
├── Debug.bat           → Gunakan jika ada masalah
├── InstallManual.bat   → Install ulang dependencies
└── README.txt          → Panduan ini


============================================================
BACKUP DATA
============================================================
Seluruh data ada di 1 file: database/presensi.db
Backup via menu Backup Database di aplikasi, atau
copy manual file database/presensi.db ke tempat aman.


============================================================
FITUR LENGKAP v2.0
============================================================
✓ Login & Registrasi Operator
✓ Role: Kepala Sekolah / Guru / Operator
✓ Dashboard statistik 6 kategori (Hadir, Terlambat, Izin, Sakit, Alpha)
✓ CRUD Siswa + Upload Foto Siswa
✓ Sidebar collapse (icon saja / icon + teks)
✓ Generate & Cetak QR Code (download dengan identitas lengkap)
✓ Scan QR via kamera + Popup "Absen Berhasil" dengan foto siswa
✓ Input manual NISN (alternatif kamera)
✓ Rekap Presensi Bulanan (kalender visual per siswa)
✓ Persentase kehadiran per siswa
✓ Riwayat Presensi + filter tanggal & kelas
✓ Export CSV & Excel (.xlsx)
✓ Pengaturan Jam Masuk & Batas Terlambat
✓ Identitas Sekolah (nama, alamat, logo, tahun ajaran)
✓ Log Aktivitas (login, edit, hapus, scan)
✓ Backup & Restore Database
✓ Responsive mobile-friendly

============================================================
INFO
============================================================
Versi    : 2.0.0
Backend  : Node.js + Express
Database : SQLite (sql.js - pure JavaScript)
Frontend : Bootstrap 5 + Vanilla JavaScript
Port     : 3000 (default)
============================================================
