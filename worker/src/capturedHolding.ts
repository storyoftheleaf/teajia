import { canonicalCurrency } from '../../src/lib/currency';

/** Quote basis and quantity stay paired; receiving scales the quote to the actual receipt. */
export function capturedHoldingFields(entry:Record<string,any>, received?:number):Record<string,any>{
 let photos:string[]=[];try{photos=Array.isArray(entry.photos)?entry.photos:JSON.parse(entry.photos||'[]');}catch{}
 const ware=entry.category==='teaware'||entry.type==='Teaware';
 const actual=entry.buy_total!=null;
 const amount=actual?Number(entry.buy_total):entry.price_amount==null?null:Number(entry.price_amount);
 const basis=actual?Number(ware?entry.buy_quantity_units:entry.buy_quantity_grams):ware?1:Number(entry.price_per_unit_grams);
 const free=amount===0;
 const stated=amount!=null&&Number.isFinite(amount)&&amount>=0&&(free||(entry.price_currency&&entry.price_currency!=='UNK'));
 const quantity=received??(basis>0?basis:free?1:null);

 return {form:entry.form??null,season:entry.season??null,storage:entry.storage??null,producer:entry.producer??null,classification:entry.classification??null,cultivar:entry.cultivar??null,chinese_name:entry.chinese_name??null,year:entry.year!=null?String(entry.year):null,origin_country:entry.origin_country??null,origin_region:entry.origin_region??null,description:entry.description??null,image_url:photos[0]??null,additional_images:JSON.stringify(photos.slice(1)),bag_photo_url:photos[0]??null,vendor:entry.vendor_name??null,vendor_id:entry.vendor_id??null,material:entry.material??null,clay_type:entry.clay_type??null,material_note:entry.material_note??null,capacity_ml:entry.capacity_ml??null,teaware_category:entry.teaware_category??null,tasting:entry.tasting??'{}',tasting_source:entry.tasting&&entry.tasting!=='{}'?'owner':null,tea_key:entry.tea_key??null,cost_amount:stated?(free?0:(basis>0&&received!=null?Number(amount)*(quantity!/basis):amount)):null,cost_currency:stated&&!free?canonicalCurrency(entry.price_currency):free?(canonicalCurrency(entry.price_currency)??null):null,quantity_purchased:stated&&(basis>0||free)?quantity:null};
}
export function recordedImageKey(product:Record<string,any>,slot:string,accountId:string):string|null{
 let extras:string[]=[];try{extras=Array.isArray(product.additional_images)?product.additional_images:JSON.parse(product.additional_images||'[]');}catch{}
 const raw=slot==='main'?product.image_url:slot==='bag'?product.bag_photo_url:extras[Number(slot)-1];
 if(typeof raw!=='string'||!raw.trim())return null;
 try{const url=new URL(raw,'https://media.teajia.co');const path=decodeURIComponent(url.pathname.replace(/^\/api\/media\//,'/')).replace(/^\//,'');return path.startsWith(`accounts/${accountId}/`)&&!path.split('/').includes('..')?path:null;}catch{return null;}
}

export async function capturedRetailUsd(env:{DB:D1Database},entry:Record<string,any>):Promise<number|null>{
 if(entry.sell_price==null||!Number.isFinite(Number(entry.sell_price))||Number(entry.sell_price)<0)return null;
 if(Number(entry.sell_price)===0)return 0;
 const currency=canonicalCurrency(entry.price_currency);if(!currency||currency==='UNK')return null;
 const rate=currency==='USD'?1:(await env.DB.prepare('SELECT rate_to_usd FROM exchange_rates WHERE currency=?').bind(currency).first() as any)?.rate_to_usd;
 return Number(rate)>0?Number(entry.sell_price)/Number(rate):null;
}
