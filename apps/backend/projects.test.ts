import assert from "node:assert/strict";
import { test, after } from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
process.env.NODE_ENV = "test";
process.env.STUDIO_TEST_DATA_DIR = mkdtempSync(path.join(tmpdir(), "studio-project-tests-"));
const store = await import("./src/studio-store.js");
const { emptyProject, validateProject } = await import("./src/studio-timeline.js");
const { parseScript, generateScript } = await import("./src/project-script.js");
const { listStudioMedia, projectScopeError, sourceScopeError } = await import("./src/studio-media.js");
const { saveAudioJob } = await import("./src/audio-store.js");
const { assembleClips, createTopicProject, cancelProject, resumeProjectOperations } = await import("./src/project-workflow.js");
after(() => rmSync(process.env.STUDIO_TEST_DATA_DIR!, { recursive: true, force: true }));
function script() { return parseScript({ title: "Coffee shop morning", voiceover_full: "The shop opens. A fresh start.", scenes: Array.from({length:6}, (_,i) => ({ heading:`Scene ${i}`, voiceover_line:"The shop opens.", stock_query:"coffee shop morning",duration_sec:8 })) }); }
function fixture(id:string) {
  const p=emptyProject(id,id); p.topic=id; p.phase="cast"; p.script=script();
  for(const [i,s] of p.script.scenes.entries()) {const uid=`${id}-${i}`;
    store.saveUpload({id:uid,project_id:id,filename:`${uid}.mp4`,mime:"video/mp4",bytes:10,kind:"video",duration_s:10,r2_key:`studio/projects/${id}/uploads/${uid}.mp4`,created_at:new Date().toISOString()});
    s.status="picked";s.picked_upload_id=uid;s.candidates=[{upload_id:uid,kind:"video",label:s.heading,preview_url:`/api/studio/uploads/${uid}/file`,duration_s:10,pexels_id:i,photographer:"Fixture",license_url:"https://www.pexels.com/license/",pexels_url:"https://www.pexels.com"}];
  }
  return store.saveProject(p);
}
test("same-id assembly and media isolation survive reload",()=>{
  const a=fixture("a"),b=fixture("b");a.script!.scenes[1].status="skipped";
  a.clips=assembleClips(a,"a-audio",55);a.phase="studio";store.saveProject(a);
  assert.equal(store.getProject("a")!.id,a.id);assert.equal(store.getProject("b")!.clips.length,0);
  assert.equal(store.getProject("a")!.script!.scenes[1].status,"skipped");
  assert.ok(listStudioMedia("a").uploads.every(u=>u.id.startsWith("a-")));
  assert.ok(listStudioMedia("b").uploads.every(u=>u.id.startsWith("b-")));
  assert.equal(listStudioMedia().uploads.length,0);
  assert.equal(validateProject(a),null); assert.equal(Math.max(...a.clips.map(c=>c.start_sec+c.crop_end-c.crop_start)),55);
  assert.match(sourceScopeError(b,{type:"upload",id:"a-0"})!,/belong/);
  assert.match(projectScopeError({...b,clips:[a.clips[0]]})!,/belong/);
  assert.ok(a.clips.filter(c=>c.kind==='video').every(c=>c.volume===0));
});
test("script input bounds reject extra scenes, bad queries and owner timing errors",()=>{
  const valid=script(); assert.equal(parseScript(valid,valid).scenes[0].id,valid.scenes[0].id);
  assert.throws(()=>parseScript({...valid,scenes:Array(9).fill(valid.scenes[0])}),/6–8/);
  assert.equal(parseScript({...valid,scenes:valid.scenes.map(s=>({...s,stock_query:"coffee"}))}).scenes[0].stock_query.split(/\s+/).length,3);
  assert.throws(()=>parseScript({...valid,scenes:valid.scenes.map(s=>({...s,duration_sec:4}))}),/45–60/);
});
test("generated timing normalizes without retry or media model calls",async()=>{
  const original=globalThis.fetch;let calls=0;
  globalThis.fetch=async(input,init)=>{calls++;assert.match(String(input),/chat\/completions$/);const body=JSON.parse(String(init!.body));assert.equal(body.model.includes('flux'),false);
    return new Response(JSON.stringify({choices:[{message:{content:JSON.stringify({...script(),scenes:script().scenes.map(s=>({...s,duration_sec:5}))})}}]}));};
  try{const result=await generateScript('coffee',new AbortController().signal);assert.equal(result.script.scenes.reduce((n,s)=>n+s.duration_sec,0),48);assert.equal(calls,1);}finally{globalThis.fetch=original;}
});
test("cancel queued script prevents vendor calls and restart never resubmits",async()=>{
  const original=globalThis.fetch;let calls=0;globalThis.fetch=async()=>{calls++;throw Error('should not call');};
  try{const p=createTopicProject('cancel fixture');cancelProject(p.id);await new Promise(r=>setTimeout(r,30));assert.equal(calls,0);assert.equal(store.getProject(p.id)!.status,'cancelled');
    const restart=fixture('restart');restart.status='running';restart.operation='script';restart.operation_id='old';store.saveProject(restart);resumeProjectOperations();assert.equal(store.getProject('restart')!.status,'failed');assert.equal(calls,0);
  }finally{globalThis.fetch=original;}
});
test("sfx and music jobs can join a documentary timeline",()=>{
  const now = new Date().toISOString();
  saveAudioJob({
    id:"sfx-bed", created_at:now, updated_at:now, status:"COMPLETED", phase:"done", phase_label:"done",
    kind:"sfx", provider:"ai33pro", title:"Cafe bed", input_mime:null, input_filename:null,
    output_mime:"audio/mpeg", output_filename:"sfx-bed.mp3", has_srt:false, has_video:false,
    has_cover:false, has_alt:false, provider_job_id:"vendor-sfx", error:null, duration_ms:8000,
    estimated_usd:0, usd_per_hour_assumed:null, quoted_credits:0, credit_cost:0, credits_remaining:0,
    vendor_progress:100, vendor_type:"sfx", params:{}, provider_meta:{}, transcript:null,
  });
  const p=fixture("beds");
  const other=fixture("beds-other");
  other.tts_job_id="other-vo"; store.saveProject(other);
  assert.ok(listStudioMedia(p.id).audio.some(a=>a.id==="sfx-bed" && a.bin==="sfx"));
  assert.equal(sourceScopeError(p,{type:"audio",id:"sfx-bed"}),null);
  assert.match(sourceScopeError(p,{type:"audio",id:"other-vo"})!,/belong/);
});
test("timeline hard cap and nonfinite clips are rejected",()=>{
  const p=fixture('limits');p.clips=assembleClips(p,'audio',91);assert.match(validateProject(p)!,/90/);
  p.clips=p.clips.slice(0,1);p.clips[0].start_sec=NaN;assert.match(validateProject(p)!,/invalid clip/);
});
