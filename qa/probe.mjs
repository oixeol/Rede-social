const base=process.env.BASE_URL||'http://localhost:4173';
async function req(path, opts={}, cookie=''){const r=await fetch(base+path,{...opts,headers:{'content-type':'application/json',...(opts.headers||{}),...(cookie?{cookie}:{})}});const t=await r.text();let b;try{b=JSON.parse(t)}catch{b=t}return{status:r.status,body:b,setCookie:r.headers.get('set-cookie')}}
(async()=>{
 console.log('config', JSON.stringify(await req('/api/config')));
 const password=process.env.VIBRA_DEMO_PASSWORD||'';
 if(!password){console.error('Defina VIBRA_DEMO_PASSWORD para usar o probe com dados de demonstração.');process.exit(1)}
 const login=await req('/api/login',{method:'POST',body:JSON.stringify({username:'vibra',password})});
 console.log('login',login.status,login.body.user?.username,login.body.user?.birthDate);
 const cookie=login.setCookie.split(';')[0];
 for (const p of ['/api/me','/api/feed','/api/explore','/api/conversations','/api/notifications','/api/dating/status','/api/dating/matches','/api/dating/radar','/api/dating/discover','/api/dating/answers']) {
   const r=await req(p,{},cookie);
   console.log(p, r.status, JSON.stringify(r.body).slice(0,300));
 }
})();
