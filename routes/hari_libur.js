const express = require('express');
const https = require('https');
const { queryAll, queryOne, run, runWithoutSave, saveDB, logActivity } = require('../database');
const { requireOperator } = require('./_helpers');
const router  = express.Router();

router.use(requireOperator);

router.get('/', (req,res) => {
  const {tahun='', sumber=''} = req.query;
  let sql = 'SELECT * FROM hari_libur WHERE 1=1';
  const params = [];
  if(tahun) { sql += ' AND tanggal>=? AND tanggal<=?'; params.push(`${tahun}-01-01`,`${tahun}-12-31`); }
  if(sumber) { sql += ' AND sumber=?'; params.push(sumber); }
  sql += ' ORDER BY tanggal DESC';
  const data = queryAll(sql, params);
  res.json({success:true,data});
});

const TIPE_VALID = ['nasional','cuti_bersama','libur_sekolah','kegiatan_sekolah'];

router.post('/tambah', (req,res) => {
  const {tanggal,keterangan,tipe} = req.body;
  if(!tanggal) return res.json({success:false,message:'Tanggal wajib diisi'});
  const tipeVal = TIPE_VALID.includes(tipe) ? tipe : 'nasional';
  const existing = queryOne('SELECT id FROM hari_libur WHERE tanggal=?',[tanggal]);
  if(existing) return res.json({success:false,message:'Tanggal ini sudah terdaftar sebagai hari libur'});
  run('INSERT INTO hari_libur (tanggal,keterangan,tipe,sumber) VALUES (?,?,?,?)',[tanggal,keterangan||'',tipeVal,'sekolah']);
  logActivity(req.session.operatorId,req.session.operatorNama,req.session.operatorRole,
              'Tambah Hari Libur',`${tanggal} - ${keterangan||'-'} (${tipeVal})`);
  res.json({success:true,message:'Hari libur ditambahkan'});
});

router.post('/hapus', (req,res) => {
  const {id} = req.body;
  const libur = queryOne('SELECT * FROM hari_libur WHERE id=?',[id]);
  if(!libur) return res.json({success:false,message:'Data tidak ditemukan'});
  run('DELETE FROM hari_libur WHERE id=?',[id]);
  logActivity(req.session.operatorId,req.session.operatorNama,req.session.operatorRole,
              'Hapus Hari Libur',`${libur.tanggal} - ${libur.keterangan||'-'}`);
  res.json({success:true,message:'Hari libur dihapus'});
});

router.post('/edit', (req,res) => {
  const {id,tanggal,keterangan,tipe} = req.body;
  if(!id||!tanggal) return res.json({success:false,message:'Data tidak lengkap'});
  const tipeVal = TIPE_VALID.includes(tipe) ? tipe : 'nasional';
  const duplikat = queryOne('SELECT id FROM hari_libur WHERE tanggal=? AND id!=?',[tanggal,id]);
  if(duplikat) return res.json({success:false,message:'Tanggal ini sudah terdaftar sebagai hari libur'});
  const libur = queryOne('SELECT * FROM hari_libur WHERE id=?',[id]);
  if(!libur) return res.json({success:false,message:'Data tidak ditemukan'});
  run('UPDATE hari_libur SET tanggal=?,keterangan=?,tipe=? WHERE id=?',[tanggal,keterangan||'',tipeVal,id]);
  logActivity(req.session.operatorId,req.session.operatorNama,req.session.operatorRole,
              'Edit Hari Libur',`${libur.tanggal} -> ${tanggal} - ${keterangan||'-'} (${tipeVal})`);
  res.json({success:true,message:'Hari libur berhasil diupdate'});
});

router.post('/sync', (req, res) => {
  const { tahun } = req.body;
  const year = tahun || String(new Date().getFullYear());

  https.get(`https://libur.deno.dev/api?year=${year}`, (apiRes) => {
    let raw = '';
    apiRes.on('data', chunk => raw += chunk);
    apiRes.on('end', () => {
      try {
        const holidays = JSON.parse(raw);
        if (!Array.isArray(holidays)) throw new Error('Format data tidak dikenali');
        let added = 0, skipped = 0, updated = 0;
        holidays.forEach(h => {
          const existing = queryOne('SELECT id,sumber FROM hari_libur WHERE tanggal=?', [h.date]);
          const tipe = h.is_national_holiday ? 'nasional' : 'cuti_bersama';
          if (!existing) {
            runWithoutSave('INSERT INTO hari_libur (tanggal,keterangan,tipe,sumber) VALUES (?,?,?,?)', [h.date, h.name, tipe, 'indonesia']);
            added++;
          } else {
            if (existing.sumber !== 'indonesia') {
              runWithoutSave('UPDATE hari_libur SET keterangan=?,tipe=?,sumber=? WHERE id=?', [h.name, tipe, 'indonesia', existing.id]);
              updated++;
            } else {
              skipped++;
            }
          }
        });
        saveDB();
        logActivity(req.session.operatorId, req.session.operatorNama, req.session.operatorRole,
                    'Sync Hari Libur', `${added} ditambahkan, ${updated} diperbarui, ${skipped} sudah ada (${year})`);
        res.json({ success: true, message: `Sync berhasil: ${added} ditambahkan, ${updated} diperbarui, ${skipped} sudah ada`, added, updated, skipped });
      } catch (e) {
        res.json({ success: false, message: 'Gagal memproses data: ' + e.message });
      }
    });
  }).on('error', e => {
    res.json({ success: false, message: 'Gagal terhubung ke server: ' + e.message });
  });
});

router.post('/hapus-bulk', (req,res) => {
  const { ids } = req.body;
  if (!ids || !Array.isArray(ids) || ids.length === 0) return res.json({ success: false, message: 'Tidak ada data dipilih' });
  const valid = ids.filter(id => queryOne('SELECT id FROM hari_libur WHERE id=?', [id]));
  if (valid.length === 0) return res.json({ success: false, message: 'Data tidak ditemukan' });
  valid.forEach(id => { runWithoutSave('DELETE FROM hari_libur WHERE id=?', [id]); });
  saveDB();
  logActivity(req.session.operatorId, req.session.operatorNama, req.session.operatorRole,
              'Hapus Banyak Hari Libur', `${valid.length} data dihapus`);
  res.json({ success: true, message: `${valid.length} data berhasil dihapus` });
});

module.exports = router;
