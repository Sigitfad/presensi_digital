const express = require('express');
const { queryAll, queryOne, run, saveDB, runWithoutSave, logActivity, queryCount } = require('../database');
const { requireOperator } = require('./_helpers');
const router  = express.Router();

router.use(requireOperator);

router.get('/', (req,res) => {
  const data = queryAll('SELECT * FROM tahun_ajaran ORDER BY tanggal_mulai DESC');
  res.json({success:true,data});
});

router.post('/tambah', (req,res) => {
  const {nama,tanggal_mulai,tanggal_akhir} = req.body;
  if(!nama||!tanggal_mulai||!tanggal_akhir) return res.json({success:false,message:'Data tidak lengkap'});
  const duplikat = queryOne('SELECT id FROM tahun_ajaran WHERE nama=?',[nama]);
  if(duplikat) return res.json({success:false,message:'Nama tahun ajaran sudah ada'});
  runWithoutSave('INSERT INTO tahun_ajaran (nama,tanggal_mulai,tanggal_akhir,aktif) VALUES (?,?,?,0)',[nama,tanggal_mulai,tanggal_akhir]);
  saveDB();
  logActivity(req.session.operatorId,req.session.operatorNama,req.session.operatorRole,
              'Tambah Tahun Ajaran',`${nama} (${tanggal_mulai} s/d ${tanggal_akhir})`);
  res.json({success:true,message:'Tahun ajaran ditambahkan'});
});

router.post('/edit', (req,res) => {
  const {id,nama,tanggal_mulai,tanggal_akhir} = req.body;
  if(!id||!nama||!tanggal_mulai||!tanggal_akhir) return res.json({success:false,message:'Data tidak lengkap'});
  const duplikat = queryOne('SELECT id FROM tahun_ajaran WHERE nama=? AND id!=?',[nama,id]);
  if(duplikat) return res.json({success:false,message:'Nama tahun ajaran sudah digunakan'});
  const ta = queryOne('SELECT * FROM tahun_ajaran WHERE id=?',[id]);
  if(!ta) return res.json({success:false,message:'Data tidak ditemukan'});
  runWithoutSave('UPDATE tahun_ajaran SET nama=?,tanggal_mulai=?,tanggal_akhir=? WHERE id=?',[nama,tanggal_mulai,tanggal_akhir,id]);
  saveDB();
  logActivity(req.session.operatorId,req.session.operatorNama,req.session.operatorRole,
              'Edit Tahun Ajaran',`${ta.nama} -> ${nama}`);
  res.json({success:true,message:'Tahun ajaran berhasil diupdate'});
});

router.post('/hapus', (req,res) => {
  const {id} = req.body;
  const ta = queryOne('SELECT * FROM tahun_ajaran WHERE id=?',[id]);
  if(!ta) return res.json({success:false,message:'Data tidak ditemukan'});
  const siswaCount = queryCount('SELECT COUNT(*) as c FROM siswa WHERE tahun_ajaran_id=?',[id]);
  if(siswaCount>0) return res.json({success:false,message:`Tidak dapat menghapus: ${siswaCount} siswa masih terdaftar di tahun ajaran ini`});
  runWithoutSave('DELETE FROM tahun_ajaran WHERE id=?',[id]);
  saveDB();
  logActivity(req.session.operatorId,req.session.operatorNama,req.session.operatorRole,
              'Hapus Tahun Ajaran',`${ta.nama}`);
  res.json({success:true,message:'Tahun ajaran dihapus'});
});

router.post('/aktifkan', (req,res) => {
  const {id} = req.body;
  const ta = queryOne('SELECT * FROM tahun_ajaran WHERE id=?',[id]);
  if(!ta) return res.json({success:false,message:'Data tidak ditemukan'});
  runWithoutSave('UPDATE tahun_ajaran SET aktif=0');
  runWithoutSave('UPDATE tahun_ajaran SET aktif=1 WHERE id=?',[id]);
  saveDB();
  logActivity(req.session.operatorId,req.session.operatorNama,req.session.operatorRole,
              'Aktifkan Tahun Ajaran',`${ta.nama}`);
  res.json({success:true,message:`${ta.nama} diaktifkan`});
});

router.get('/aktif', (req,res) => {
  const ta = queryOne('SELECT * FROM tahun_ajaran WHERE aktif=1') || queryOne('SELECT * FROM tahun_ajaran ORDER BY id ASC LIMIT 1');
  res.json({success:true,data:ta});
});

module.exports = router;
