// @ts-nocheck -- scene definitions carried over verbatim from the course site; each scene's build() returns its steps.
/* Agent Architectures: "See it run" scenes. All companies are fictional; costs and timings are illustrative. */

import type { SxScene } from '@/presentation/site/sx/SxPlayer';

export const ARCHITECTURE_SCENES: Record<string, SxScene> = {};
const SX = { add(id: string, scene: SxScene) { ARCHITECTURE_SCENES[id] = scene; } };
(()=>{
const NOTE='Costs and timings are illustrative, not real prices. All companies and people are fictional.';

/* ---------- Workflow Patterns: router with a completeness gate (Suraksha Health) ---------- */
SX.add('workflows',{
  intro:'Suraksha Health, a fictional insurer, sorts claims with a routing workflow: a small model names the claim type, then <b>your code</b> decides the path.',
  note:NOTE, rate:0.30, meters:['calls','tok','inr','ms'],
  nodes:[
    {id:'cu',kind:'user',x:8,y:150,w:84,h:56,label:'Customer',sub:'claim'},
    {id:'cl',kind:'model',x:110,y:146,w:104,h:64,label:'Classifier',sub:'small model'},
    {id:'ro',kind:'code',x:236,y:150,w:82,h:56,label:'Router',sub:'your code'},
    {id:'ca',kind:'model',x:346,y:40,w:124,h:56,label:'Cashless path',sub:'prompt A'},
    {id:'re',kind:'model',x:346,y:150,w:124,h:56,label:'Reimbursement',sub:'prompt B'},
    {id:'hu',kind:'human',x:346,y:262,w:124,h:52,label:'Claims specialist',sub:'fallback',dim:true},
    {id:'ga',kind:'check',x:500,y:150,w:124,h:56,label:'Completeness',sub:'code check'}],
  links:[
    {id:'cu-cl',kind:'user',d:'M92,178 L108,178'},
    {id:'cl-ro',kind:'model',d:'M214,178 L234,178'},
    {id:'ro-ca',kind:'code',d:'M318,168 Q330,68 344,68'},
    {id:'ro-re',kind:'code',d:'M318,178 L344,178'},
    {id:'ro-hu',kind:'human',d:'M318,188 Q330,288 344,288'},
    {id:'re-ga',kind:'model',d:'M470,178 L498,178'},
    {id:'ga-cu',kind:'good',d:'M562,206 C562,352 50,352 50,208',label:'reply',lx:300,ly:338},
    {id:'ca-cu',kind:'bad',d:'M408,40 C408,4 50,4 50,148',label:'reply',lx:230,ly:16},
    {id:'hu-cu',kind:'human',d:'M346,300 C220,318 90,280 60,208'}],
  toggles:[{id:'odd',label:'Break it: an unfamiliar claim arrives',brk:true},{id:'fb',label:'Low-confidence fallback',def:true}],
  build(o){
    if(!o.odd) return [
      {cap:'A claim arrives. The first model call has one narrow job: name the claim type.',path:['cu-cl'],on:['cl'],tr:[['Q','Reimbursement claim: ₹38,500 for a 3-day stay at Sunrise Hospital, Pune. Bills attached.']],tok:0,ms:0},
      {cap:'A small, cheap classifier labels it. It does not decide what happens next.',on:['cl'],tr:[['Route','reimbursement · confidence 0.93']],call:1,tok:420,ms:500},
      {cap:'Plain code, not the model, picks the path. No model call, no cost, and the same result every time.',path:['cl-ro','ro-re'],on:['ro','re'],tr:[['Code','if type == "reimbursement": run prompt_B']],tok:0,ms:5},
      {cap:'The reimbursement prompt knows exactly which fields this claim type needs.',on:['re'],tr:[['Result','patient=A. Kulkarni · amount=₹38,500 · bills=4 · discharge_summary=MISSING']],call:1,tok:1800,ms:1400},
      {cap:'A plain-code gate checks the output before anything moves on, so bad output stops early.',path:['re-ga'],on:['ga'],tr:[['Check','required fields present? discharge_summary → FAIL']],tok:0,ms:5,
        predict:{q:'The discharge summary is missing. What should happen next?',opts:['Let the model fill in a likely diagnosis','Stop at the gate and ask the customer for the document','Send the claim down the cashless path instead'],ok:1,
          why:'Workflows put plain-code checks between steps. Guessing medical facts would be wrong, and a different path will not fix a missing document.'}},
      {cap:'Done: 2 model calls, a predictable path, and a clear next step for the customer.',path:['ga-cu'],on:['cu'],ok:true,tr:[['Answer','We need your discharge summary to process this claim. Upload it here and we will continue from where we stopped.']],tok:0,ms:10}];
    const s=[
      {cap:'Now a claim nobody planned for. The routes only know cashless and reimbursement claims.',path:['cu-cl'],on:['cl'],tr:[['Q','I had Panchakarma treatment in Kerala while visiting from Dubai. Can I claim ₹22,000?']],tok:0,ms:0},
      {cap:'The classifier has never seen this kind of claim. It must still pick a label, so it guesses with low confidence.',on:['cl'],tr:[['Route','cashless · confidence 0.41']],call:1,tok:420,ms:500}];
    if(o.fb) return s.concat([
      {cap:'The router checks confidence in code. Anything below 0.70 goes to a person instead of a path built for something else.',path:['cl-ro','ro-hu'],on:['ro','hu'],tr:[['Code','confidence 0.41 < 0.70 → send to a claims specialist']],tok:0,ms:5},
      {cap:'Safe outcome: one cheap model call, and the unusual claim reaches someone who can judge it.',path:['hu-cu'],on:['hu','cu'],ok:true,tr:[['Answer','A claims specialist will review your AYUSH treatment claim within 1 working day.']],tok:0,ms:10}]);
    return s.concat([
      {cap:'No fallback: the router trusts the label, even at 0.41.',path:['cl-ro','ro-ca'],on:['ro','ca'],tr:[['Code','if type == "cashless": run prompt_A']],tok:0,ms:5},
      {cap:'The cashless prompt does its job perfectly, for the wrong kind of claim.',on:['ca'],tr:[['Result','cashless claims need pre-authorisation at a network hospital']],call:1,tok:1500,ms:1200},
      {cap:'A wrong answer, confidently given. A router without a fallback silently misroutes unfamiliar requests. Switch the fallback back on.',path:['ca-cu'],on:['cu'],bad:true,tr:[['Answer','Please show your e-card at the hospital insurance desk before admission.']],tok:0,ms:10}]);
  }});

/* ---------- ReAct Loop (PaySetu) ---------- */
const UTR='4172…9036', Q1='My UPI payment of ₹12,000 to Kirana Mart failed but the money left my account. Refund please.';
SX.add('react',{
  intro:'A support agent at PaySetu, a fictional payments app, handles a failed UPI payment. Watch the loop, predict the key move, then switch on <b>Break it</b>.',
  note:NOTE, rate:0.30, meters:['loops','tok','inr','ms'], ctx:{max:8000,label:'Context window'}, hot:{loops:5,tok:20000,ms:60000},
  nodes:[
    {id:'cu',kind:'user',x:28,y:88,w:104,h:56,label:'Customer',sub:'UPI app'},
    {id:'mo',kind:'model',x:266,y:78,w:108,h:72,label:'Model',sub:'reason → act'},
    {id:'to',kind:'tool',x:508,y:80,w:112,h:72,label:'Tools',sub:'2 tools'},
    {id:'hu',kind:'human',x:262,y:262,w:116,h:52,label:'Human agent',sub:'takes over',dim:true}],
  links:[
    {id:'cu-mo',kind:'user',d:'M132,100 Q200,62 264,100'},
    {id:'mo-cu',kind:'good',d:'M264,132 Q200,172 132,132'},
    {id:'mo-to',kind:'tool',d:'M374,100 Q440,50 506,100',label:'action',lx:440,ly:58},
    {id:'to-mo',kind:'mem',d:'M506,132 Q440,182 374,132',label:'observation',lx:440,ly:186},
    {id:'mo-hu',kind:'human',d:'M320,150 Q320,212 320,260'}],
  toggles:[{id:'brk',label:'Break it: the lookup tool times out',brk:true},{id:'cap',label:'Step cap (max 5 loops)',def:true}],
  build(o){
    const capTxt=n=>o.cap?`loop ${n} / cap 5`:`loop ${n} / no cap`;
    if(!o.brk) return [
      {cap:'A customer message reaches the agent. In ReAct, the model decides every next step itself.',path:['cu-mo'],on:['mo'],tr:[['Q',Q1]],ctx:420,sub:{mo:capTxt(0)}},
      {cap:'Reason: the model writes a short thought about what it needs to know.',on:['mo'],tr:[['Thought','I need the transaction status before promising anything.']],ctx:120,call:1,ms:900},
      {cap:'Act: it picks a tool and fills in the arguments.',path:['mo-to'],on:['to'],tr:[['Action',`lookup_txn(utr="${UTR}")`]],ctx:60,loop:1,ms:400,sub:{mo:capTxt(1)}},
      {cap:'Observe: the tool result goes back into the context, and the loop goes round again.',path:['to-mo'],on:['mo'],tr:[['Observation','status=FAILED · debited=true · reversal=not started']],ctx:180,ms:700},
      {cap:'The model reasons about the new facts instead of following a fixed script.',on:['mo'],tr:[['Thought','A failed UPI debit usually reverses on its own. Check before refunding, or we might pay twice.']],ctx:140,call:1,ms:1000,
        predict:{q:'The money left the account but the payment failed. What should the agent do next?',opts:['Tell the customer the refund is done','Call issue_refund(₹12,000) right away','Check whether an automatic reversal is already on the way'],ok:2,
          why:'Failed UPI debits are normally reversed automatically within a day (T+1). Refunding now could pay the customer twice, so a careful agent checks first.'}},
      {cap:'Act again: a second tool call, chosen because of what the first one returned.',path:['mo-to'],on:['to'],tr:[['Action',`check_reversal(utr="${UTR}")`]],ctx:60,loop:1,ms:400,sub:{mo:capTxt(2)}},
      {cap:'Observe: the reversal is already scheduled.',path:['to-mo'],on:['mo'],tr:[['Observation','reversal=scheduled · expected=tomorrow (T+1)']],ctx:120,ms:600},
      {cap:'The model decides it has enough to answer. Deciding when to stop is part of the loop too.',on:['mo'],tr:[['Thought','I have what I need. No refund call required.']],ctx:80,call:1,ms:800},
      {cap:'Finish: a correct answer after 2 loops and 3 model calls, with no double refund.',path:['mo-cu'],on:['cu'],ok:true,tr:[['Answer','Your ₹12,000 will come back automatically by tomorrow. If it has not, reply here and I will raise a dispute.']],ctx:90,ms:900}];
    const s=[{cap:'Same customer, but today the lookup tool is down and times out on every call.',path:['cu-mo'],on:['mo'],tr:[['Q',Q1]],ctx:420,sub:{mo:capTxt(0)}}];
    let ctx=420;
    for(let i=1;i<=20;i++){ ctx+=600; const last=!o.cap&&ctx+600>8000;
      s.push({cap:i===1?'The model calls the lookup tool, and the call times out after 10 seconds.':i===2?'With no rule to stop, the model simply tries again. Every retry re-sends the growing context.':`Loop ${i}: the same call and the same timeout. The context keeps growing, and so does the bill.`,
        path:['mo-to','to-mo'],on:['to','mo'],loop:1,call:1,ctx:600,ms:11900,sub:{mo:capTxt(i)},
        tr:[['Thought',i===1?'I need the transaction status.':'The lookup timed out. Retry.'],['Action',`lookup_txn(utr="${UTR}")`],['Error','timeout after 10s']]});
      if(o.cap&&i===5){ s.push({cap:'Step cap reached. The agent stops, tells the customer, and hands the case to a human with the full trace. This is a safe failure.',path:['mo-hu'],on:['hu'],ok:true,ms:300,
        tr:[['Stop','step cap (5) reached → escalate to a human agent'],['Answer','Sorry, I cannot check this right now. A support agent will pick it up within 2 hours.']]}); break; }
      if(last){ s.push({cap:'Context window full. The request crashes after about 2 minutes, and the customer gets nothing. Now switch the step cap back on.',on:['mo'],bad:true,tr:[['Error','context_length_exceeded: request failed']]}); break; }
    }
    return s;
  }});

/* ---------- Plan-and-Execute / ReWOO (SkyVahan Airlines) ---------- */
const PQ='My Bengaluru to Delhi flight SV-412 today was cancelled. Rebook me on the next flight and refund my ₹450 seat fee.';
SX.add('planexec',{
  intro:'SkyVahan, a fictional airline, uses ReWOO: a large model plans once, tools run the plan without model calls in between, and a solver writes the reply.',
  note:NOTE+' Large-model calls are priced higher than tool calls.', meters:['calls','tok','inr','ms'],
  nodes:[
    {id:'cu',kind:'user',x:2,y:150,w:104,h:56,label:'Customer',sub:'flight gone'},
    {id:'pl',kind:'model',x:130,y:52,w:124,h:64,label:'Planner',sub:'large model'},
    {id:'to',kind:'tool',x:300,y:150,w:124,h:64,label:'Executor',sub:'tools only'},
    {id:'ev',kind:'mem',x:470,y:52,w:150,h:64,label:'Evidence',sub:'empty'},
    {id:'so',kind:'model',x:470,y:246,w:150,h:60,label:'Solver',sub:'large model'}],
  links:[
    {id:'cu-pl',kind:'user',d:'M106,166 Q116,90 128,86'},
    {id:'pl-to',kind:'model',d:'M254,100 Q300,110 330,148',label:'plan',lx:310,ly:112},
    {id:'to-ev',kind:'tool',d:'M424,172 Q458,140 490,118',label:'#E',lx:470,ly:158},
    {id:'ev-so',kind:'mem',d:'M545,116 L545,244'},
    {id:'so-cu',kind:'good',d:'M470,282 C260,344 70,300 54,208'},
    {id:'ev-pl',kind:'bad',d:'M470,70 Q362,20 256,72',label:'replan',lx:362,ly:36,hidden:true}],
  toggles:[{id:'sold',label:'Break it: seats sell out during the run',brk:true},{id:'rp',label:'Replanner',def:true}],
  build(o){
    const L=(t,k)=>({tok:t,inr:t/1000*1.2,call:1,ms:k});
    const head=[
      {cap:'The request arrives at the planner, the only step that needs a large model up front.',path:['cu-pl'],on:['pl'],tr:[['Q',PQ]],tok:0},
      Object.assign({cap:'The planner writes the whole plan once, as structured steps. #E1 and #E2 are placeholders for results that do not exist yet.',on:['pl'],
        tr:[['Plan','#E1 = get_booking(pnr="QX7K2P")'],['Plan','#E2 = find_flights(BLR, DEL, today)'],['Plan','#E3 = rebook(#E1, #E2[0])'],['Plan','#E4 = refund_fee(#E1, "seat")']]},L(1400,2500)),
      {cap:'The executor runs step 1. It is a plain tool call, with no model call in between.',path:['pl-to','to-ev'],on:['to','ev'],tr:[['Result','#E1 = booking QX7K2P · seat fee ₹450']],sub:{ev:'#E1'},tok:0,ms:300},
      {cap:'Step 2 runs straight after step 1, feeding on its result.',path:['to-ev'],on:['to','ev'],tr:[['Result',o.sold?'#E2 = SV-418 at 18:40 · 1 seat left':'#E2 = SV-418 at 18:40 · 3 seats left']],sub:{ev:'#E1 #E2'},tok:0,ms:400,
        predict:{q:'Between the tool calls for #E1, #E2, #E3 and #E4, how many model calls does ReWOO make?',opts:['None: the executor fills in the placeholders','One small-model call per step','One large-model call per step, like ReAct'],ok:0,
          why:'The plan names each result as a variable, so tools run back to back. That is where the savings come from.'}}];
    if(!o.sold) return head.concat([
      {cap:'Step 3 uses #E1 and #E2 without asking a model anything.',path:['to-ev'],on:['to','ev'],tr:[['Result','#E3 = rebooked on SV-418, seat 14C']],sub:{ev:'#E1 … #E3'},tok:0,ms:500},
      {cap:'Step 4 finishes the plan.',path:['to-ev'],on:['to','ev'],tr:[['Result','#E4 = ₹450 refunded to the original payment method']],sub:{ev:'#E1 … #E4'},tok:0,ms:500},
      Object.assign({cap:'One solver call writes the reply from the evidence. Total: 2 large-model calls, where a ReAct agent would make about 5.',path:['ev-so','so-cu'],on:['so','cu'],ok:true,
        tr:[['Answer','You are rebooked on SV-418 today at 18:40, seat 14C, and your ₹450 is on its way back to your card.']]},L(900,1500))]);
    const fail={cap:'The world changed after planning: the last seat went to someone else, so step 3 fails.',path:['to-ev'],on:['to','ev'],tr:[['Error','#E3 = rebook failed: SOLD_OUT']],sub:{ev:'#E1 #E2 ✗E3'},tok:0,ms:500};
    if(o.rp) return head.concat([fail,
      Object.assign({cap:'The failed step triggers a replan. The planner sees the evidence so far and rewrites only the rest of the plan.',path:['ev-pl'],on:['pl'],show:['ev-pl'],
        tr:[['Plan','#E3 = find_flights(BLR, DEL, tomorrow)'],['Plan','#E4 = rebook(#E1, #E3[0])'],['Plan','#E5 = refund_fee(#E1, "seat")']]},L(1100,2000)),
      {cap:'The executor runs the new steps, still without model calls in between.',path:['pl-to','to-ev'],on:['to','ev'],tr:[['Result','#E3 = SV-402 tomorrow at 07:10 · 12 seats'],['Result','#E4 = rebooked on SV-402, seat 9A'],['Result','#E5 = ₹450 refunded']],sub:{ev:'#E1 … #E5'},tok:0,ms:1300},
      Object.assign({cap:'Recovered: 3 large-model calls instead of 2, and a correct reply. Replanning only when something fails keeps the plan cheap and safe.',path:['ev-so','so-cu'],on:['so','cu'],ok:true,
        tr:[['Answer','Today\'s flights are full, so I have rebooked you on SV-402 tomorrow at 07:10, seat 9A. Your ₹450 is on its way back.']]},L(900,1500))]);
    return head.concat([fail,
      {cap:'No replanner: the executor carries on with the steps that still work.',path:['to-ev'],on:['to','ev'],tr:[['Result','#E4 = ₹450 refunded']],sub:{ev:'#E1 #E2 ✗E3 #E4'},tok:0,ms:500},
      Object.assign({cap:'One failed step sank the task. The customer has a refund but no flight. Switch the replanner back on.',path:['ev-so','so-cu'],on:['so','cu'],bad:true,
        tr:[['Answer','Your ₹450 seat fee has been refunded. I could not rebook you; please contact the airport counter.']]},L(900,1500))]);
  }});

/* ---------- Reflection / evaluator–optimizer (Kosh Finance) ---------- */
const DR={1:'Dear applicant, we regret we cannot approve your loan at this time due to FOIR norms…',
  2:'…because your EMIs would take 64% of your monthly income, and our limit is 60%. You can reapply after 6 months…',
  3:'…adds the grievance officer\'s email, but shortens the reason to "internal policy limits"…'};
SX.add('reflect',{
  intro:'Kosh Finance, a fictional lender, drafts loan rejection letters with an evaluator–optimizer loop. The evaluator checks each draft against a written list of 10 rules.',
  note:NOTE, rate:0.30, meters:['calls','tok','inr','ms'], hot:{tok:20000},
  nodes:[
    {id:'of',kind:'user',x:2,y:150,w:118,h:56,label:'Credit officer',sub:'request'},
    {id:'ge',kind:'model',x:150,y:50,w:130,h:64,label:'Generator',sub:'drafts'},
    {id:'ev',kind:'check',x:150,y:246,w:130,h:64,label:'Evaluator',sub:'10 rules'},
    {id:'ru',kind:'mem',x:330,y:246,w:128,h:64,label:'Rule list',sub:'fair-practice code'},
    {id:'be',kind:'mem',x:330,y:50,w:132,h:64,label:'Best so far',sub:'none yet'},
    {id:'ap',kind:'user',x:500,y:150,w:124,h:56,label:'Applicant',sub:'gets the letter'}],
  links:[
    {id:'of-ge',kind:'user',d:'M120,166 Q132,92 148,86'},
    {id:'ge-ev',kind:'model',d:'M200,114 L200,244',label:'draft',lx:172,ly:184},
    {id:'ev-ge',kind:'check',d:'M232,244 L232,116',label:'critique',lx:268,ly:184},
    {id:'ru-ev',kind:'mem',d:'M330,278 L282,278'},
    {id:'ge-be',kind:'model',d:'M280,82 L328,82'},
    {id:'be-ap',kind:'good',d:'M462,92 Q560,100 562,148'}],
  toggles:[{id:'self',label:'Break it: self-critique only (no rule list)',brk:true},{id:'cap',label:'Round cap (3 rounds)',def:true}],
  build(o){
    const G=(n,t)=>({cap:n===1?'The generator writes a first draft.':n===2?'The generator revises, using only the rules that failed.':`Round ${n}: another revision.`,path:['ge-ev'],on:['ge','ev'],tr:[['Draft',`draft ${n}: ${t}`]],call:1,tok:900,ms:1400});
    const V=(n,sc,crit,best,cap)=>({cap,path:['ru-ev','ev-ge'],par:best?['ge-be']:undefined,on:['ev','ru'],tr:[['Score',`draft ${n}: ${sc}/10`],['Critique',crit]],call:1,tok:700,ms:1100,sub:Object.assign({ev:`draft ${n}: ${sc}/10`},best?{be:best}:{})});
    const start={cap:'The task arrives with the facts the letter must include.',path:['of-ge'],on:['ge'],tr:[['Q','Draft a rejection letter for application KF-2291. Reason: EMIs would take 64% of income; our limit is 60%.']],tok:0};
    if(o.self) return [start,G(1,DR[1]),
      {cap:'With no rule list, the model grades its own work by feel, and likes it.',path:['ev-ge'],on:['ev'],sub:{ev:'draft 1: 10/10',ru:'not used'},mark:{ru:'pruned'},tr:[['Score','draft 1: 10/10'],['Critique','clear and polite, no changes needed']],call:1,tok:600,ms:900},
      {cap:'It passes its own check, so it ships straight away.',path:['ge-be','be-ap'],on:['ap'],sub:{be:'draft 1 · 10/10'},tr:[['Answer','Sent draft 1.']],tok:0,ms:10},
      {cap:'Self-critique with no outside signal missed every real problem. Ground the evaluator in rules, tests or a checklist.',on:['ap'],bad:true,tr:[['Error','Compliance audit: 4 of 10 rules failed (reason not plain, no grievance contact, no reapply note, jargon "FOIR")']]}];
    const s=[start,G(1,DR[1]),
      V(1,6,'failed: reason not in plain words · no grievance officer contact · no reapply note · jargon "FOIR"','draft 1 · 6/10','The evaluator checks the draft against the rule list, and names only the rules that failed.'),
      G(2,DR[2]),
      V(2,9,'failed: grievance officer email missing','draft 2 · 9/10','Much better. The best draft so far is stored separately.'),
      G(3,DR[3]),
      V(3,8,'failed: reason no longer stated plainly','','Fixing one rule broke another. Revisions can make a draft worse.')];
    if(o.cap) return s.concat([
      {cap:'The best draft ships, and its one known gap is flagged for a human to fix in a minute.',path:['be-ap'],on:['be','ap'],ok:true,tr:[['Stop','round cap (3) reached'],['Answer','Sent draft 2 (9/10). Grievance email flagged for a quick human edit.']],tok:0,ms:10,
        predict:{q:'Round cap reached. Draft 2 scored 9/10 and draft 3 scored 8/10. Which draft should be sent?',opts:['Draft 3: it is the latest and includes a fix','Draft 2: it has the best score','Neither: keep revising until one scores 10/10'],ok:1,
          why:'Revisions can make things worse. Keep the best-scoring draft, not the last one, and respect the round cap.'}}]);
    for(let n=4;n<=9;n++) s.push(G(n,n%2?'swaps the plain reason back in, drops the email again…':'adds the email back, blurs the reason again…'),V(n,n%2?9:8,n%2?'failed: grievance officer email missing':'failed: reason no longer stated plainly','',`Round ${n}: the score bounces between 8 and 9 and never reaches 10.`));
    return s.concat([{cap:'A token budget finally stops it after 9 rounds, at 3 times the cost, and it still sends draft 2. Unbounded loops burn tokens on marginal gains.',path:['be-ap'],on:['ap'],bad:true,tr:[['Stop','token budget hit after 9 rounds'],['Answer','Sent draft 2 (9/10).']],tok:0,ms:10}]);
  }});

/* ---------- Search-based reasoning: tree of thoughts (Kosh Finance restructuring) ---------- */
const TN=[['A',40,'Extend the tenure','to 60 months'],['B',154,'Switch to secured','lower rate'],['C',268,'Pause EMIs','for 6 months']];
const CH={A:[['A1',6,'60 m at 14%','EMI ₹13,961'],['A2',60,'60 m + ₹50k prepay','needs ₹50k cash'],['A3',114,'48 m at 14%','EMI ₹16,396']],
          B:[['B1',190,'Secured, 48 m','EMI ₹15,507'],['B2',244,'Secured, 60 m, 11%','EMI ₹13,045'],['B3',298,'Gold loan top-up','no gold pledged']]};
SX.add('search',{
  intro:'Kosh Finance restructures a ₹6 lakh loan. Instead of committing to the first idea, the model proposes several, a judge scores them, and the search keeps only the promising branches.',
  note:NOTE+' EMIs are calculated on ₹6 lakh with monthly reducing balance.', rate:0.30, meters:['calls','tok','inr','ms'],
  nodes:[{id:'r',kind:'user',x:6,y:150,w:94,h:60,label:'Borrower',sub:'₹6 lakh loan'},
    ...TN.map(([id,y,l,s])=>({id,kind:'thought',x:150,y,w:150,h:52,label:l,sub:s,hidden:true})),
    ...Object.values(CH).flat().map(([id,y,l,s])=>({id,kind:'thought',x:378,y,w:160,h:46,label:l,sub:s,hidden:true})),
    {id:'lim',kind:'code',x:552,y:150,w:84,h:60,label:'Limits',sub:'EMI ≤ ₹14k'}],
  links:[{id:'r-A',kind:'model',d:'M100,172 Q124,66 148,66',hidden:true},{id:'r-B',kind:'model',d:'M100,180 L148,180',hidden:true},{id:'r-C',kind:'model',d:'M100,188 Q124,294 148,294',hidden:true},
    ...['A','B'].flatMap(p=>CH[p].map(([id,y])=>({id:p+'-'+id,kind:'model',d:`M300,${p==='A'?66:180} Q340,${y+23} 376,${y+23}`,hidden:true})))],
  toggles:[{id:'noisy',label:'Break it: a noisy judge',brk:true}],
  build(o){
    const q={cap:'The goal has hard limits: EMI of ₹14,000 or less, 60 months at most, and as little total interest as possible.',on:['r','lim'],tr:[['Q','Restructure a ₹6 lakh loan: EMI ≤ ₹14,000, tenure ≤ 60 months, lowest total interest.']],tok:0};
    const propose={cap:'Instead of committing to one idea, the model proposes 3 different first steps (k = 3).',par:['r-A','r-B','r-C'],on:['A','B','C'],show:['A','B','C','r-A','r-B','r-C'],tr:[['Branch','A: extend the tenure to 60 months'],['Branch','B: switch to a secured loan at a lower rate'],['Branch','C: pause EMIs for 6 months']],call:1,tok:800,ms:1500};
    const expA={cap:'The search expands branch A into 3 concrete options.',par:CH.A.map(c=>'A-'+c[0]),on:CH.A.map(c=>c[0]),show:CH.A.flatMap(c=>[c[0],'A-'+c[0]]),tr:CH.A.map(c=>['Branch',`${c[0]}: ${c[2]} (${c[3]})`]),call:1,tok:900,ms:1500};
    const expB={cap:'And branch B into 3 more.',par:CH.B.map(c=>'B-'+c[0]),on:CH.B.map(c=>c[0]),show:CH.B.flatMap(c=>[c[0],'B-'+c[0]]),tr:CH.B.map(c=>['Branch',`${c[0]}: ${c[2]} (${c[3]})`]),call:1,tok:900,ms:1500};
    if(!o.noisy) return [q,propose,
      {cap:'A judge scores each partial plan: sure, likely or impossible. Each score is one small model call.',on:['A','B','C'],mark:{A:'likely',B:'likely',C:'bad'},sub:{A:'likely',B:'likely',C:'impossible'},tr:[['Score','A: likely'],['Score','B: likely'],['Score','C: impossible (interest keeps building, EMI rises afterwards)']],call:3,tok:900,ms:1800},
      {cap:'The beam keeps the best 2 branches (b = 2). C is pruned and costs nothing more.',on:['A','B'],mark:{C:'pruned'},tr:[['Prune','C removed · beam keeps the best 2 (b = 2)']],tok:0,ms:10,
        predict:{q:'"Pause EMIs for 6 months" scored impossible. What should the search do with it?',opts:['Expand it anyway, just in case','Prune it and spend no more calls on it','Ask the model to rephrase it and try again'],ok:1,
          why:'Pruning is the point of search: a dead end stops costing money as soon as a good judge spots it.'}},
      expA,expB,
      {cap:'The judge scores all 6. Three break the ₹14,000 limit or the facts, and two are sure.',on:[...CH.A,...CH.B].map(c=>c[0]),mark:{A1:'sure',A2:'likely',A3:'bad',B1:'bad',B2:'sure',B3:'bad'},
        tr:[['Score','A1: sure'],['Score','A2: likely (needs cash the borrower may not have)'],['Score','A3: impossible (EMI above ₹14,000)'],['Score','B1: impossible (EMI above ₹14,000)'],['Score','B2: sure'],['Score','B3: impossible (no gold pledged)']],call:6,tok:1800,ms:2400},
      {cap:'Two sure options survive, and the search picks the cheaper one: 12 model calls for a choice worth ₹54,960 to this borrower.',on:['B2'],mark:{B2:'best'},ok:true,
        tr:[['Answer','Secured loan at 11% over 60 months: EMI ₹13,045, total interest ₹1,82,700. That is ₹54,960 less than option A1.']],tok:0,ms:10}];
    return [q,propose,
      {cap:'This judge guesses. It wrongly marks B impossible and C likely.',on:['A','B','C'],mark:{A:'likely',B:'bad',C:'likely'},sub:{A:'likely',B:'impossible',C:'likely'},tr:[['Score','A: likely'],['Score','B: impossible ("secured loans always cost more")'],['Score','C: likely']],call:3,tok:900,ms:1800},
      {cap:'The beam keeps A and C, and prunes the best branch before anyone looks inside it.',on:['A','C'],mark:{B:'pruned'},tr:[['Prune','B removed · beam keeps A and C']],tok:0,ms:10},
      expA,
      {cap:'Branch C goes nowhere: every option breaks the EMI limit once payments resume. Those calls were wasted.',on:['C'],mark:{C:'bad'},tr:[['Branch','C1–C3: all exceed ₹14,000 after the pause'],['Score','C: impossible']],call:4,tok:2100,ms:2800},
      {cap:'The judge scores A\'s options.',on:CH.A.map(c=>c[0]),mark:{A1:'sure',A2:'likely',A3:'bad'},tr:[['Score','A1: sure'],['Score','A2: likely'],['Score','A3: impossible']],call:3,tok:900,ms:1500},
      {cap:'A noisy judge pruned the best branch. The borrower pays ₹54,960 more interest, and nothing in the output shows it.',on:['A1'],mark:{A1:'best'},bad:true,tr:[['Answer','60 months at 14%: EMI ₹13,961, total interest ₹2,37,660.']],tok:0,ms:10}];
  }});

/* ---------- Reasoning models and thinking budgets (Kosh Finance support) ---------- */
SX.add('reasoning',{
  intro:'Kosh Finance support gets an easy question and a hard one. A small router sets the thinking budget for each before any expensive thinking happens.',
  note:NOTE+' Reasoning-model tokens are priced higher than fast-model tokens.', meters:['calls','tok','inr','ms'], ctx:{max:8000,label:'Thinking tokens, this message'},
  nodes:[
    {id:'cu',kind:'user',x:6,y:150,w:98,h:56,label:'Customers',sub:'2 messages'},
    {id:'ro',kind:'model',x:134,y:150,w:104,h:56,label:'Router',sub:'small model'},
    {id:'fa',kind:'model',x:288,y:48,w:150,h:62,label:'Fast model',sub:'low effort'},
    {id:'th',kind:'model',x:288,y:244,w:150,h:64,label:'Reasoning model',sub:'budget 8,000'},
    {id:'ru',kind:'code',x:470,y:146,w:160,h:64,label:'Budget rule',sub:'easy→low, hard→high'}],
  links:[
    {id:'cu-ro',kind:'user',d:'M104,178 L132,178'},
    {id:'ro-fa',kind:'model',d:'M238,166 Q258,80 286,80'},
    {id:'ro-th',kind:'model',d:'M238,190 Q258,276 286,276'},
    {id:'fa-cu',kind:'good',d:'M288,64 C190,14 56,40 56,148'},
    {id:'th-cu',kind:'good',d:'M288,292 C190,346 56,318 56,208'}],
  toggles:[{id:'max',label:'Break it: maximum budget for every message',brk:true,excl:['tiny']},{id:'tiny',label:'Break it: tiny budget for every message',brk:true,excl:['max']}],
  build(o){
    const F=t=>t/1000*0.05, R=t=>t/1000*0.6;
    const q1={cap:'An easy question arrives first.',path:['cu-ro'],on:['ro'],tr:[['Q','What is my EMI due date?']],ctxSet:0,tok:0};
    const q2={cap:'Then a hard one: several numbers and limits interact.',path:['cu-ro'],on:['ro'],tr:[['Q','Can I prepay ₹2 lakh, move to a 36-month tenure and keep my EMI under ₹15,000?']],ctxSet:0,tok:0};
    const easyOk=[q1,
      {cap:'The router reads the message and sets the effort before any big thinking happens.',path:['ro-fa'],on:['ro','fa'],tr:[['Route','easy → fast model, low effort']],call:1,tok:150,inr:F(150),ms:300},
      {cap:'Easy question, tiny budget: under a second and a fraction of a rupee.',path:['fa-cu'],on:['fa','cu'],tr:[['Answer','Your EMI is due on the 5th of every month.']],ctxSet:120,call:1,tok:300,inr:F(300),ms:700}];
    const easyMax=[q1,
      {cap:'The rule is gone: every message gets the maximum budget.',path:['ro-th'],on:['th'],tr:[['Route','all messages → reasoning model, budget 8,000']],call:1,tok:150,inr:F(150),ms:300},
      {cap:'The reasoning model thinks hard about a one-line lookup.',on:['th'],tr:[['Think','user asks due date · check loan record · consider holidays · grace period · double-check the month…']],ctxSet:4000,call:1,tok:4000,inr:R(4000),ms:6500},
      {cap:'Same one-line answer, but 6.5 seconds and over 100 times the cost.',path:['th-cu'],on:['cu'],tr:[['Answer','Your EMI is due on the 5th of every month.']],ctxSet:4000,tok:100,inr:R(100),ms:400}];
    const hard=[q2,
      {cap:'This one goes to the reasoning model with a high budget.',path:['ro-th'],on:['ro','th'],tr:[['Route','hard → reasoning model, budget 8,000']],call:1,tok:150,inr:F(150),ms:300,
        predict:{q:'Where should the router send this message, and with how much thinking?',opts:['Fast model, low effort: it is just another customer question','Reasoning model with a high budget: several numbers and limits interact','Maximum budget, the same as every other message'],ok:1,
          why:'The budget should follow difficulty. This needs real arithmetic across several limits; the due-date question did not.'}},
      {cap:'The reasoning model spends about 5,200 thinking tokens working through the numbers before it answers.',on:['th'],tr:[['Think','balance after prepayment ₹4,10,000 · 36 months at 14% · apply the EMI formula · compare with ₹15,000…']],ctxSet:5200,call:1,tok:5200,inr:R(5200),ms:8000},
      {cap:'Hard question, big budget, correct answer. The spend follows the difficulty.',path:['th-cu'],on:['cu'],ok:!o.max,bad:!!o.max,tr:[['Answer','Yes. After the ₹2 lakh prepayment your balance is ₹4,10,000; over 36 months at 14% the EMI is ₹14,013, under your ₹15,000 limit.']],ctxSet:5200,tok:150,inr:R(150),ms:500}];
    if(o.max){ hard[1]={cap:'Every message goes to the reasoning model, so this one does too.',path:['ro-th'],on:['ro','th'],tr:[['Route','all messages → reasoning model, budget 8,000']],call:1,tok:150,inr:F(150),ms:300};
      hard[3].cap='Right answer, but look at the total: the easy message cost almost as much as the hard one. Over thousands of mostly easy messages, a fixed maximum budget multiplies the bill.'; return easyMax.concat(hard); }
    if(o.tiny) return easyOk.concat([q2,
      {cap:'Every message gets the fast model and a tiny budget, including this one.',path:['ro-fa'],on:['ro','fa'],tr:[['Route','all messages → fast model, low effort']],call:1,tok:150,inr:F(150),ms:300},
      {cap:'Too little thinking: it divided the balance by 36 and forgot the interest. The real EMI is ₹14,013.',path:['fa-cu'],on:['fa','cu'],bad:true,tr:[['Think','4,10,000 ÷ 36 ≈ 11,389'],['Answer','Yes, your new EMI will be about ₹11,400.']],ctxSet:200,call:1,tok:400,inr:F(400),ms:800}]);
    return easyOk.concat(hard);
  }});
})();

/* ---------- Human-in-the-Loop Checkpoints (KhataPay) ---------- */
(()=>{
const Q='My rent of ₹25,000 was debited twice this morning. Please refund the extra one.';
SX.add('hitl',{
  intro:'KhataPay, a fictional wallet, lets its agent pay refunds up to ₹10,000 on its own. Anything larger pauses for a reviewer. Watch the pause, the saved state and the resume, then switch on <b>Break it</b>.',
  note:'Costs and timings are illustrative, not real prices. All companies and people are fictional.', rate:0.30, meters:['calls','tok','inr','ms'],
  nodes:[
    {id:'cu',kind:'user',x:4,y:150,w:100,h:56,label:'Customer',sub:'duplicate debit'},
    {id:'mo',kind:'model',x:150,y:36,w:122,h:64,label:'Agent',sub:'proposes'},
    {id:'to',kind:'tool',x:334,y:36,w:124,h:64,label:'Payments API',sub:'lookup · refund'},
    {id:'ru',kind:'code',x:150,y:252,w:122,h:56,label:'Approval rule',sub:'> ₹10,000 pauses'},
    {id:'db',kind:'mem',x:334,y:252,w:124,h:56,label:'Saved run',sub:'empty'},
    {id:'hu',kind:'human',x:500,y:150,w:134,h:56,label:'Reviewer',sub:'operations'}],
  links:[
    {id:'cu-mo',kind:'user',d:'M104,166 Q122,78 148,72'},
    {id:'mo-cu',kind:'good',d:'M152,98 Q130,170 106,184'},
    {id:'mo-to',kind:'tool',d:'M272,56 L332,56',label:'action',lx:302,ly:48},
    {id:'to-mo',kind:'mem',d:'M334,84 L274,84',label:'result',lx:304,ly:100},
    {id:'mo-ru',kind:'code',d:'M211,100 L211,250',label:'check',lx:236,ly:180},
    {id:'ru-db',kind:'code',d:'M272,280 L332,280',label:'pause',lx:302,ly:272},
    {id:'db-hu',kind:'mem',d:'M458,270 Q500,256 530,208',label:'card',lx:512,ly:250},
    {id:'hu-mo',kind:'human',d:'M567,150 C567,6 262,4 232,34',label:'decision',lx:440,ly:18}],
  toggles:[{id:'deploy',label:'Break it: a deploy restarts the servers while the run waits',brk:true},{id:'durable',label:'Save paused runs in a database',def:true}],
  build(o){
    const head=[
      {cap:'A customer reports a duplicate debit. The agent may investigate and propose, but it does not decide alone on large refunds.',path:['cu-mo'],on:['mo'],tr:[['Q',Q]],tok:0},
      {cap:'The agent checks the facts first, through the payments API.',path:['mo-to','to-mo'],on:['to','mo'],tr:[['Action','lookup_debits(account="KP-5521", date="today")'],['Observation','2 debits of ₹25,000 to the same landlord, 09:02 and 09:03']],call:1,tok:1400,ms:1600},
      {cap:'It proposes a refund with its reason and evidence. Proposing is not the same as paying.',on:['mo'],tr:[['Thought','Duplicate debit confirmed. Propose refunding ₹25,000.'],['Plan','refund ₹25,000 · ticket T-7731 · evidence: 2 debits, same payee, 1 minute apart']],call:1,tok:1600,ms:1200},
      {cap:'Plain code, not the model, checks the amount against the limit. ₹25,000 is above ₹10,000, so the run must pause.',path:['mo-ru'],on:['ru'],tr:[['Code','amount 25,000 > LIMIT 10,000 → interrupt()']],tok:0,ms:5},
      {cap:o.durable?'The run pauses and its whole state is saved to the database under the ticket id. Nothing waits in memory.':'The run pauses, but its state stays only in the server’s memory.',path:['ru-db'],on:['db'],sub:{db:o.durable?'T-7731 · database':'T-7731 · memory'},tr:[['Stop',o.durable?'run paused · state saved to the database as T-7731':'run paused · state held in server memory']],tok:0,ms:10},
      {cap:'The reviewer gets a card with the action, the reason and the evidence the agent used, not a bare yes or no.',path:['db-hu'],on:['hu'],tr:[['Check','card: refund ₹25,000 to KP-5521 · reason: duplicate debit · evidence: 2 debits 1 minute apart']],tok:0,ms:10}];
    const tail=[
      {cap:'The run continues from the saved step with the decision. Nothing before the pause is repeated, and no model call is needed to resume.',path:['hu-mo'],on:['mo'],tr:[['Result','decision: approve · by R. Menon at 12:05']],tok:0,ms:3*3600000,
        predict:o.deploy?undefined:{q:'The reviewer approves three hours later. What happens to the paused run?',opts:['It starts again from the customer’s message','It resumes from the saved pause with the decision','The agent is asked again whether to refund'],ok:1,
          why:'The saved state holds everything up to the pause, so the run continues from there. Starting over would repeat the lookups and could change the proposal.'}},
      {cap:'Only now does money move, with an idempotency key so a retried call cannot refund twice.',path:['mo-to','to-mo'],on:['to'],tr:[['Action','issue_refund(ticket="T-7731", amount=25000, key="T-7731")'],['Observation','refunded ₹25,000 · reference RF-88120']],call:1,tok:1500,ms:1500},
      {cap:'Done: two model calls before the pause, one after, and a logged decision with the reviewer’s name.',path:['mo-cu'],on:['cu'],ok:true,tr:[['Answer','We have refunded the duplicate ₹25,000. It should reach your account within one working day. Reference RF-88120.']],tok:0,ms:10}];
    if(!o.deploy) return head.concat(tail);
    const dep={cap:'At 11:00, while the run waits, a routine deploy restarts every server.',on:['db'],tr:[['Stop','11:00 deploy: all servers restarted']],tok:0,ms:2*3600000};
    if(o.durable) return head.concat([Object.assign({},dep,{cap:'At 11:00 a routine deploy restarts every server. The paused run is in the database, so nothing is lost.'})],tail.map((x,i)=>i===0?Object.assign({},x,{ms:3600000}):x));
    return head.concat([dep,
      {cap:'The paused run lived only in memory, so the restart wiped it.',on:['db'],sub:{db:'lost'},mark:{db:'bad'},tr:[['Error','run T-7731 not found after restart']],tok:0,ms:10},
      {cap:'At 12:05 the reviewer clicks Approve, and nothing happens.',path:['hu-mo'],on:['hu'],tr:[['Error','resume(T-7731): no saved state']],tok:0,ms:3600000},
      {cap:'Two days later the customer complains again: the refund was never paid. Keep paused runs in a database, and alert on runs paused too long.',on:['cu'],bad:true,tr:[['Error','ticket reopened after 2 days · refund never paid']],tok:0,ms:10}]);
  }});
})();
