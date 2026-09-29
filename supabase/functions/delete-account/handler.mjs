// Password is verified server-side; the service role key never reaches the app.
export function createDeleteHandler({url,anonKey,serviceKey,fetcher=fetch}){
  const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS'};
  const reply=(status,message)=>new Response(JSON.stringify({message}),{status,headers:{...cors,'Content-Type':'application/json'}});
  return async request=>{
    if(request.method==='OPTIONS')return new Response(null,{headers:cors});
    if(request.method!=='POST')return reply(405,'POST required.');
    try{
      const authorization=request.headers.get('Authorization');
      if(!authorization?.startsWith('Bearer '))return reply(401,'Sign in first.');
      const body=await request.json();
      if(body.confirmation!=='DELETE'||typeof body.password!=='string'||!body.password)return reply(400,'Password and DELETE confirmation required.');
      const userResponse=await fetcher(url+'/auth/v1/user',{headers:{apikey:anonKey,Authorization:authorization}});
      if(!userResponse.ok)return reply(401,'Session expired. Sign in again.');
      const user=await userResponse.json();
      const verification=await fetcher(url+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:anonKey,'Content-Type':'application/json'},body:JSON.stringify({email:user.email,password:body.password})});
      if(!verification.ok)return reply(401,'Password verification failed.');
      const verified=await verification.json();
      if(!user.id||verified.user?.id!==user.id)return reply(403,'Account verification failed.');
      const removed=await fetcher(url+'/rest/v1/rpc/delete_verified_account',{method:'POST',headers:{apikey:serviceKey,Authorization:'Bearer '+serviceKey,'Content-Type':'application/json'},body:JSON.stringify({target_user:user.id})});
      if(!removed.ok)return reply(503,'Account deletion failed. Your local data has been kept. Try again.');
      return reply(200,'Account permanently deleted.');
    }catch(_){return reply(503,'Account deletion could not be completed. Try again.');}
  };
}
