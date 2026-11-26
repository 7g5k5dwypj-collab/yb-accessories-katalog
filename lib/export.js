const Excel = require('exceljs');
const PDF = require('pdfkit');
const sharp = require('sharp');
const money = n => (n/100).toLocaleString('tr-TR',{minimumFractionDigits:2,maximumFractionDigits:2})+' TL';
const mint='A8D9C7', dark='25382F';
async function photo(url){
 if(!url) return null;
 try {
  const u=new URL(url), base=new URL(process.env.SUPABASE_URL);
  if(u.origin!==base.origin || !u.pathname.startsWith('/storage/v1/object/public/')) return null;
  const r=await fetch(u,{redirect:'error',signal:AbortSignal.timeout(8000)});
  if(!r.ok) return null;
  const reader=r.body.getReader(); let size=0, chunks=[];
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>12000000){await reader.cancel();return null;}chunks.push(Buffer.from(value));}
  return await sharp(Buffer.concat(chunks),{limitInputPixels:40000000}).rotate().resize(600,600,{fit:'contain',background:'#ffffff',withoutEnlargement:true}).flatten({background:'#ffffff'}).jpeg({quality:92}).toBuffer();
 }catch{return null;}
}
async function images(rows){const result=[];for(let i=0;i<rows.length;i+=8)result.push(...await Promise.all(rows.slice(i,i+8).map(r=>photo(r.image))));return result;}
async function excel(rows){
 const pics=await images(rows), wb=new Excel.Workbook(), s=wb.addWorksheet('Sipariş Listesi',{pageSetup:{paperSize:9,orientation:'portrait',fitToPage:true,fitToWidth:1,fitToHeight:0,printTitlesRow:'1:3',margins:{left:0.3,right:0.3,top:0.4,bottom:0.4,header:0.15,footer:0.15}}});
 s.columns=[{width:15},{width:32},{width:9},{width:16},{width:17}];
 s.mergeCells('A1:E1');s.mergeCells('A2:E2');s.getCell('A1').value='YB ACCESSORIES';s.getCell('A2').value='Sipariş Listesi';
 for(const n of [1,2]){const c=s.getCell('A'+n);c.font={name:'Georgia',size:n===1?22:16,bold:n===1,color:{argb:'FF'+dark}};c.alignment={horizontal:'center',vertical:'middle'};s.getRow(n).height=30;}
 s.getRow(3).values=['Ürün görseli','Ürün adı','Adet','Birim fiyat','Toplam'];
 s.getRow(3).eachCell(c=>{c.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF'+mint}};c.font={bold:true,color:{argb:'FF'+dark}};c.alignment={horizontal:'center',vertical:'middle'};});s.getRow(3).height=24;
 rows.forEach((r,i)=>{const n=i+4, row=s.getRow(n);row.values=[pics[i]?'':'Görsel yok',r.name,r.quantity,r.unitCents/100,{formula:`ROUND(C${n}*D${n},2)`,result:r.quantity*r.unitCents/100}];row.height=72;row.eachCell({includeEmpty:true},c=>{c.alignment={vertical:'middle',wrapText:true};c.border={bottom:{style:'thin',color:{argb:'FFE0E6E2'}}};});row.getCell(4).numFmt=row.getCell(5).numFmt='#,##0.00 "TL"';if(pics[i]){const id=wb.addImage({buffer:pics[i],extension:'jpeg'});s.addImage(id,{tl:{col:0.1,row:n-1+0.05},ext:{width:85,height:85}});}});
 const n=rows.length+4;s.getCell(`B${n}`).value='GENEL TOPLAM';s.getCell(`C${n}`).value={formula:`SUM(C4:C${n-1})`,result:rows.reduce((a,r)=>a+r.quantity,0)};s.getCell(`E${n}`).value={formula:`SUM(E4:E${n-1})`,result:rows.reduce((a,r)=>a+r.quantity*r.unitCents,0)/100};s.getCell(`E${n}`).numFmt='#,##0.00 "TL"';s.getRow(n).font={bold:true};s.pageSetup.printArea=`A1:E${n}`;s.headerFooter.oddFooter='&C&P / &N';return Buffer.from(await wb.xlsx.writeBuffer());
}
// PDF uses embedded Unicode fonts supplied with the deployment.
async function pdf(rows){
 const pics=await images(rows), doc=new PDF({size:'A4',margin:32,bufferPages:true}), chunks=[];
 const done=new Promise((resolve,reject)=>{doc.on('data',c=>chunks.push(c));doc.on('end',()=>resolve(Buffer.concat(chunks)));doc.on('error',reject);});
 const vfs=require('pdfmake/build/vfs_fonts.js'); const fonts=vfs.pdfMake?.vfs || vfs; doc.registerFont('body',Buffer.from(fonts['Roboto-Regular.ttf'],'base64'));doc.registerFont('title',Buffer.from(fonts['Roboto-Medium.ttf'],'base64'));
 const widths=[83,204,50,94,100], xs=[32];widths.forEach(w=>xs.push(xs.at(-1)+w));let y;
 function header(){doc.font('title').fontSize(23).fillColor('#'+dark).text('YB ACCESSORIES',32,32,{width:531,align:'center'});doc.fontSize(16).text('Sipariş Listesi',32,64,{width:531,align:'center'});y=96;doc.rect(32,y,531,25).fill('#'+mint);doc.font('body').fontSize(10).fillColor('#'+dark);['Ürün görseli','Ürün adı','Adet','Birim fiyat','Toplam'].forEach((t,i)=>doc.text(t,xs[i]+3,y+7,{width:widths[i]-6,align:'center'}));y+=25;}
 header();rows.forEach((r,i)=>{doc.font('body').fontSize(10);const h=Math.max(77,doc.heightOfString(String(r.name),{width:194})+14);if(y+h>780){doc.addPage();header();}if(pics[i])doc.image(pics[i],xs[0]+7,y+4,{fit:[69,69],align:'center',valign:'center'});else doc.text('Görsel yok',xs[0]+4,y+30,{width:75,align:'center'});doc.fillColor('#'+dark).text(String(r.name),xs[1]+5,y+8,{width:194});[String(r.quantity),money(r.unitCents),money(r.quantity*r.unitCents)].forEach((t,j)=>doc.text(t,xs[j+2]+3,y+30,{width:widths[j+2]-6,align:'right'}));y+=h;doc.moveTo(32,y).lineTo(563,y).strokeColor('#E0E6E2').stroke();});
 if(y+40>780){doc.addPage();header();}doc.rect(32,y+5,531,30).fill('#'+mint);doc.font('body').fillColor('#'+dark).fontSize(11).text('Toplam adet: '+rows.reduce((a,r)=>a+r.quantity,0),40,y+15,{width:220});doc.text('Genel toplam: '+money(rows.reduce((a,r)=>a+r.quantity*r.unitCents,0)),270,y+15,{width:285,align:'right'});
 const range=doc.bufferedPageRange();for(let i=0;i<range.count;i++){doc.switchToPage(i);doc.font('body').fontSize(9).text(`${i+1} / ${range.count}`,32,799,{width:531,align:'center',lineBreak:false});}doc.end();return done;
}
module.exports={pdf,excel};
