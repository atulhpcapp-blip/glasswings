// Configure a Vercel cron (GET /api/whatsapp/process-sales) and CRON_SECRET.
// Pending notifications originate ONLY from verified-purchase DB records/Razorpay verification.
import {db,fail} from '../_lib/gw-wa.js';
const API='https://backend.aisensy.com/campaign/t1/api/v2';
function normalizePhone(x){let d=String(x||'').replace(/\D/g,'');if(d.length===10)d='91'+d;return d.length>=11&&d.length<=15?d:'';}
function label(kind){return {ticket_sale:'Ticket sold',booking_payment:'Booking / advance received',trip_payment:'Trip instalment received',door_sale:'Door sale'}[kind]||'Payment received';}
export default async function handler(req,res){
  if(req.method!=='GET'&&req.method!=='POST')return fail(res,405,'GET/POST only');
  if(!process.env.CRON_SECRET||req.headers.authorization!==`Bearer ${process.env.CRON_SECRET}`)return fail(res,401,'Invalid cron credential');
  if(!process.env.AISENSY_API_KEY)return fail(res,503,'AISENSY_API_KEY is not configured');
  try{
    const svc=db();
    const {data:jobs,error}=await svc.rpc('gw_wa_claim',{p_limit:15});if(error)throw Error(error.message);
    const results=[];
    for(const job of jobs||[]){
      const p=job.payload||{};
      const campaign=job.channel==='glasswings'?process.env.AISENSY_OWNER_SALE_CAMPAIGN:process.env.AISENSY_ORGANISER_SALE_CAMPAIGN;
      let target=job.channel==='glasswings'?normalizePhone(process.env.GW_OWNER_WHATSAPP||'9777777491'):'';
      if(job.channel==='organiser'){
        const {data:wallet}=await svc.from('gw_wa_wallets').select('destination_phone,notify_sales').eq('organiser_id',job.organiser_id).maybeSingle();
        if(wallet?.notify_sales)target=normalizePhone(wallet?.destination_phone);
      }
      let success=false,detail='';
      try{
        if(!campaign||!target)throw Error('Campaign or target phone not configured');
        const values=[label(p.kind),String(p.event||''),String(p.event_date||''),String(p.buyer||''),String(p.buyer_phone||''),String(p.quantity||1),`INR ${Number(p.amount||0).toLocaleString('en-IN')}`,String(p.payment_id||p.reference||'')];
        const response=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({apiKey:process.env.AISENSY_API_KEY,campaignName:campaign,destination:target,userName:job.channel==='glasswings'?'Glasswings Operations':'Event Organiser',source:'Glasswings verified sales',templateParams:values})});
        const raw=await response.text();detail=raw.slice(0,500);
        if(!response.ok)throw Error(`AiSensy HTTP ${response.status}: ${detail}`);
        let parsed;try{parsed=JSON.parse(raw);}catch{parsed=null;}
        if(parsed&&(parsed.status===false||parsed.success===false||parsed.error))throw Error('AiSensy rejected: '+detail);
        success=true;
      }catch(e){detail=e.message||String(e);}
      const {error:doneErr}=await svc.rpc('gw_wa_complete',{p_id:job.id,p_success:success,p_error:detail});
      results.push({id:job.id,channel:job.channel,state:doneErr?'finalization_error':success?'submitted':'needs_review'});
    }
    return res.status(200).json({ok:true,processed:results.length,results});
  }catch(e){return fail(res,500,e.message||'Alert dispatcher failed');}
}
