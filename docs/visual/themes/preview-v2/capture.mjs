// WebKit emulation. Run from repo root through scripts/env.mjs while holding the browser lock.
import { webkit } from '../../../../node_modules/@playwright/test/index.mjs';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
const root=process.cwd(), out=resolve('docs/visual/themes/preview-v2');
const executable=process.env.DUCK_WEBKIT_EXECUTABLE;
const browser=await webkit.launch(executable ? {executablePath:executable}:{});
const records=[],errors=[];
try {
 for (const device of ['phone']) {
  const viewport=device==='phone'?{width:390,height:844}:{width:1440,height:900};
  const context=await browser.newContext({viewport,deviceScaleFactor:1,hasTouch:device==='phone'});
  const page=await context.newPage();
  page.on('pageerror',e=>errors.push(e.message));
  for (const config of [
   {outfit:'duck',variant:'ring',hat:'duckCap',color:'sand',front:'none',back:'none'},
   {outfit:'duck',variant:'plain',hat:'duckCap',color:'sand',front:'none',back:'none'},
   {outfit:'duck',variant:'ring',hat:'none',color:'sand',front:'none',back:'none'},
   {outfit:'duck',variant:'plain',hat:'none',color:'sand',front:'none',back:'none'},
   {outfit:'frog',variant:'default',hat:'frogHat',color:'pine',front:'raincoatPockets',back:'leafPack'},
   {outfit:'fish',variant:'puffer',hat:'fishHeadgear',color:'clay',front:'none',back:'none'},
   {outfit:'fish',variant:'shark',hat:'fishHeadgear',color:'slate',front:'none',back:'finPouch'},
   {outfit:'robotCat',variant:'default',hat:'robotHood',color:'river',front:'utilityPocket',back:'none'},
  ]) {
   const {variant,hat}=config;
   const prefix=`${device}-${config.outfit}-${variant}-${hat==='none'?'hat-off':'hat-on'}`;
   const query=new URLSearchParams({...config,n:'7',quality:'high',audio:'0',panel:'0',speak:'0'});
   // Native scene snapshots: seating by day and authorized ghost view at night.
   for (const state of ['seating']) {
    const q=new URLSearchParams(query); q.set('scene',state==='night'||state==='ghost-day'?'ghost':state==='seating'?'seating':'lobby');
    await page.goto(`http://127.0.0.1:4200/?${q}`);
    await page.waitForFunction(()=>window.__moonveil?.ready,null,{timeout:20000});
    await page.evaluate(async ({root,state})=>{
     // Reuse real mountScene in a controlled fixture, rather than mutate the dev harness's private server.
     const {mountScene}=await import(`/@fs/${root}/packages/scene/src/scene.ts`);
     const {makeInput}=await import(`/@fs/${root}/packages/scene/fixtures/index.ts`);
     const query=new URLSearchParams(location.search);
     const input=makeInput(state==='night'?'night':state==='ghost-day'?'ghost':state==='seating'?'seating':'lobby',7,state==='night'?{viewer:'s4',dead:['s4','s7']}:{});
     input.players=input.players.map(p=>({...p,appearance:{...p.appearance,outfit:query.get('outfit'),variant:query.get('variant'),hat:query.get('hat'),top:query.get('color'),extra:'none',front:query.get('front'),back:query.get('back')}}));
     // Harness stays mounted underneath; only one controlled scene is visible and it is destroyed before navigation.
     document.getElementById('scene').style.display='none'; document.getElementById('hud')?.remove();
     const host=document.createElement('div');host.style.cssText='position:fixed;inset:0';document.body.append(host);
     const scene=mountScene(host,{input,quality:'high',debug:true});await scene.ready;
     scene.setSafeArea({top:48});scene.setSpeakingLocal(true);
     window.__duckScene=scene;
     if(state==='walk-right'||state==='walk-left'){
      const pos=scene.localPose();scene.walkLocal(pos.x+(state==='walk-right'?200:-200),pos.y);
     }
     const badge=document.createElement('div');badge.style.cssText='position:fixed;top:8px;left:8px;right:8px;background:#172722ed;color:#ffedca;padding:8px;font:12px system-ui;z-index:10';
     badge.textContent=`WebKit emulation · ${query.get('outfit')} / ${query.get('variant')} · ${query.get('hat')} · ${state==='night'?'night ghost view / living in tents':state==='ghost-day'?'day ghost view / speaking':`day ${state} / speaking`}`;document.body.append(badge);
    },{root,state});
    await page.waitForFunction(()=>window.__duckScene.time()>0.8,null,{timeout:20000});
    const file=`scene-${prefix}-${state==='night'?'night-ghost':state==='seating'?'day-seated':state==='ghost-day'?'day-ghost':`day-${state}`}.png`;
    await page.screenshot({path:resolve(out,file)});
    records.push({file,type:'scene',device,...config,state,localPose:await page.evaluate(()=>window.__duckScene.localPose())});
    await page.evaluate(()=>window.__duckScene.destroy());
   }
   // A single renderer board contains both facings and six pose rows at native pixel size.
   for(const night of config.outfit==='duck'?[false]:[]) {
    await page.goto(`http://127.0.0.1:4200/?${query}&scene=lobby&quality=off`);
    await page.waitForFunction(()=>window.__moonveil?.ready,null,{timeout:20000});
    const details=await page.evaluate(async ({root,night,device,variant,hat})=>{
     const base=`/@fs/${root}/packages/scene/src/`;
     const avatarSource=await (await fetch(base+'avatar.ts')).text();
     const pixiPath=avatarSource.match(/from "([^"]*pixi__js[^\"]*)"/)[1];
     const {Application,Container,Text}=await import(pixiPath);
     const {Avatar}=await import(base+'avatar.ts');
     const {TextureBank}=await import(base+'textures.ts');
     document.body.replaceChildren();document.body.style.cssText='margin:0;background:#182c29;overflow:hidden';
     const app=new Application();await app.init({width:innerWidth,height:innerHeight,resolution:1,antialias:true,background:night?'#182c29':'#52763b',preference:'webgl'});app.stop();document.body.append(app.canvas);
     const bank=new TextureBank(app.renderer),scale=device==='phone'?0.65:0.8;
     const text=(value,x,y,size=12)=>{const t=new Text({text:value,style:{fontFamily:'system-ui',fontSize:size,fill:0xffedca}});t.position.set(x,y);app.stage.addChild(t);return t;};
     text('WebKit emulation / DUCK POSE DIAGNOSTIC',12,12,device==='phone'?14:20);
     text(`${variant} · ${hat} · ${night?'night':'day'} flat ground · body 0.8 × camera ${scale}`,12,41,device==='phone'?11:14);
     text('Actual avatar renderer; all speaking. Ghost seated* = squash study.',12,63,device==='phone'?10:13);
     const rows=[['Living idle','idle',false],['Living walk','walk',false],['Living seated','seated',false],['Ghost idle','ghost',false],['Ghost drift','ghost',true],['Ghost seated*','ghost','seat']];
     text('RIGHT →',device==='phone'?90:450,84,10);text('← LEFT',device==='phone'?260:920,84,10);
     const measurements=[];
     rows.forEach(([label,mode,motion],i)=>{
      const top=99+i*(device==='phone'?116:126),feet=top+99;
      text(label,12,top,device==='phone'?10:12);
      for(const [col,facing] of [[0,1],[1,-1]]) {
       const x=device==='phone'?(col===0?110:280):(col===0?480:950);
       const a=new Avatar(`pose-${i}-${col}`,'Minh',{skin:'light',top:'sand',hair:'short',hairColor:'black',hat,extra:'none',outfit:'duck',variant,front:'none',back:'none'},bank);
       a.mode=mode;a.setPos(0,0);a.facing=facing;a.speaking=true;a.setLabelSize(12);
       const moving=mode==='walk'||motion===true;
       for(let tick=0;tick<20;tick++)a.applyPose(0,0,facing,moving,1/60,1/scale);
       if(motion==='seat'){a.body.scale.x*=1.06;a.body.scale.y*=0.86;a.body.y+=2;}
       const group=new Container();group.position.set(x,feet);group.scale.set(scale);group.addChild(a.shadow,a.ring,a.body,a.arcs,a.label);app.stage.addChild(group);
       // Facing is recorded and shown once in the column heading.
       measurements.push({label,facing,ghost:a.mode==='ghost',bodyScale:{x:a.body.scale.x,y:a.body.scale.y},bodyAlpha:a.body.alpha,labelSize:a.label.style.fontSize});
      }
     });
     text('Flat grounds: no scene lightmap. Native size; no enlargement. *Not gameplay.',12,innerHeight-20,device==='phone'?9:12);
     app.render();window.__duckApp=app;return measurements;
    },{root,night,device,variant,hat});
    const file=`poses-${prefix}-${night?'night':'day'}.png`;
    await page.screenshot({path:resolve(out,file)});
    records.push({file,type:'pose diagnostic',device,...config,night,details});
    await page.evaluate(()=>window.__duckApp.destroy(true));
   }
   console.log('captured',prefix);
  }
  await context.close();
 }
} finally {await browser.close();writeFileSync(resolve(out,'manifest.json'),JSON.stringify({revision:'9470ea9655425380fb5a4915a438a53d9e51194f',engine:'WebKit emulation',errors,records},null,2)+'\n');}
if(errors.length)throw new Error(errors.join('\n'));
console.log('WebKit emulation captures complete',records.length);
