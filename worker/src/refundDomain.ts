export async function invoiceRefundTotals(env:{DB:D1Database},accountId:string,invoiceId:string){
 const row=await env.DB.prepare(`SELECT COALESCE((SELECT SUM(amount_usd) FROM invoice_payments WHERE account_id=? AND invoice_id=? AND status='confirmed'),0) AS paid,COALESCE((SELECT SUM(amount_usd) FROM invoice_refunds WHERE account_id=? AND invoice_id=?),0) AS refunded`).bind(accountId,invoiceId,accountId,invoiceId).first() as any;
 const refunded_usd=Number(row?.refunded||0);const refund_due_usd=Math.max(0,Math.round((Number(row?.paid||0)-refunded_usd)*100)/100);
 return {refunded_usd,refund_due_usd,refund_required:refund_due_usd>0.01};
}
