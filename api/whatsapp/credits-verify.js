import {fail,requireUser,rzp,secureEq,crypto,RZ_SECRET} from '../_lib/gw-wa.js';
export default async function handler(req,res){
  if(req.method!=='POST')return fail(res,405,'POST only');
  try{
    const auth=await requireUser(req,res);if(!auth)return;
    const {razorpay_order_id:orderId,razorpay_payment_id:paymentId,razorpay_signature:signature}=req.body||{};
    if(!orderId||!paymentId||!signature)return fail(res,400,'Missing Razorpay fields');
    const expected=crypto.createHmac('sha256',RZ_SECRET).update(orderId+'|'+paymentId).digest('hex');
    if(!secureEq(expected,signature))return fail(res,403,'Invalid Razorpay signature');
    const {data:row,error}=await auth.svc.from('gw_wa_credit_orders').select('*').eq('order_id',orderId).maybeSingle();
    if(error||!row||row.organiser_id!==auth.uid)return fail(res,403,'Order does not belong to this organiser');
    const payment=await rzp('/payments/'+encodeURIComponent(paymentId));
    if(payment.order_id!==orderId||payment.status!=='captured'||payment.currency!=='INR'||Number(payment.amount)!==row.amount_paise)return fail(res,409,'Payment is not yet captured or does not match');
    const {data:units,error:e}=await auth.svc.rpc('gw_wa_apply_topup',{p_order:orderId,p_payment:paymentId});
    if(e)throw Error(e.message);
    const {data:wallet}=await auth.svc.from('gw_wa_wallets').select('credits').eq('organiser_id',auth.uid).single();
    return res.status(200).json({ok:true,units,credits:wallet?.credits??0});
  }catch(e){return fail(res,500,e.message||'Could not verify payment');}
}
