const express = require('express');
const path    = require('path');
const fs      = require('fs');
const { saveDB, DB_PATH, queryAll, run, reloadDB, logActivity } = require('../database');
const router  = express.Router();

function auth(req,res,next){
  if(!req.session.operatorId) return res.status(401).json({success:false,message:'Silakan login'});
  next();
}
function requireOperator(req,res,next){
  if(req.session.operatorRole!=='operator')
    return res.status(403).json({success:false,message:'Hanya Operator yang dapat mengakses fitur backup'});
  next();
}
router.use(auth, requireOperator);

const BACKUP_DIR = path.join(__dirname,'../database/backups');
if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR,{recursive:true});

// Multer untuk upload file restore
const multer = require('multer');
const restoreStorage = multer.diskStorage({
  destination:(req,file,cb)=>cb(null,BACKUP_DIR),
  filename   :(req,file,cb)=>{
    const ts = new Date().toISOString().replace(/[:.]/g,'-').slice(0,19);
    const ext= path.extname(file.originalname).toLowerCase();
    cb(null,`imported_${ts}${ext}`);
  }
});
const uploadRestore = multer({
  storage: restoreStorage,
  limits : { fileSize: 50*1024*1024 }, // 50MB
  fileFilter:(req,file,cb)=>{
    const ext = path.extname(file.originalname).toLowerCase();
    if(ext==='.db'||ext==='.json') cb(null,true);
    else cb(new Error('Hanya file .db atau .json yang diizinkan'));
  }
});

// GET: daftar file backup
router.get('/', (req,res) => {
  try {
    const files = fs.existsSync(BACKUP_DIR)
      ? fs.readdirSync(BACKUP_DIR)
          .filter(f => f.endsWith('.db') || f.endsWith('.json'))
          .map(f => {
            const stat = fs.statSync(path.join(BACKUP_DIR,f));
            const ext  = path.extname(f).slice(1).toUpperCase();
            return {
              nama   : f,
              format : ext,
              ukuran : stat.size >= 1024*1024
                ? (stat.size/(1024*1024)).toFixed(1)+' MB'
                : Math.round(stat.size/1024)+' KB',
              tanggal: new Date(stat.mtime).toLocaleString('id-ID',{
                day:'2-digit',month:'short',year:'numeric',
                hour:'2-digit',minute:'2-digit'
              })
            };
          })
          .sort((a,b) => b.nama.localeCompare(a.nama))
      : [];
    res.json({success:true,data:files});
  } catch(e){ res.json({success:false,message:e.message}); }
});

// POST: buat backup .db
router.post('/buat-db', (req,res) => {
  try {
    saveDB();
    const ts       = new Date().toISOString().replace(/[:.]/g,'-').slice(0,19);
    const filename = `backup_${ts}.db`;
    fs.copyFileSync(DB_PATH, path.join(BACKUP_DIR,filename));
    logActivity(req.session.operatorId,req.session.operatorNama,
                req.session.operatorRole,'Backup Database (DB)',`File: ${filename}`);
    const verifySize = fs.statSync(path.join(BACKUP_DIR,filename)).size;
    res.json({
      success:true, message:'Backup .db berhasil dibuat', nama:filename,
      ukuran: verifySize >= 1024*1024 ? (verifySize/(1024*1024)).toFixed(1)+' MB' : Math.round(verifySize/1024)+' KB'
    });
  } catch(e){ res.json({success:false,message:e.message}); }
});

// POST: buat backup .json
router.post('/buat-json', (req,res) => {
  try {
    const ts       = new Date().toISOString().replace(/[:.]/g,'-').slice(0,19);
    const filename = `backup_${ts}.json`;
    const backup = {
      metadata   : { dibuat:new Date().toISOString(), versi:'2.2', aplikasi:'Presensi SDN Karangpawitan 1' },
      operators  : queryAll('SELECT * FROM operators'),
      siswa      : queryAll('SELECT * FROM siswa'),
      presensi   : queryAll('SELECT * FROM presensi'),
      settings   : queryAll('SELECT * FROM settings'),
      identitas_sekolah: queryAll('SELECT * FROM identitas_sekolah'),
      activity_log: queryAll('SELECT * FROM activity_log'),
      kelas: queryAll('SELECT * FROM kelas'),
      alumni: queryAll('SELECT * FROM alumni'),
    };
    fs.writeFileSync(path.join(BACKUP_DIR,filename), JSON.stringify(backup,null,2), 'utf-8');
    logActivity(req.session.operatorId,req.session.operatorNama,
                req.session.operatorRole,'Backup Database (JSON)',`File: ${filename}`);
    res.json({
      success:true, message:'Backup .json berhasil dibuat', nama:filename,
      jumlah:{ operator:backup.operators.length, siswa:backup.siswa.length, presensi:backup.presensi.length, kelas:backup.kelas?.length||0, alumni:backup.alumni?.length||0 }
    });
  } catch(e){ res.json({success:false,message:e.message}); }
});

// GET: download backup
router.get('/download/:nama', (req,res) => {
  const nama = req.params.nama;
  if(nama.includes('..') || nama.includes('/') || nama.includes('\\'))
    return res.status(400).json({success:false,message:'Nama file tidak valid'});
  const filePath = path.join(BACKUP_DIR,nama);
  if (!fs.existsSync(filePath)) return res.status(404).json({success:false,message:'File tidak ditemukan'});
  res.download(filePath);
});

// POST: upload/import file backup dari komputer
router.post('/import', uploadRestore.single('file'), (req,res) => {
  if(!req.file) return res.json({success:false,message:'File tidak ditemukan'});
  logActivity(req.session.operatorId,req.session.operatorNama,
              req.session.operatorRole,'Import Backup',`File: ${req.file.filename}`);
  res.json({
    success : true,
    message : `File berhasil diimport ke daftar backup`,
    nama    : req.file.filename,
    format  : path.extname(req.file.filename).slice(1).toUpperCase()
  });
});

// POST: hapus backup
router.post('/hapus', (req,res) => {
  const {nama} = req.body;
  if(!nama||nama.includes('..')) return res.json({success:false,message:'Nama file tidak valid'});
  const filePath = path.join(BACKUP_DIR,nama);
  if(!fs.existsSync(filePath)) return res.json({success:false,message:'File tidak ada'});
  fs.unlinkSync(filePath);
  logActivity(req.session.operatorId,req.session.operatorNama,
              req.session.operatorRole,'Hapus Backup',`File: ${nama}`);
  res.json({success:true,message:'Backup dihapus'});
});

// POST: restore dari .db
router.post('/restore', async (req,res) => {
  const {nama} = req.body;
  if(!nama || !nama.endsWith('.db'))
    return res.json({success:false,message:'Hanya file .db yang dapat di-restore'});
  const filePath = path.join(BACKUP_DIR,nama);
  if(!fs.existsSync(filePath))
    return res.json({success:false,message:'File backup tidak ditemukan'});

  try {
    saveDB();
    const ts = new Date().toISOString().replace(/[:.]/g,'-').slice(0,19);
    fs.copyFileSync(DB_PATH, path.join(BACKUP_DIR,`sebelum_restore_${ts}.db`));

    const backupData = fs.readFileSync(filePath);
    fs.writeFileSync(DB_PATH, backupData);

    logActivity(req.session.operatorId,req.session.operatorNama,
                req.session.operatorRole,'Restore Database',`Dari: ${nama}`);

    res.json({success:true, message:'Restore berhasil! Halaman akan dimuat ulang dalam 5 detik...'});
    setTimeout(async () => {
      try {
        await reloadDB();
        console.log('[RESTORE] Database berhasil di-reload.');
      } catch(e) { console.error('[RESTORE] Gagal reload DB:', e.message); }
    }, 1000);

  } catch(e){ res.json({success:false,message:'Restore gagal: '+e.message}); }
});

// POST: restore dari .json
router.post('/restore-json', async (req,res) => {
  const {nama} = req.body;
  if(!nama || !nama.endsWith('.json'))
    return res.json({success:false,message:'Hanya file .json yang dapat di-restore'});
  const filePath = path.join(BACKUP_DIR,nama);
  if(!fs.existsSync(filePath))
    return res.json({success:false,message:'File backup tidak ditemukan'});

  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const backup = JSON.parse(raw);

    if(!backup.operators && !backup.siswa && !backup.presensi)
      return res.json({success:false,message:'Format file JSON tidak valid (tidak ditemukan data operators/siswa/presensi)'});

    // Backup dulu
    saveDB();
    const ts = new Date().toISOString().replace(/[:.]/g,'-').slice(0,19);
    fs.copyFileSync(DB_PATH, path.join(BACKUP_DIR,`sebelum_restore_${ts}.db`));

    // Clear existing data
    run('DELETE FROM presensi');
    run('DELETE FROM siswa');
    run('DELETE FROM activity_log');

    // Restore operators
    if(backup.operators && backup.operators.length){
      backup.operators.forEach(op => {
        const existing = queryOne('SELECT id FROM operators WHERE id=?',[op.id]);
        if(existing){
          run('UPDATE operators SET nama=?,role=?,no_hp=?,email=?,foto=?,pengampu_kelas=?,nip=?,alamat=?,bidang_keahlian=?,uid=? WHERE id=?',
            [op.nama,op.role,op.no_hp||'',op.email||'',op.foto||'',op.pengampu_kelas||'Semua',op.nip||'',op.alamat||'',op.bidang_keahlian||'',op.uid||'',op.id]);
        } else {
          run('INSERT INTO operators (nama,role,no_hp,email,foto,pengampu_kelas,nip,alamat,bidang_keahlian,uid) VALUES (?,?,?,?,?,?,?,?,?,?)',
            [op.nama,op.role,op.no_hp||'',op.email||'',op.foto||'',op.pengampu_kelas||'Semua',op.nip||'',op.alamat||'',op.bidang_keahlian||'',op.uid||'']);
        }
      });
    }

    // Restore siswa
    if(backup.siswa && backup.siswa.length){
      backup.siswa.forEach(s => {
        run('INSERT INTO siswa (nisn,nama,kelas,jenis_kelamin,foto,no_hp_ortu,nik,tempat_lahir,tanggal_lahir,agama,alamat,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)',
          [s.nisn,s.nama,s.kelas,s.jenis_kelamin,s.foto||'',s.no_hp_ortu||'',s.nik||'',s.tempat_lahir||'',s.tanggal_lahir||'',s.agama||'',s.alamat||'',s.created_at||'',s.updated_at||'']);
      });
    }

    // Restore presensi
    if(backup.presensi && backup.presensi.length){
      backup.presensi.forEach(p => {
        try {
          const siswa = queryAll('SELECT id FROM siswa WHERE nisn=?',
            [queryAll('SELECT nisn FROM siswa WHERE id=?',[p.siswa_id]).length ? queryAll('SELECT nisn FROM siswa WHERE id=?',[p.siswa_id])[0].nisn : '']);
          if(siswa.length){
            run('INSERT OR IGNORE INTO presensi (siswa_id,tanggal,jam_masuk,status,keterangan,created_at) VALUES (?,?,?,?,?,?)',
              [siswa[0].id,p.tanggal,p.jam_masuk,p.status,p.keterangan||'',p.created_at||'']);
          }
        } catch(e){}
      });
    }

    // Restore settings
    if(backup.settings && backup.settings.length){
      backup.settings.forEach(s => {
        run('INSERT OR REPLACE INTO settings (key,value) VALUES (?,?)',[s.key,s.value]);
      });
    }

    // Restore identitas_sekolah
    if(backup.identitas_sekolah && backup.identitas_sekolah.length){
      const identitas = backup.identitas_sekolah[0];
      run('INSERT OR REPLACE INTO identitas_sekolah (id,nama_sekolah,alamat,logo,tahun_ajaran,telp,email,website) VALUES (?,?,?,?,?,?,?,?)',
        [1,identitas.nama_sekolah||'SDN Karangpawitan 1',identitas.alamat||'',identitas.logo||'',identitas.tahun_ajaran||'2024/2025',identitas.telp||'',identitas.email||'',identitas.website||'']);
    }

    // Restore kelas
    if(backup.kelas && backup.kelas.length){
      run('DELETE FROM kelas');
      backup.kelas.forEach(k => {
        run('INSERT INTO kelas (id,nama) VALUES (?,?)',[k.id,k.nama]);
      });
    }

    // Restore activity_log
    if(backup.activity_log && backup.activity_log.length){
      run('DELETE FROM activity_log');
      backup.activity_log.forEach(al => {
        try {
          run('INSERT INTO activity_log (user_id,user_nama,role,aksi,detail,ip_address,created_at) VALUES (?,?,?,?,?,?,?)',
            [al.user_id,al.user_nama,al.role,al.aksi,al.detail||'',al.ip_address||'',al.created_at||'']);
        } catch(e){}
      });
    }

    // Restore alumni
    if(backup.alumni && backup.alumni.length){
      run('DELETE FROM alumni');
      backup.alumni.forEach(a => {
        try {
          run('INSERT INTO alumni (nama,nisn,kelas_lulus,tahun_lulus,foto,ijazah,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)',
            [a.nama,a.nisn,a.kelas_lulus,a.tahun_lulus,a.foto||'',a.ijazah||'',a.created_at||'',a.updated_at||'']);
        } catch(e){}
      });
    }

    saveDB();
    logActivity(req.session.operatorId,req.session.operatorNama,
                req.session.operatorRole,'Restore Database',`Dari JSON: ${nama}`);

    res.json({success:true, message:'Restore berhasil! Halaman akan dimuat ulang dalam 5 detik...'});
    setTimeout(async () => {
      try {
        await reloadDB();
        console.log('[RESTORE] Database berhasil di-reload dari JSON.');
      } catch(e) { console.error('[RESTORE] Gagal reload DB:', e.message); }
    }, 1000);

  } catch(e){ res.json({success:false,message:'Restore gagal: '+e.message}); }
});

module.exports = router;
