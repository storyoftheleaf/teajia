import {beforeEach,expect,it} from 'vitest';
import {useAppStore} from './store';
import {mapAdminProduct} from '../admin/productAdapter';
beforeEach(()=>useAppStore.setState({cart:[]}));
it('refuses to quote an unknown price into an admin order',()=>{
 const product=mapAdminProduct({id:'synthetic',retail_price_per_gram_usd:null});
 useAppStore.getState().addToCart(product,10);
 expect(useAppStore.getState().cart).toEqual([]);
});
it('keeps a genuine zero price in an admin order',()=>{
 useAppStore.getState().addToCart(mapAdminProduct({id:'synthetic',retail_price_per_gram_usd:0}),10);
 expect(useAppStore.getState().cart[0].priceAtSale).toBe(0);
});
it('keeps an explicit fixed zero even when the calculated price is unavailable',()=>{
 useAppStore.getState().addToCart(mapAdminProduct({id:'synthetic',retail_price_per_gram_usd:null,fixed_retail_price_usd:0}),10);
 expect(useAppStore.getState().cart[0].priceAtSale).toBe(0);
});
