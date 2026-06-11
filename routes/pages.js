const express = require('express');
const path    = require('path');
const router  = express.Router();
const VIEWS   = path.join(__dirname, '../views');

function auth(req,res,next) {
  if (!req.session.operatorId) return res.redirect('/login');
  next();
}

function requireOperator(req,res,next) {
  if (!req.session.operatorId) return res.redirect('/login');
  if (req.session.operatorRole !== 'operator') {
    return res.status(403).sendFile(path.join(VIEWS,'forbidden.html'));
  }
  next();
}

router.use(auth);

// Halaman utama
router.get('/dashboard',  (req,res) => res.sendFile(path.join(VIEWS,'dashboard.html')));
router.get('/siswa',      (req,res) => res.sendFile(path.join(VIEWS,'siswa.html')));
router.get('/scan',       (req,res) => res.sendFile(path.join(VIEWS,'scan.html')));
router.get('/riwayat',    (req,res) => res.sendFile(path.join(VIEWS,'riwayat.html')));
router.get('/rekap',      (req,res) => res.sendFile(path.join(VIEWS,'rekap.html')));
router.get('/qrcode',     (req,res) => res.redirect('/pages/dashboard'));
router.get('/actlog',     (req,res) => res.sendFile(path.join(VIEWS,'actlog.html')));

// Halaman detail View
router.get('/view-siswa', (req,res) => res.sendFile(path.join(VIEWS,'view_siswa.html')));
router.get('/view-user',  (req,res) => res.sendFile(path.join(VIEWS,'view_user.html')));

// Halaman operator only
router.get('/users',     requireOperator, (req,res) => res.sendFile(path.join(VIEWS,'users.html')));
router.get('/alumni',    requireOperator, (req,res) => res.sendFile(path.join(VIEWS,'alumni.html')));
router.get('/settings',  requireOperator, (req,res) => res.sendFile(path.join(VIEWS,'settings.html')));
router.get('/backup',    requireOperator, (req,res) => res.sendFile(path.join(VIEWS,'backup.html')));
router.get('/pindahan',  requireOperator, (req,res) => res.sendFile(path.join(VIEWS,'pindahan.html')));

module.exports = router;
