const express = require('express');
const { queryAll, run } = require('../database');
const router = express.Router();

function auth(req, res, next) {
  if (!req.session.operatorId) return res.status(401).json({ success: false });
  next();
}
router.use(auth);

router.get('/', (req, res) => {
  const data = queryAll('SELECT * FROM kelas ORDER BY nama ASC');
  res.json({ success: true, data });
});

router.post('/tambah', (req, res) => {
  if (req.session.operatorRole !== 'operator')
    return res.status(403).json({ success: false, message: 'Hanya Operator' });
  const { nama } = req.body;
  if (!nama || !nama.trim()) return res.json({ success: false, message: 'Nama kelas wajib diisi' });
  const clean = nama.trim();
  if (queryAll('SELECT id FROM kelas WHERE nama=?', [clean]).length)
    return res.json({ success: false, message: 'Kelas sudah ada' });
  run('INSERT INTO kelas (nama) VALUES (?)', [clean]);
  res.json({ success: true, message: 'Kelas ditambahkan' });
});

router.post('/hapus', (req, res) => {
  if (req.session.operatorRole !== 'operator')
    return res.status(403).json({ success: false, message: 'Hanya Operator' });
  const { id } = req.body;
  run('DELETE FROM kelas WHERE id=?', [id]);
  res.json({ success: true, message: 'Kelas dihapus' });
});

module.exports = router;
