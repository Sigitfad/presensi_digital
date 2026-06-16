const express = require('express');
const { queryAll, queryOne, queryCount } = require('../database');
const router  = express.Router();

function auth(req,res,next){
  if(!req.session.operatorId) return res.status(401).json({success:false});
  next();
}
router.use(auth);

function getKelasFilter(req) {
  const role  = req.session.operatorRole;
  const kelas = req.session.pengampuKelas || 'Semua';
  if (role === 'operator') return null;
  if (kelas === 'Semua')   return null;
  const arr = kelas.split(',').map(k=>k.trim()).filter(Boolean);
  return arr.length > 1 ? arr : arr[0] || null;
}

function applyKelasFilter(sql, params, kelasFilter, kelasQuery) {
  const allowed = kelasFilter ? (Array.isArray(kelasFilter) ? kelasFilter : [kelasFilter]) : [];
  if(kelasQuery.trim() && allowed.length && allowed.includes(kelasQuery.trim())){
    sql.push('kelas=?'); params.push(kelasQuery.trim());
  } else if(allowed.length){
    sql.push(`kelas IN (${allowed.map(()=>'?').join(',')})`); params.push(...allowed);
  } else if(kelasQuery.trim()){
    sql.push('kelas=?'); params.push(kelasQuery.trim());
  }
  return {sql,params};
}

function hitungHariEfektif(tahun, bulan) {
  const thn=parseInt(tahun), bln=parseInt(bulan)-1;
  const dim=new Date(thn,bln+1,0).getDate();
  let count=0;
  for(let d=1;d<=dim;d++) if(new Date(thn,bln,d).getDay()!==0) count++;
  return count;
}

// GET: rekap per siswa — filter kelas WAJIB diproses di server
router.get('/', (req,res) => {
  const {bulan='',tahun='',kelas=''} = req.query;
  const now=new Date();
  const thn=tahun||now.getFullYear();
  const bln=(bulan||String(now.getMonth()+1)).padStart(2,'0');
  const tglAwal =`${thn}-${bln}-01`;
  const tglAkhir=`${thn}-${bln}-31`;
  const hariEfektif=hitungHariEfektif(thn,bln);

  let siswaSQL='SELECT id,nisn,nama,kelas,jenis_kelamin FROM siswa WHERE 1=1';
  const siswaP=[];
  const where=[];
  const kelasFilter=getKelasFilter(req);
  const {sql:ws}=applyKelasFilter(where, siswaP, kelasFilter, kelas);
  if(ws.length) siswaSQL+=' AND '+ws.join(' AND ');
  siswaSQL+=' ORDER BY kelas ASC,nama ASC';

  const semuaSiswa=queryAll(siswaSQL,siswaP);
  const ids=semuaSiswa.map(s=>s.id);
  let presensiBatch=[];
  if(ids.length){
    const ph=ids.map(()=>'?').join(',');
    presensiBatch=queryAll(
      `SELECT siswa_id,status FROM presensi WHERE siswa_id IN (${ph}) AND tanggal>=? AND tanggal<=?`,
      [...ids,tglAwal,tglAkhir]
    );
  }
  const countMap={};
  presensiBatch.forEach(p=>{
    if(!countMap[p.siswa_id]) countMap[p.siswa_id]={hadir:0,terlambat:0,izin:0,sakit:0,alpha:0};
    const m=countMap[p.siswa_id];
    if(p.status==='Hadir')m.hadir++;
    else if(p.status==='Terlambat'){m.hadir++;m.terlambat++;}
    else if(p.status==='Izin')m.izin++;
    else if(p.status==='Sakit')m.sakit++;
    else if(p.status==='Alpha')m.alpha++;
  });
  const rekap=semuaSiswa.map(s=>{
    const m=countMap[s.id]||{};
    const hadir=m.hadir||0,terlambat=m.terlambat||0,izin=m.izin||0,sakit=m.sakit||0,alpha0=m.alpha||0;
    const tidakHadir=hariEfektif-hadir-izin-sakit-alpha0;
    const alpha=alpha0+(tidakHadir>0?tidakHadir:0);
    const pct=hariEfektif>0?Math.round((hadir/hariEfektif)*100):0;
    return {...s,hadir,terlambat,izin,sakit,alpha,total:hariEfektif,persentase:pct};
  });

  res.json({success:true,data:rekap,hariEfektif,bulan:bln,tahun:thn});
});

// GET: rekap per kelas
router.get('/perkelas', (req,res) => {
  const {bulan='',tahun='',kelas=''} = req.query;
  const now=new Date();
  const thn=tahun||now.getFullYear();
  const bln=(bulan||String(now.getMonth()+1)).padStart(2,'0');
  const tglAwal =`${thn}-${bln}-01`;
  const tglAkhir=`${thn}-${bln}-31`;
  const hariEfektif=hitungHariEfektif(thn,bln);

  const kelasFilter=getKelasFilter(req);
  let kelasSQL='SELECT DISTINCT kelas FROM siswa WHERE 1=1';
  const where2=[]; const wp2=[];
  const {sql:ws2,params:wp2r}=applyKelasFilter(where2, wp2, kelasFilter, kelas);
  if(ws2.length) kelasSQL+=' AND '+ws2.join(' AND ');
  kelasSQL+=' ORDER BY kelas ASC';
  const kelasList=queryAll(kelasSQL, wp2r).map(k=>k.kelas);

  let semuaSiswaKelas=queryAll(
    `SELECT id,kelas FROM siswa WHERE 1=1 AND (${ws2.length?ws2.join(' AND '):'1=1'}) ORDER BY kelas ASC`,
    wp2r
  );
  const kelasMap={};
  semuaSiswaKelas.forEach(s=>{
    if(!kelasMap[s.kelas]) kelasMap[s.kelas]={ids:[],count:0};
    kelasMap[s.kelas].ids.push(s.id);
    kelasMap[s.kelas].count++;
  });
  let presensiBatch=[];
  const allIds=semuaSiswaKelas.map(s=>s.id);
  if(allIds.length){
    const ph=allIds.map(()=>'?').join(',');
    presensiBatch=queryAll(
      `SELECT siswa_id,status FROM presensi WHERE siswa_id IN (${ph}) AND tanggal>=? AND tanggal<=?`,
      [...allIds,tglAwal,tglAkhir]
    );
  }
  const countMap={};
  presensiBatch.forEach(p=>{
    if(!countMap[p.siswa_id]) countMap[p.siswa_id]={hadir:0,terlambat:0,izin:0,sakit:0,alpha:0};
    const m=countMap[p.siswa_id];
    if(p.status==='Hadir')m.hadir++;
    else if(p.status==='Terlambat'){m.hadir++;m.terlambat++;}
    else if(p.status==='Izin')m.izin++;
    else if(p.status==='Sakit')m.sakit++;
    else if(p.status==='Alpha')m.alpha++;
  });
  const rekapKelas=kelasList.map(namaKelas=>{
    const info=kelasMap[namaKelas]||{count:0};
    const totalSiswa=info.count;
    let totalHadir=0,totalTerlambat=0,totalIzin=0,totalSakit=0,totalAlpha=0;
    (info.ids||[]).forEach(sid=>{
      const m=countMap[sid]||{};
      const h=m.hadir||0,t=m.terlambat||0,i=m.izin||0,sk=m.sakit||0,a0=m.alpha||0;
      const tidakH=hariEfektif-h-i-sk-a0;
      const a=a0+(tidakH>0?tidakH:0);
      totalHadir+=h;totalTerlambat+=t;totalIzin+=i;totalSakit+=sk;totalAlpha+=a;
    });
    const maxHadir=totalSiswa*hariEfektif;
    const pct=maxHadir>0?Math.round((totalHadir/maxHadir)*100):0;
    return {kelas:namaKelas,totalSiswa,hadir:totalHadir,terlambat:totalTerlambat,
            izin:totalIzin,sakit:totalSakit,alpha:totalAlpha,total:hariEfektif,persentase:pct};
  });

  res.json({success:true,data:rekapKelas,hariEfektif,bulan:bln,tahun:thn});
});

// GET: detail per siswa (kalender)
router.get('/detail/:siswa_id', (req,res) => {
  const {siswa_id}=req.params;
  const {bulan='',tahun=''}=req.query;
  const now=new Date();
  const thn=tahun||now.getFullYear();
  const bln=(bulan||String(now.getMonth()+1)).padStart(2,'0');
  const tglAwal =`${thn}-${bln}-01`;
  const tglAkhir=`${thn}-${bln}-31`;
  const siswa=queryOne('SELECT * FROM siswa WHERE id=?',[siswa_id]);
  if(!siswa) return res.json({success:false,message:'Siswa tidak ditemukan'});
  const presensi=queryAll(
    'SELECT * FROM presensi WHERE siswa_id=? AND tanggal>=? AND tanggal<=? ORDER BY tanggal ASC',
    [siswa_id,tglAwal,tglAkhir]
  );
  res.json({success:true,siswa,data:presensi,bulan:bln,tahun:thn});
});

// GET: detail siswa per kelas (untuk tombol View di rekap kelas)
router.get('/kelas-detail', (req,res) => {
  const {bulan='',tahun='',kelas=''} = req.query;
  const now=new Date();
  const thn=tahun||now.getFullYear();
  const bln=(bulan||String(now.getMonth()+1)).padStart(2,'0');
  const tglAwal =`${thn}-${bln}-01`;
  const tglAkhir=`${thn}-${bln}-31`;
  const hariEfektif=hitungHariEfektif(thn,bln);

  const kelasDetail=kelas.trim();
  const kelasFilterDetail=getKelasFilter(req);
  if(kelasFilterDetail){
    const allowedDetail=Array.isArray(kelasFilterDetail)?kelasFilterDetail:[kelasFilterDetail];
    if(!kelasDetail || !allowedDetail.includes(kelasDetail)){
      return res.json({success:false,message:'Akses ditolak'});
    }
  }
  const siswaList=queryAll(
    'SELECT id,nisn,nama,kelas,jenis_kelamin FROM siswa WHERE kelas=? ORDER BY nama ASC',
    [kelasDetail]
  );

  const rekap=siswaList.map(s=>{
    const presensi=queryAll(
      'SELECT tanggal,status FROM presensi WHERE siswa_id=? AND tanggal>=? AND tanggal<=?',
      [s.id,tglAwal,tglAkhir]
    );
    let hadir=0,terlambat=0,izin=0,sakit=0,alpha=0;
    presensi.forEach(p=>{
      if(p.status==='Hadir')hadir++;
      else if(p.status==='Terlambat'){hadir++;terlambat++;}
      else if(p.status==='Izin')izin++;
      else if(p.status==='Sakit')sakit++;
      else if(p.status==='Alpha')alpha++;
    });
    const tidakH=hariEfektif-hadir-izin-sakit-alpha;
    if(tidakH>0) alpha+=tidakH;
    const pct=hariEfektif>0?Math.round((hadir/hariEfektif)*100):0;
    return {...s,hadir,terlambat,izin,sakit,alpha,total:hariEfektif,persentase:pct};
  });

  res.json({success:true,data:rekap,kelas:kelasDetail,hariEfektif,bulan:bln,tahun:thn});
});

// GET: export excel per siswa
router.get('/export-excel', (req,res) => {
  try {
    const XLSX=require('xlsx');
    const {bulan='',tahun='',kelas=''}=req.query;
    const now=new Date();
    const thn=tahun||now.getFullYear();
    const bln=(bulan||String(now.getMonth()+1)).padStart(2,'0');
    const tglAwal=`${thn}-${bln}-01`,tglAkhir=`${thn}-${bln}-31`;
    const hariEfektif=hitungHariEfektif(thn,bln);
    const kelasFilterExcel=getKelasFilter(req);
    const BULAN_NAMA=['','Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
    const kelasTrim=(kelas||'').trim();

    let siswaSQL='SELECT id,nisn,nama,kelas,jenis_kelamin FROM siswa WHERE 1=1';
    const siswaP=[];
    const we=[]; const {sql:we2}=applyKelasFilter(we, siswaP, kelasFilterExcel, kelas);
    if(we2.length) siswaSQL+=' AND '+we2.join(' AND ');
    siswaSQL+=' ORDER BY kelas ASC,nama ASC';
    const semuaSiswa=queryAll(siswaSQL,siswaP);

    const ids=semuaSiswa.map(s=>s.id);
    let presensiBatch=[];
    if(ids.length){
      const ph=ids.map(()=>'?').join(',');
      presensiBatch=queryAll(
        `SELECT siswa_id,status FROM presensi WHERE siswa_id IN (${ph}) AND tanggal>=? AND tanggal<=?`,
        [...ids,tglAwal,tglAkhir]
      );
    }
    const countMap={};
    presensiBatch.forEach(p=>{
      if(!countMap[p.siswa_id]) countMap[p.siswa_id]={hadir:0,terlambat:0,izin:0,sakit:0,alpha:0};
      const m=countMap[p.siswa_id];
      if(p.status==='Hadir')m.hadir++;
      else if(p.status==='Terlambat'){m.hadir++;m.terlambat++;}
      else if(p.status==='Izin')m.izin++;
      else if(p.status==='Sakit')m.sakit++;
      else if(p.status==='Alpha')m.alpha++;
    });
    const wb=XLSX.utils.book_new();
    const rows=semuaSiswa.map(s=>{
      const m=countMap[s.id]||{};
      const h=m.hadir||0,t=m.terlambat||0,i=m.izin||0,sk=m.sakit||0,a0=m.alpha||0;
      const na=hariEfektif-h-i-sk-a0; const a=a0+(na>0?na:0);
      const pct=hariEfektif>0?Math.round((h/hariEfektif)*100):0;
      return [s.nisn,s.nama,s.kelas,s.jenis_kelamin,h,t,i,sk,a,hariEfektif,pct+'%'];
    });
    const ws=XLSX.utils.aoa_to_sheet([
      [`REKAP PRESENSI ${BULAN_NAMA[parseInt(bln)].toUpperCase()} ${thn}${kelasTrim?' - '+kelasTrim:''}`],
      [`Hari Efektif: ${hariEfektif} hari`],[],
      ['NISN','Nama Siswa','Kelas','J.K','Hadir','Terlambat','Izin','Sakit','Alpha','Total Hari','% Hadir'],
      ...rows
    ]);
    ws['!cols']=[{wch:10},{wch:25},{wch:10},{wch:6},{wch:7},{wch:10},{wch:6},{wch:7},{wch:7},{wch:10},{wch:8}];
    XLSX.utils.book_append_sheet(wb,ws,`Rekap${kelasTrim?' '+kelasTrim:' Semua'}`);

    const buf=XLSX.write(wb,{type:'buffer',bookType:'xlsx'});
    const fname=`Rekap_${BULAN_NAMA[parseInt(bln)]}_${thn}${kelasTrim?'_'+kelasTrim.replace(/\s/g,''):''}.xlsx`;
    res.setHeader('Content-Disposition',`attachment; filename="${fname}"`);
    res.setHeader('Content-Type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buf);
  } catch(e){ console.error(e); res.status(500).json({success:false,message:e.message}); }
});

// GET: export excel per kelas spesifik
router.get('/export-excel-kelas', (req,res) => {
  try {
    const XLSX=require('xlsx');
    const {bulan='',tahun='',kelas=''}=req.query;
    const now=new Date();
    const thn=tahun||now.getFullYear();
    const bln=(bulan||String(now.getMonth()+1)).padStart(2,'0');
    const tglAwal=`${thn}-${bln}-01`,tglAkhir=`${thn}-${bln}-31`;
    const hariEfektif=hitungHariEfektif(thn,bln);
    const BULAN_NAMA=['','Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
    const kelasTrim=(kelas||'').trim();
    const kelasFilterKelas=getKelasFilter(req);
    if(kelasFilterKelas){
      const allowedKelas=Array.isArray(kelasFilterKelas)?kelasFilterKelas:[kelasFilterKelas];
      if(!kelasTrim || !allowedKelas.includes(kelasTrim)){
        return res.status(403).json({success:false,message:'Akses ditolak'});
      }
    }

    const siswaList=queryAll(
      'SELECT id,nisn,nama,kelas,jenis_kelamin FROM siswa WHERE kelas=? ORDER BY nama ASC',
      [kelasTrim]
    );

    const ids=siswaList.map(s=>s.id);
    let presensiBatch=[];
    if(ids.length){
      const ph=ids.map(()=>'?').join(',');
      presensiBatch=queryAll(
        `SELECT siswa_id,status FROM presensi WHERE siswa_id IN (${ph}) AND tanggal>=? AND tanggal<=?`,
        [...ids,tglAwal,tglAkhir]
      );
    }
    const countMap={};
    presensiBatch.forEach(p=>{
      if(!countMap[p.siswa_id]) countMap[p.siswa_id]={hadir:0,terlambat:0,izin:0,sakit:0,alpha:0};
      const m=countMap[p.siswa_id];
      if(p.status==='Hadir')m.hadir++;
      else if(p.status==='Terlambat'){m.hadir++;m.terlambat++;}
      else if(p.status==='Izin')m.izin++;
      else if(p.status==='Sakit')m.sakit++;
      else if(p.status==='Alpha')m.alpha++;
    });
    const wb=XLSX.utils.book_new();
    const rows=siswaList.map(s=>{
      const m=countMap[s.id]||{};
      const h=m.hadir||0,t=m.terlambat||0,i=m.izin||0,sk=m.sakit||0,a0=m.alpha||0;
      const na=hariEfektif-h-i-sk-a0; const a=a0+(na>0?na:0);
      const pct=hariEfektif>0?Math.round((h/hariEfektif)*100):0;
      return [s.nisn,s.nama,s.jenis_kelamin,h,t,i,sk,a,hariEfektif,pct+'%'];
    });
    const ws=XLSX.utils.aoa_to_sheet([
      [`REKAP PRESENSI ${kelasTrim} - ${BULAN_NAMA[parseInt(bln)].toUpperCase()} ${thn}`],
      [`Total Siswa: ${siswaList.length} | Hari Efektif: ${hariEfektif} hari`],[],
      ['NISN','Nama Siswa','J.K','Hadir','Terlambat','Izin','Sakit','Alpha','Total Hari','% Hadir'],
      ...rows
    ]);
    ws['!cols']=[{wch:10},{wch:25},{wch:6},{wch:7},{wch:10},{wch:6},{wch:7},{wch:7},{wch:10},{wch:8}];
    XLSX.utils.book_append_sheet(wb,ws,kelasTrim);

    const buf=XLSX.write(wb,{type:'buffer',bookType:'xlsx'});
    const fname=`Rekap_${kelasTrim.replace(/\s/g,'')}_${BULAN_NAMA[parseInt(bln)]}_${thn}.xlsx`;
    res.setHeader('Content-Disposition',`attachment; filename="${fname}"`);
    res.setHeader('Content-Type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buf);
  } catch(e){ console.error(e); res.status(500).json({success:false,message:e.message}); }
});

// GET: export excel 1 siswa (detail bulan)
router.get('/export-excel-siswa/:siswa_id', (req,res) => {
  try {
    const XLSX=require('xlsx');
    const {bulan='',tahun=''}=req.query;
    const {siswa_id}=req.params;
    const now=new Date();
    const thn=tahun||now.getFullYear();
    const bln=(bulan||String(now.getMonth()+1)).padStart(2,'0');
    const tglAwal=`${thn}-${bln}-01`,tglAkhir=`${thn}-${bln}-31`;
    const hariEfektif=hitungHariEfektif(thn,bln);
    const BULAN_NAMA=['','Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];

    const siswa=queryOne('SELECT * FROM siswa WHERE id=?',[siswa_id]);
    if(!siswa) return res.status(404).json({success:false,message:'Siswa tidak ditemukan'});

    const presensi=queryAll(
      'SELECT * FROM presensi WHERE siswa_id=? AND tanggal>=? AND tanggal<=? ORDER BY tanggal ASC',
      [siswa_id,tglAwal,tglAkhir]
    );

    // Hitung ringkasan
    let h=0,t=0,i=0,sk=0,a=0;
    presensi.forEach(p=>{
      if(p.status==='Hadir')h++;
      else if(p.status==='Terlambat'){h++;t++;}
      else if(p.status==='Izin')i++;
      else if(p.status==='Sakit')sk++;
      else if(p.status==='Alpha')a++;
    });
    const na=hariEfektif-h-i-sk-a; if(na>0) a+=na;
    const pct=hariEfektif>0?Math.round((h/hariEfektif)*100):0;

    const wb=XLSX.utils.book_new();

    // Sheet 1: Info Siswa + Ringkasan
    const ws1=XLSX.utils.aoa_to_sheet([
      [`REKAP PRESENSI - ${BULAN_NAMA[parseInt(bln)].toUpperCase()} ${thn}`],[],
      ['Nama Siswa', siswa.nama],
      ['NISN',        siswa.nisn],
      ['Kelas',      siswa.kelas],
      ['Jenis Kelamin', siswa.jenis_kelamin],
      [],
      ['RINGKASAN KEHADIRAN'],
      ['Hari Efektif', hariEfektif],
      ['Hadir',        h],
      ['Terlambat',    t],
      ['Izin',         i],
      ['Sakit',        sk],
      ['Alpha',        a],
      ['% Kehadiran',  pct+'%'],
    ]);
    ws1['!cols']=[{wch:18},{wch:25}];
    XLSX.utils.book_append_sheet(wb,ws1,'Ringkasan');

    // Sheet 2: Detail harian
    const detailRows=presensi.map(p=>[
      p.tanggal,
      p.jam_masuk?.slice(0,5)||'-',
      p.status,
      p.keterangan||''
    ]);
    const ws2=XLSX.utils.aoa_to_sheet([
      [`Detail Harian - ${siswa.nama} - ${BULAN_NAMA[parseInt(bln)]} ${thn}`],[],
      ['Tanggal','Jam Masuk','Status','Keterangan'],
      ...detailRows
    ]);
    ws2['!cols']=[{wch:14},{wch:10},{wch:12},{wch:20}];
    XLSX.utils.book_append_sheet(wb,ws2,'Detail Harian');

    const buf=XLSX.write(wb,{type:'buffer',bookType:'xlsx'});
    const fname=`Rekap_${siswa.nisn}_${siswa.nama.replace(/\s+/g,'_')}_${BULAN_NAMA[parseInt(bln)]}_${thn}.xlsx`;
    res.setHeader('Content-Disposition',`attachment; filename="${fname}"`);
    res.setHeader('Content-Type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buf);
  } catch(e){ console.error(e); res.status(500).json({success:false,message:e.message}); }
});

module.exports = router;
