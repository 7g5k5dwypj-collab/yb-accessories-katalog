const {pdf,excel}=require('../../../lib/export');
module.exports=async(req,res)=>{
 res.setHeader('Cache-Control','private, no-store');res.setHeader('X-Robots-Tag','noindex, nofollow');
 const {token,format}=req.query;
 if(req.method!=='GET')return res.status(405).end();
 if(typeof token!=='string'||!/^[a-f0-9]{64}$/.test(token)||!['pdf','excel'].includes(format))return res.status(404).end();
 const base=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!base||!key)return res.status(503).end();
 try{const r=await fetch(`${base}/rest/v1/yb_order_exports?token=eq.${token}&select=snapshot`,{headers:{apikey:key,Authorization:`Bearer ${key}`}});if(!r.ok)throw Error();const [order]=await r.json();if(!order)return res.status(404).end();const data=await (format==='pdf'?pdf:excel)(order.snapshot);res.setHeader('Content-Type',format==='pdf'?'application/pdf':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');res.setHeader('Content-Disposition',`attachment; filename="YB-Siparis.${format==='pdf'?'pdf':'xlsx'}"`);return res.status(200).send(data);}catch{return res.status(500).json({error:'Dosya hazırlanamadı'});}
};
