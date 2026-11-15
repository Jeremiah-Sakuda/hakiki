// Owner-operated setup using the authenticated Firebase CLI. Never prints credentials.
const path=require('node:path');
const fs=require('node:fs');
const crypto=require('node:crypto');
const root=path.join(process.env.APPDATA,'npm/node_modules/firebase-tools/lib');
const load=p=>require(path.join(root,p));
const project='hakiki-hybrid-2026',projectNumber='19070298019',appId='1:19070298019:web:68b5dbb123f95f4d635c16';
(async()=>{
 const {configstore}=load('configstore');
 await load('requireAuth').requireAuth({project,nonInteractive:true,user:configstore.get('user'),tokens:configstore.get('tokens')});
 const {Client}=load('apiv2');
 await load('ensureApiEnabled').ensure(project,'recaptchaenterprise.googleapis.com','Hakiki');
 await load('ensureApiEnabled').ensure(project,'firebaseappcheck.googleapis.com','Hakiki');
 const client=new Client({urlPrefix:'https://recaptchaenterprise.googleapis.com',apiVersion:'v1',auth:true});
 const existing=await client.get(`projects/${project}/keys`);
 let key=existing.body.keys?.find(k=>k.displayName==='Hakiki web attestation');
 if(!key){const created=await client.post(`projects/${project}/keys`,{displayName:'Hakiki web attestation',webSettings:{allowedDomains:[`${project}.web.app`,`${project}.firebaseapp.com`],allowAllDomains:false,integrationType:'SCORE'}});key=created.body;}
 const siteKey=key.name.split('/').pop();
 const check=load('appcheck/api');
 await check.updateProviderConfig(projectNumber,appId,'recaptcha-enterprise',{siteKey,tokenTtl:'3600s',riskScore:0.5},['siteKey','tokenTtl','riskScore']);
 await check.updateService(projectNumber,'firebaseml.googleapis.com',{enforcementMode:'ENFORCED'});
 const sdk=await new Client({urlPrefix:'https://firebase.googleapis.com',apiVersion:'v1beta1',auth:true}).get(`projects/${project}/webApps/${appId}/config`);
 const c=sdk.body;
 fs.writeFileSync('.env.local',`VITE_FIREBASE_API_KEY=${c.apiKey}\nVITE_FIREBASE_AUTH_DOMAIN=${c.authDomain}\nVITE_FIREBASE_PROJECT_ID=${project}\nVITE_FIREBASE_APP_ID=${appId}\nVITE_FIREBASE_MESSAGING_SENDER_ID=${projectNumber}\nVITE_RECAPTCHA_SITE_KEY=${siteKey}\nVITE_CLOUD_MODEL=gemini-3.8-flash\n`);
 if(!fs.existsSync('.env.development.local')){
   const token=crypto.randomUUID();
   await check.createDebugToken(projectNumber,appId,'Hakiki local implementation',token);
   fs.writeFileSync('.env.development.local',`VITE_APPCHECK_DEBUG_TOKEN=${token}\n`);
 }
 console.log('Web configuration saved to ignored environment files. Production attestation registered; AI Logic App Check enforced.');
})().catch(e=>{console.error('Setup failed:',e.message);process.exitCode=1;});
