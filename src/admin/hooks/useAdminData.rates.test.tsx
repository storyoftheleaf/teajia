import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {expect,it} from 'vitest';
import {useRates} from './useAdminData';
import {useAppStore} from '../../lib/store';
function read(data: Array<{currency:'USD';rateToUSD:number}>){
 useAppStore.getState().clearAccountState();
 const client=new QueryClient();
 client.setQueryData(['rates','no-account','anonymous'],data,{updatedAt:Date.now()});
 let stale:boolean|undefined;
 function Capture(){stale=useRates().isStale;return null;}
 renderToStaticMarkup(createElement(QueryClientProvider,{client},createElement(Capture)));
 client.clear();return stale;
}
it('refetches a freshly restored empty rate result instead of considering it fresh for an hour',()=>{
 expect(read([])).toBe(true);
});
it('keeps a freshly restored real rate reading fresh',()=>{
 expect(read([{currency:'USD',rateToUSD:1}])).toBe(false);
});
