/** Shared by every sender that talks to Kapso or Meta: clean saved credentials and fail clearly before the network. */
export class InvalidRequestError extends Error {
 constructor(){super('whatsapp_request_invalid');this.name='InvalidRequestError';}
}
/**
 * A pasted secret can carry stray characters at its ends. Fetch forgives a newline there but throws on a
 * byte-order mark or zero-width space, which look like nothing. Trim all of them; blank means not set. Never logged.
 */
export function cleanSecret(value:string|undefined|null):string|undefined {
 const trimmed=value?.replace(/^[\s​-‍⁠﻿]+|[\s​-‍⁠﻿]+$/g,'');
 return trimmed?trimmed:undefined;
}
/** Build headers the way fetch will. A bad value throws a fixed error that carries neither the value nor its length. */
export function buildRequestHeaders(headers:Record<string,string>):Record<string,string> {
 try{new Headers(headers);}catch{throw new InvalidRequestError();}
 return headers;
}
