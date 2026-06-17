const express = require('express');
const { queryAll, logActivity } = require('../database');
const { auth } = require('./_helpers');
const router  = express.Router();

router.use(auth);

router.get('/', (req,res) => {
  const { limit=100, user='', aksi='' } = req.query;
  let sql = 'SELECT a.*, o.bidang_keahlian FROM activity_log a LEFT JOIN operators o ON a.user_id=o.id WHERE 1=1';
  const p = [];
  if(user) { sql+=' AND user_nama LIKE ?'; p.push(`%${user}%`); }
  if(aksi && aksi !== 'Semua') { sql+=' AND aksi LIKE ?'; p.push(`%${aksi}%`); }
  sql += ' ORDER BY created_at DESC LIMIT ?';
  p.push(parseInt(limit));
  res.json({success:true, data:queryAll(sql,p)});
});

router.post('/tambah', (req,res) => {
  const { userId, userNama, role, aksi, detail } = req.body;
  if(!aksi) return res.json({success:false, message:'Parameter aksi wajib'});
  const ip = req.ip || req.connection.remoteAddress || '';
  logActivity(userId||0, userNama||'', role||'', aksi, detail||'', ip);
  res.json({success:true});
});

module.exports = router;
