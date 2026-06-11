const express  = require('express');
const path     = require('path');
const { queryOne, run, logActivity } = require('../database');
const router   = express.Router();
const VIEWS    = path.join(__dirname, '../views');

router.get('/login', (req,res) => {
  if (req.session.operatorId) return res.redirect('/pages/dashboard');
  res.sendFile(path.join(VIEWS,'login.html'));
});

router.post('/login', (req,res) => {
  const { uid } = req.body;
  if(!uid) return res.json({success:false,message:'UID wajib diisi!'});
  if(uid.length!==10) return res.json({success:false,message:'UID harus 10 digit!'});
  const op = queryOne('SELECT * FROM operators WHERE uid=?', [uid]);
  if(!op) return res.json({success:false,message:'UID tidak terdaftar!'});

  req.session.operatorId        = op.id;
  req.session.operatorNama      = op.nama;
  req.session.operatorRole      = op.role;
  req.session.operatorFoto      = op.foto || '';
  req.session.pengampuKelas     = op.pengampu_kelas || 'Semua';
  req.session.operatorBidang    = op.bidang_keahlian || '';

  const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '';
  logActivity(op.id, op.nama, op.role, 'Login', `Login dari IP: ${ip}`, ip);
  return res.json({ success:true, redirect:'/pages/dashboard' });
});

router.get('/logout', (req,res) => {
  if (req.session.operatorId) {
    logActivity(req.session.operatorId, req.session.operatorNama,
                req.session.operatorRole, 'Logout', 'Keluar dari sistem');
  }
  req.session.destroy(() => res.redirect('/login'));
});

router.get('/api/session', (req,res) => {
  if (!req.session.operatorId) return res.json({loggedIn:false});
  let bidang = req.session.operatorBidang || '';
  if(!bidang){
    const u = queryOne('SELECT bidang_keahlian FROM operators WHERE id=?',[req.session.operatorId]);
    if(u) bidang = u.bidang_keahlian || '';
  }
  res.json({
    loggedIn       : true,
    id             : req.session.operatorId,
    nama           : req.session.operatorNama,
    role           : req.session.operatorRole,
    foto           : req.session.operatorFoto || '',
    pengampuKelas  : req.session.pengampuKelas || 'Semua',
    bidangKeahlian : bidang
  });
});

module.exports = router;
