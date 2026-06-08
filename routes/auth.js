const express  = require('express');
const bcrypt   = require('bcryptjs');
const path     = require('path');
const { queryOne, run, logActivity } = require('../database');
const router   = express.Router();
const VIEWS    = path.join(__dirname, '../views');

router.get('/login', (req,res) => {
  if (req.session.operatorId) return res.redirect('/pages/dashboard');
  res.sendFile(path.join(VIEWS,'login.html'));
});

router.post('/login', (req,res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.json({ success:false, message:'Username dan password wajib diisi!' });

  const op = queryOne('SELECT * FROM operators WHERE username=?', [username]);
  if (!op || !bcrypt.compareSync(password, op.password))
    return res.json({ success:false, message:'Username atau password salah!' });

  req.session.operatorId        = op.id;
  req.session.operatorNama      = op.nama;
  req.session.operatorUsername  = op.username;
  req.session.operatorRole      = op.role;
  req.session.operatorFoto      = op.foto || '';
  req.session.pengampuKelas     = op.pengampu_kelas || 'Semua';
  req.session.operatorBidang    = op.bidang_keahlian || '';

  const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '';
  logActivity(op.id, op.nama, op.role, 'Login', `Login dari IP: ${ip}`, ip);
  res.json({ success:true, redirect:'/pages/dashboard' });
});

router.get('/register', (req,res) => {
  if (req.session.operatorId) return res.redirect('/pages/dashboard');
  res.sendFile(path.join(VIEWS,'register.html'));
});

router.post('/register', (req,res) => {
  const { nama, username, password, konfirmasi } = req.body;
  if (!nama||!username||!password) return res.json({success:false,message:'Semua field wajib diisi!'});
  if (password.length<6) return res.json({success:false,message:'Password minimal 6 karakter!'});
  if (password!==konfirmasi) return res.json({success:false,message:'Konfirmasi password tidak cocok!'});
  if (queryOne('SELECT id FROM operators WHERE username=?',[username]))
    return res.json({success:false,message:'Username sudah digunakan!'});
  const hash = bcrypt.hashSync(password,10);
  run('INSERT INTO operators (nama,username,password,role,pengampu_kelas) VALUES (?,?,?,?,?)',
      [nama,username,hash,'operator','Semua']);
  res.json({success:true,message:'Registrasi berhasil! Silakan login.'});
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
    username       : req.session.operatorUsername,
    role           : req.session.operatorRole,
    foto           : req.session.operatorFoto || '',
    pengampuKelas  : req.session.pengampuKelas || 'Semua',
    bidangKeahlian : bidang
  });
});

module.exports = router;
