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

    CREATE TABLE IF NOT EXISTS tahun_ajaran (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      nama          TEXT NOT NULL UNIQUE,
      tanggal_mulai TEXT NOT NULL,
      tanggal_akhir TEXT NOT NULL,
      aktif         INTEGER NOT NULL DEFAULT 0,
      created_at    TEXT DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS hari_libur (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      tanggal    TEXT NOT NULL UNIQUE,
      keterangan TEXT DEFAULT '',
      tipe       TEXT NOT NULL DEFAULT 'nasional'
                   CHECK(tipe IN ('nasional','cuti_bersama')),
      created_at TEXT DEFAULT (datetime('now','localtime'))
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

  // Migrasi: tambah tahun_ajaran_id ke siswa & presensi
  const _tCols = {};
  _tCols.siswa = queryAll('PRAGMA table_info(siswa)').map(c=>c.name);
  _tCols.presensi = queryAll('PRAGMA table_info(presensi)').map(c=>c.name);
  if(!_tCols.siswa.includes('tahun_ajaran_id')) {
    try { db.run("ALTER TABLE siswa ADD COLUMN tahun_ajaran_id INTEGER DEFAULT 1"); saveDB(); console.log('[DB] Migrasi: siswa.tahun_ajaran_id'); } catch(e) { console.log('[DB] Migrasi siswa.tahun_ajaran_id skip:', e.message); }
  }
  if(!_tCols.presensi.includes('tahun_ajaran_id')) {
    try {
      // Recreate presensi table to add column + updated UNIQUE constraint
      const _oldPresensi = queryAll('SELECT * FROM presensi');
      db.run("DROP TABLE IF EXISTS presensi");
      db.run(`CREATE TABLE IF NOT EXISTS presensi (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        siswa_id   INTEGER NOT NULL,
        tanggal    TEXT NOT NULL,
        jam_masuk  TEXT NOT NULL,
        status     TEXT NOT NULL DEFAULT 'Hadir'
                     CHECK(status IN ('Hadir','Terlambat','Izin','Sakit','Alpha')),
        tahun_ajaran_id INTEGER DEFAULT 1,
        keterangan TEXT DEFAULT '',
        created_at TEXT DEFAULT (datetime('now','localtime')),
        FOREIGN KEY (siswa_id) REFERENCES siswa(id) ON DELETE CASCADE,
        UNIQUE(siswa_id, tanggal, tahun_ajaran_id)
      )`);
      if(_oldPresensi.length) {
        const _ins = db.prepare('INSERT INTO presensi (id,siswa_id,tanggal,jam_masuk,status,keterangan,created_at) VALUES (?,?,?,?,?,?,?)');
        _oldPresensi.forEach(r => { try { _ins.bind([r.id, r.siswa_id, r.tanggal, r.jam_masuk, r.status, r.keterangan||'', r.created_at]); _ins.step(); _ins.reset(); } catch(e2) {} });
        _ins.free();
      }
      saveDB();
      console.log('[DB] Migrasi: presensi.tahun_ajaran_id + UNIQUE diperbarui');
    } catch(e) { console.log('[DB] Migrasi presensi.tahun_ajaran_id skip:', e.message); }
  }

  // Seed tahun_ajaran default
  if(queryCount('SELECT COUNT(*) as c FROM tahun_ajaran') === 0) {
    const _thn = new Date().getFullYear();
    const _sekarang = _thn - 1;
    const _next = _thn;
    try { runWithoutSave(`INSERT INTO tahun_ajaran (nama,tanggal_mulai,tanggal_akhir,aktif) VALUES ('${_sekarang}/${_thn}','${_sekarang}-07-01','${_thn}-06-30',1)`); } catch(e) {}
    try { runWithoutSave(`INSERT INTO tahun_ajaran (nama,tanggal_mulai,tanggal_akhir,aktif) VALUES ('${_thn}/${_next+1}','${_thn}-07-01','${_next+1}-06-30',0)`); } catch(e) {}
    saveDB();
    console.log('[DB] Tahun ajaran default dibuat');
  }

  // Migrasi: tambah kolom sumber ke hari_libur
  try { db.run("ALTER TABLE hari_libur ADD COLUMN sumber TEXT NOT NULL DEFAULT 'sekolah'"); saveDB(); console.log('[DB] Migrasi: hari_libur.sumber'); } catch(e) {}

  // Migrasi: perluas CHECK constraint tipe (nasional,cuti_bersama -> +libur_sekolah,kegiatan_sekolah)
  try {
    const tCols = queryAll("PRAGMA table_info('hari_libur')").map(c=>c.name);
    if (tCols.includes('sumber')) {
      const sqlCheck = "SELECT sql FROM sqlite_master WHERE type='table' AND name='hari_libur'";
      const def = queryOne(sqlCheck);
      if (def && def.sql && def.sql.includes("CHECK(tipe IN ('nasional','cuti_bersama'))")) {
        db.run("ALTER TABLE hari_libur RENAME TO hari_libur_old");
        db.run(`CREATE TABLE IF NOT EXISTS hari_libur (
          id         INTEGER PRIMARY KEY AUTOINCREMENT,
          tanggal    TEXT NOT NULL UNIQUE,
          keterangan TEXT DEFAULT '',
          tipe       TEXT NOT NULL DEFAULT 'nasional'
                       CHECK(tipe IN ('nasional','cuti_bersama','libur_sekolah','kegiatan_sekolah')),
          sumber     TEXT NOT NULL DEFAULT 'sekolah',
          created_at TEXT DEFAULT (datetime('now','localtime'))
        )`);
        db.run("INSERT INTO hari_libur (id,tanggal,keterangan,tipe,sumber,created_at) SELECT id,tanggal,keterangan,tipe,sumber,created_at FROM hari_libur_old");
        db.run("DROP TABLE hari_libur_old");
        saveDB();
        console.log('[DB] Migrasi: hari_libur.tipe diperluas');
      }
    }
  } catch(e) { console.log('[DB] Migrasi tipe skip:', e.message); }

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

  const defaults = { 'jam_masuk':'07:00','batas_terlambat':'07:00','batas_alpha':'07:30','backup_otomatis':'false' };
  Object.entries(defaults).forEach(([k,v]) => {
    if (!queryOne('SELECT key FROM settings WHERE key=?',[k]))
      run('INSERT INTO settings (key,value) VALUES (?,?)',[k,v]);
  });

  if (!queryOne('SELECT id FROM identitas_sekolah WHERE id=1')) {
    run(`INSERT INTO identitas_sekolah (id,nama_sekolah,alamat,tahun_ajaran)
         VALUES (1,'SDN Karangpawitan 1','Jl. Karangpawitan No.1','2024/2025')`);
  }
  // Migration: add foto_opsi column if not exists
  const _idCols=queryAll('PRAGMA table_info(identitas_sekolah)');
  if (!_idCols.find(c=>c.name==='foto_opsi'))
    runWithoutSave('ALTER TABLE identitas_sekolah ADD COLUMN foto_opsi TEXT DEFAULT \'\'');

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
  const jamSekolah = getSetting('jam_masuk','07:00');
  const batas = getSetting('batas_terlambat','07:00');
  const [sH,sM] = jamSekolah.split(':').map(Number);
  const [bH,bM] = batas.split(':').map(Number);
  const [jH,jM] = jamMasuk.split(':').map(Number);
  const total = jH*60+jM;
  if (total < sH*60+sM) return 'BELUM_WAKTU';
  return total <= bH*60+bM ? 'Hadir' : 'Terlambat';
}

function getHariLibur(tglAwal, tglAkhir) {
  return queryAll('SELECT tanggal, keterangan FROM hari_libur WHERE tanggal>=? AND tanggal<=? ORDER BY tanggal ASC', [tglAwal, tglAkhir]);
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

function getActiveTahunAjaran() { return queryOne('SELECT * FROM tahun_ajaran WHERE aktif=1') || queryOne('SELECT * FROM tahun_ajaran ORDER BY id ASC LIMIT 1'); }

module.exports = { initDB, run, runWithoutSave, queryAll, queryOne, queryCount, logActivity, getSetting, hitungStatus, saveDB, reloadDB, DB_PATH, getHariLibur, getActiveTahunAjaran };
