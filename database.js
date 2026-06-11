/**
 * Database - sql.js Pure JavaScript SQLite v2.2
 * Tambah: pengampu_kelas untuk guru/kepala_sekolah
 */
const fs     = require('fs');
const path   = require('path');


const DB_DIR  = path.join(__dirname, 'database');
const DB_PATH = path.join(DB_DIR, 'presensi.db');
if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });

let db = null;

async function initDB() {
  const initSqlJs = require('sql.js');
  const SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    db = new SQL.Database(fs.readFileSync(DB_PATH));
    console.log('[DB] Database dimuat: database/presensi.db');
  } else {
    db = new SQL.Database();
    console.log('[DB] Database baru dibuat');
  }

  db.run('PRAGMA foreign_keys = ON;');

  db.run(`
    CREATE TABLE IF NOT EXISTS operators (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      nama            TEXT NOT NULL,
      role            TEXT NOT NULL DEFAULT 'operator'
                        CHECK(role IN ('operator','guru','kepala_sekolah','penjaga_sekolah','guru_bidang')),
      no_hp           TEXT DEFAULT '',
      email           TEXT DEFAULT '',
      foto            TEXT DEFAULT '',
      pengampu_kelas  TEXT DEFAULT 'Semua',
      nip             TEXT DEFAULT '',
      alamat          TEXT DEFAULT '',
      bidang_keahlian TEXT DEFAULT '',
      uid             TEXT DEFAULT '',
      created_at      TEXT DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS siswa (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      nisn           TEXT NOT NULL UNIQUE,
      nama          TEXT NOT NULL,
      kelas         TEXT NOT NULL,
      jenis_kelamin TEXT NOT NULL,
      foto          TEXT DEFAULT '',
      no_hp_ortu    TEXT DEFAULT '',
      nik           TEXT DEFAULT '',
      tempat_lahir  TEXT DEFAULT '',
      tanggal_lahir TEXT DEFAULT '',
      agama         TEXT DEFAULT '',
      alamat        TEXT DEFAULT '',
      created_at    TEXT DEFAULT (datetime('now','localtime')),
      updated_at    TEXT DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS presensi (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      siswa_id   INTEGER NOT NULL,
      tanggal    TEXT NOT NULL,
      jam_masuk  TEXT NOT NULL,
      status     TEXT NOT NULL DEFAULT 'Hadir'
                   CHECK(status IN ('Hadir','Terlambat','Izin','Sakit','Alpha')),
      keterangan TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (siswa_id) REFERENCES siswa(id) ON DELETE CASCADE,
      UNIQUE(siswa_id, tanggal)
    );

    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS activity_log (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id    INTEGER,
      user_nama  TEXT NOT NULL,
      role       TEXT NOT NULL DEFAULT 'operator',
      aksi       TEXT NOT NULL,
      detail     TEXT DEFAULT '',
      ip_address TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS identitas_sekolah (
      id           INTEGER PRIMARY KEY CHECK(id=1),
      nama_sekolah TEXT NOT NULL DEFAULT 'SDN Karangpawitan 1',
      alamat       TEXT DEFAULT '',
      logo         TEXT DEFAULT '',
      tahun_ajaran TEXT DEFAULT '2024/2025',
      telp         TEXT DEFAULT '',
      email        TEXT DEFAULT '',
      website      TEXT DEFAULT '',
      updated_at   TEXT DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS kelas (
      id   INTEGER PRIMARY KEY AUTOINCREMENT,
      nama TEXT NOT NULL UNIQUE
    );
  `);

  // Migrasi: rename nis -> nisn jika kolom lama masih ada
  try { db.run("ALTER TABLE siswa RENAME COLUMN nis TO nisn"); saveDB(); console.log('[DB] Migrasi: siswa.nis -> nisn'); } catch(e) {}
  try { db.run("ALTER TABLE alumni RENAME COLUMN nis TO nisn"); saveDB(); console.log('[DB] Migrasi: alumni.nis -> nisn'); } catch(e) {}

  // CREATE TABLE alumni/pindahan SEBELUM migrasi agar kolom tambahan bisa diterapkan
  db.run(`
    CREATE TABLE IF NOT EXISTS alumni (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nama TEXT NOT NULL,
      nisn TEXT NOT NULL,
      kelas_lulus TEXT NOT NULL,
      tahun_lulus TEXT NOT NULL,
      foto TEXT DEFAULT '',
      ijazah TEXT DEFAULT '',
      jenis_kelamin TEXT DEFAULT '',
      nik TEXT DEFAULT '',
      tempat_lahir TEXT DEFAULT '',
      tanggal_lahir TEXT DEFAULT '',
      agama TEXT DEFAULT '',
      alamat TEXT DEFAULT '',
      no_hp_ortu TEXT DEFAULT '',
      nipd TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now','localtime')),
      updated_at TEXT DEFAULT (datetime('now','localtime'))
    );
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS pindahan (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nama TEXT NOT NULL,
      nisn TEXT NOT NULL,
      kelas TEXT NOT NULL,
      alasan TEXT DEFAULT '',
      tanggal_pindah TEXT DEFAULT (date('now','localtime')),
      foto TEXT DEFAULT '',
      surat_pindah TEXT DEFAULT '',
      sekolah_tujuan TEXT DEFAULT '',
      nomor_surat TEXT DEFAULT '',
      tanggal_surat TEXT DEFAULT '',
      jenis_kelamin TEXT DEFAULT '',
      nik TEXT DEFAULT '',
      tempat_lahir TEXT DEFAULT '',
      tanggal_lahir TEXT DEFAULT '',
      agama TEXT DEFAULT '',
      alamat TEXT DEFAULT '',
      no_hp_ortu TEXT DEFAULT '',
      nipd TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now','localtime')),
      updated_at TEXT DEFAULT (datetime('now','localtime'))
    );
  `);

  // Migrasi: tambah kolom baru jika belum ada
  const migrations = [
    "ALTER TABLE operators ADD COLUMN foto TEXT DEFAULT ''",
    "ALTER TABLE operators ADD COLUMN pengampu_kelas TEXT DEFAULT 'Semua'",
    "ALTER TABLE operators ADD COLUMN nip TEXT DEFAULT ''",
    "ALTER TABLE operators ADD COLUMN alamat TEXT DEFAULT ''",
    "ALTER TABLE operators ADD COLUMN bidang_keahlian TEXT DEFAULT ''",
    "ALTER TABLE siswa ADD COLUMN no_hp_ortu TEXT DEFAULT ''",
    "ALTER TABLE siswa ADD COLUMN nik TEXT DEFAULT ''",
    "ALTER TABLE siswa ADD COLUMN tempat_lahir TEXT DEFAULT ''",
    "ALTER TABLE siswa ADD COLUMN tanggal_lahir TEXT DEFAULT ''",
    "ALTER TABLE siswa ADD COLUMN agama TEXT DEFAULT ''",
    "ALTER TABLE siswa ADD COLUMN alamat TEXT DEFAULT ''",
    "ALTER TABLE siswa ADD COLUMN status TEXT DEFAULT 'Aktif'",
    "ALTER TABLE operators ADD COLUMN uid TEXT DEFAULT ''",
    "ALTER TABLE alumni ADD COLUMN jenis_kelamin TEXT DEFAULT ''",
    "ALTER TABLE alumni ADD COLUMN nik TEXT DEFAULT ''",
    "ALTER TABLE alumni ADD COLUMN tempat_lahir TEXT DEFAULT ''",
    "ALTER TABLE alumni ADD COLUMN tanggal_lahir TEXT DEFAULT ''",
    "ALTER TABLE alumni ADD COLUMN agama TEXT DEFAULT ''",
    "ALTER TABLE alumni ADD COLUMN alamat TEXT DEFAULT ''",
    "ALTER TABLE alumni ADD COLUMN no_hp_ortu TEXT DEFAULT ''",
    "ALTER TABLE pindahan ADD COLUMN jenis_kelamin TEXT DEFAULT ''",
    "ALTER TABLE pindahan ADD COLUMN nik TEXT DEFAULT ''",
    "ALTER TABLE pindahan ADD COLUMN tempat_lahir TEXT DEFAULT ''",
    "ALTER TABLE pindahan ADD COLUMN tanggal_lahir TEXT DEFAULT ''",
    "ALTER TABLE pindahan ADD COLUMN agama TEXT DEFAULT ''",
    "ALTER TABLE pindahan ADD COLUMN alamat TEXT DEFAULT ''",
    "ALTER TABLE pindahan ADD COLUMN no_hp_ortu TEXT DEFAULT ''",
    "ALTER TABLE pindahan ADD COLUMN surat_pindah TEXT DEFAULT ''",
    "ALTER TABLE pindahan ADD COLUMN sekolah_tujuan TEXT DEFAULT ''",
    "ALTER TABLE pindahan ADD COLUMN nomor_surat TEXT DEFAULT ''",
    "ALTER TABLE pindahan ADD COLUMN tanggal_surat TEXT DEFAULT ''",
    "ALTER TABLE siswa DROP COLUMN status",
    "ALTER TABLE siswa ADD COLUMN nipd TEXT DEFAULT ''",
    "ALTER TABLE siswa ADD COLUMN uid TEXT DEFAULT ''",
    "ALTER TABLE alumni ADD COLUMN nipd TEXT DEFAULT ''",
    "ALTER TABLE pindahan ADD COLUMN nipd TEXT DEFAULT ''",
  ];
  migrations.forEach(sql => { try { db.run(sql); saveDB(); } catch(e) {} });

  // Migrasi: hapus kolom username, password, password_plain jika masih ada
  const cols = queryAll("PRAGMA table_info('operators')").map(c=>c.name);
  if(cols.includes('username')||cols.includes('password')||cols.includes('password_plain')){
    console.log('[DB] Migrasi: hapus kolom username/password dari operators...');
    try {
      db.run("ALTER TABLE operators RENAME TO operators_old");
      db.run(`CREATE TABLE IF NOT EXISTS operators (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        nama            TEXT NOT NULL,
        role            TEXT NOT NULL DEFAULT 'operator'
                          CHECK(role IN ('operator','guru','kepala_sekolah','penjaga_sekolah','guru_bidang')),
        no_hp           TEXT DEFAULT '',
        email           TEXT DEFAULT '',
        foto            TEXT DEFAULT '',
        pengampu_kelas  TEXT DEFAULT 'Semua',
        nip             TEXT DEFAULT '',
        alamat          TEXT DEFAULT '',
        bidang_keahlian TEXT DEFAULT '',
        uid             TEXT DEFAULT '',
        created_at      TEXT DEFAULT (datetime('now','localtime'))
      )`);
      db.run(`INSERT INTO operators (id,nama,role,no_hp,email,foto,pengampu_kelas,nip,alamat,bidang_keahlian,uid,created_at)
               SELECT id,nama,role,no_hp,email,foto,pengampu_kelas,nip,alamat,bidang_keahlian,uid,created_at FROM operators_old`);
      db.run("DROP TABLE operators_old");
      saveDB();
      console.log('[DB] Migrasi: username/password berhasil dihapus dari tabel operators');
    } catch(e2) {
      console.error('[DB] Gagal migrasi operators:', e2.message);
    }
  }

  // Data awal siswa
  if (queryCount('SELECT COUNT(*) as c FROM siswa') === 0) {
    [
      ['2024001','Ahmad Fauzi',      'Kelas 1A','Laki-laki'],
      ['2024002','Siti Nurhaliza',   'Kelas 1A','Perempuan'],
      ['2024003','Budi Santoso',     'Kelas 2A','Laki-laki'],
      ['2024004','Dewi Rahayu',      'Kelas 2A','Perempuan'],
      ['2024005','Rizki Pratama',    'Kelas 3A','Laki-laki'],
      ['2024006','Anisa Putri',      'Kelas 3A','Perempuan'],
      ['2024007','Dani Kurniawan',   'Kelas 4A','Laki-laki'],
      ['2024008','Fitri Handayani',  'Kelas 4A','Perempuan'],
      ['2024009','Eko Prasetyo',     'Kelas 5A','Laki-laki'],
      ['2024010','Lestari Wulandari','Kelas 5A','Perempuan'],
    ].forEach(s => run('INSERT INTO siswa (nisn,nama,kelas,jenis_kelamin) VALUES (?,?,?,?)', s));
    console.log('[DB] 10 siswa awal dibuat');
  }

  const defaults = { 'jam_masuk':'07:00','batas_terlambat':'07:00','backup_otomatis':'false' };
  Object.entries(defaults).forEach(([k,v]) => {
    if (!queryOne('SELECT key FROM settings WHERE key=?',[k]))
      run('INSERT INTO settings (key,value) VALUES (?,?)',[k,v]);
  });

  if (!queryOne('SELECT id FROM identitas_sekolah WHERE id=1')) {
    run(`INSERT INTO identitas_sekolah (id,nama_sekolah,alamat,tahun_ajaran)
         VALUES (1,'SDN Karangpawitan 1','Jl. Karangpawitan No.1','2024/2025')`);
  }

  // Data awal kelas
  if (queryCount('SELECT COUNT(*) as c FROM kelas') === 0) {
    const kelasList = [];
    for (let g = 1; g <= 6; g++) {
      ['A','B','C','D'].forEach(h => kelasList.push(`${g}${h}`));
    }
    kelasList.forEach(k => run('INSERT INTO kelas (nama) VALUES (?)', [k]));
    console.log(`[DB] ${kelasList.length} kelas dibuat`);
  }

  saveDB();
  console.log('[DB] Siap');
  return db;
}

function saveDB() {
  if (!db) return;
  try { fs.writeFileSync(DB_PATH, Buffer.from(db.export())); }
  catch(e) { console.error('[DB] Gagal simpan:', e.message); }
}

function run(sql, params = []) {
  db.run(sql, params);
  saveDB();
}

function runWithoutSave(sql, params = []) {
  db.run(sql, params);
}

function queryAll(sql, params = []) {
  try {
    const stmt = db.prepare(sql);
    const rows = [];
    stmt.bind(params);
    while (stmt.step()) rows.push(stmt.getAsObject());
    stmt.free();
    return rows;
  } catch(e) { console.error('[DB] queryAll err:', e.message); return []; }
}

function queryOne(sql, params = []) { return queryAll(sql, params)[0] || null; }

function queryCount(sql, params = []) {
  const r = queryOne(sql, params);
  return r ? parseInt(Object.values(r)[0]) || 0 : 0;
}

function logActivity(userId, userNama, role, aksi, detail='', ip='') {
  try { run('INSERT INTO activity_log (user_id,user_nama,role,aksi,detail,ip_address) VALUES (?,?,?,?,?,?)',
            [userId, userNama, role, aksi, detail, ip]); } catch(e) {}
}

function getSetting(key, defaultVal='') {
  const r = queryOne('SELECT value FROM settings WHERE key=?',[key]);
  return r ? r.value : defaultVal;
}

function hitungStatus(jamMasuk) {
  const batas = getSetting('batas_terlambat','07:00');
  const [bH,bM] = batas.split(':').map(Number);
  const [jH,jM] = jamMasuk.split(':').map(Number);
  return (jH*60+jM) <= (bH*60+bM) ? 'Hadir' : 'Terlambat';
}

function reloadDB() {
  const initSqlJs = require('sql.js');
  return initSqlJs().then(SQL => {
    if (fs.existsSync(DB_PATH)) {
      db = new SQL.Database(fs.readFileSync(DB_PATH));
      db.run('PRAGMA foreign_keys = ON;');
      console.log('[DB] Database di-reload dari file');
    } else {
      console.error('[DB] File database tidak ditemukan saat reload');
    }
  });
}

module.exports = { initDB, run, runWithoutSave, queryAll, queryOne, queryCount, logActivity, getSetting, hitungStatus, saveDB, reloadDB, DB_PATH };
