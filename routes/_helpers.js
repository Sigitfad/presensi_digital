function auth(req,res,next){
  if(!req.session.operatorId) return res.status(401).json({success:false});
  next();
}

function requireOperator(req,res,next){
  if(!req.session.operatorId) return res.status(401).json({success:false});
  if(req.session.operatorRole!=='operator')
    return res.status(403).json({success:false,message:'Hanya Operator yang dapat mengakses'});
  next();
}

function getKelasFilter(req){
  const role  = req.session.operatorRole;
  const kelas = req.session.pengampuKelas || 'Semua';
  if(role==='operator') return null;
  if(kelas==='Semua')   return null;
  const arr = kelas.split(',').map(k=>k.trim()).filter(Boolean);
  return arr.length > 1 ? arr : arr[0] || null;
}

function detectDelimiter(line){
  const commaCount = (line.match(/,/g)||[]).length;
  const semicolonCount = (line.match(/;/g)||[]).length;
  return semicolonCount > commaCount ? ';' : ',';
}

function parseCSV(text){
  const lines = text.replace(/\r\n/g,'\n').replace(/\r/g,'\n').split('\n').filter(Boolean);
  if(!lines.length) return {header:[],rows:[]};
  const delim = detectDelimiter(lines[0]);
  const header = lines[0].split(delim).map(h=>h.trim().replace(/^"|"$/g,'').toLowerCase());
  const rows = [];
  for(let i=1; i<lines.length; i++){
    const vals = lines[i].split(delim).map(v=>{
      let x=v.trim();
      if(/^=".*"$/.test(x)) x=x.slice(2,-1);
      else if(x.startsWith('="')) x=x.slice(2);
      else x=x.replace(/^"|"$/g,'');
      return x;
    });
    const row = {};
    header.forEach((h,idx)=> row[h]=vals[idx]||'');
    rows.push(row);
  }
  return {header, rows};
}

module.exports = { auth, requireOperator, getKelasFilter, detectDelimiter, parseCSV };
