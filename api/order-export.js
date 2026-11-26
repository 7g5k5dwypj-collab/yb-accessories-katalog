const { randomBytes } = require('node:crypto');
module.exports = async (req,res) => {
  res.setHeader('Cache-Control','no-store');
  if(req.method !== 'POST') return res.status(405).end();
  const base=process.env.SUPABASE_URL, key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!base || !key) return res.status(503).json({error:'Configuration missing'});
  const headers={apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json'};
  try {
    const items=req.body?.items;
    if(!Array.isArray(items)||!items.length||items.length>500||items.some(x=>!x||typeof x.id!=='string'&&typeof x.id!=='number'||!/^[a-zA-Z0-9-]{1,80}$/.test(String(x.id))||!Number.isInteger(x.quantity)||x.quantity<1||x.quantity>99999)||new Set(items.map(x=>String(x.id))).size!==items.length) return res.status(400).json({error:'Invalid items'});
    const rows=[];
    for(let i=0;i<items.length;i+=50){
      const ids=items.slice(i,i+50).map(x=>x.id).join(',');
      const q=new URLSearchParams({select:'id,name,price,image',active:'eq.true',id:`in.(${ids})`});
      const r=await fetch(`${base}/rest/v1/yb_products?${q}`,{headers});
      if(!r.ok) throw Error('Products unavailable');
      rows.push(...await r.json());
    }
    const map=new Map(rows.map(x=>[String(x.id),x]));
    const date = new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Istanbul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
    const campaign = date >= '2026-11-07' && date <= '2026-11-14';
    const snapshot=items.map(x=>{const p=map.get(String(x.id)); if(!p||!Number.isFinite(Number(p.price))||Number(p.price)<0) throw Error('Invalid product'); return {id:p.id,name:p.name,image:p.image,quantity:x.quantity,unitCents:Math.round(Number(p.price)*(campaign ? 80 : 100))};});
    const token=randomBytes(32).toString('hex');
    const r=await fetch(`${base}/rest/v1/yb_order_exports`,{method:'POST',headers,body:JSON.stringify({token,snapshot})});
    if(!r.ok) throw Error('Storage failed');
    return res.status(201).json({totalCents:snapshot.reduce((sum,x)=>sum+x.unitCents*x.quantity,0),snapshot,token,pdfUrl:`/api/order-export/${token}/pdf`,excelUrl:`/api/order-export/${token}/excel`});
  } catch {return res.status(500).json({error:'Order could not be saved'});}
};
