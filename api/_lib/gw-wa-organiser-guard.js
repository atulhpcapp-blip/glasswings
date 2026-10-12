// CALL from every EXISTING AiSensy endpoint, server side, before sending messages
// for partner organisers. Do not call for Glasswings-owned campaigns.
// This file alone cannot protect existing endpoints until they import it.
import { db } from './gw-wa.js';
async function withOrganiserCredit({organiserId,sendKey,send}) {
  if(!organiserId) throw Error('Organiser identity must come from server-side verified event ownership');
  const svc=db();
  const {data:allowed,error}=await svc.rpc('gw_wa_charge_message',{p_organiser:organiserId,p_reference:sendKey});
  if(error)throw Error('WhatsApp wallet authorization error: '+error.message);
  if(!allowed)throw Error('No WhatsApp credits. Buy credits in Glasswings → WhatsApp Centre.');
  try{return await send();}
  catch(e){
    // Refund only on a definite rejected submission. For network timeouts / uncertain
    // delivery, don't retry automatically: AiSensy may already have accepted it.
    if(e.definitelyRejected){await svc.rpc('gw_wa_reverse_message',{p_organiser:organiserId,p_reference:sendKey});}
    throw e;
  }
}
export {withOrganiserCredit};
