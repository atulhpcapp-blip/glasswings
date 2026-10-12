const {db,fail,requireUser,rzp,RZ_KEY}=require('../_lib/gw-wa');
module.exports=async(req,res)=>{
  if(req.method!=='POST')return fail(res,405,'POST only');
  try{
    const auth=await requireUser(req,res);if(!auth)return;
    const units=Number(req.body?.units);
    if(!Number.isSafeInteger(units)||![20,50,100,250,500].includes(units))return fail(res,400,'Select an available credit pack');
    const unitPaise=Number(process.env.GW_WA_UNIT_PRICE_PAISE);
    if(!Number.isSafeInteger(unitPaise)||unitPaise<10)return fail(res,503,'Admin must configure WhatsApp credit price');
    const amount=units*unitPaise;
    const order=await rzp('/orders',{method:'POST',body:JSON.stringify({amount,currency:'INR',receipt:`gwa-${auth.uid.slice(0,8)}-${Date.now()}`,notes:{purpose:'gw_wa_credits',organiser_id:auth.uid,credits:String(units)}})});
    const {error}=await auth.svc.from('gw_wa_credit_orders').insert({order_id:order.id,organiser_id:auth.uid,units,amount_paise:amount,currency:'INR'});
    if(error)throw Error('Cannot record credit order: '+error.message);
    return res.status(200).json({ok:true,order_id:order.id,key_id:RZ_KEY,amount,currency:'INR',units});
  }catch(e){return fail(res,500,e.message||'Could not create credit order');}
};
