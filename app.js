function plan(input){
const v={...input,leverage:100};
const keys=['seed','entry','stop','qtyStep','tick'];
if(!keys.every(k=>Number.isFinite(v[k])&&v[k]>0))throw Error('시드·가격·주문 단위는 양수로 입력하세요.');
if(!(v.p2>0&&v.p2<v.p3&&v.p3<100))throw Error('진입 위치는 0% < 2차 < 3차 < 100%여야 합니다.');
const d=v.position==='long'?1:-1,fi=.0001,fo=.0001,ft=.0001;
if(d*(v.entry-v.stop)<=0)throw Error('롱 손절가는 첫 진입가 아래, 숏 손절가는 첫 진입가 위여야 합니다.');
const snap=x=>Number((Math.round(x/v.tick)*v.tick).toPrecision(14));
if(Math.abs(snap(v.entry)-v.entry)>v.tick*1e-6||Math.abs(snap(v.stop)-v.stop)>v.tick*1e-6)throw Error('진입가·손절가가 가격 단위와 맞지 않습니다. 틱 설정을 조정하세요.');
const prices=[v.entry,snap(v.entry+(v.stop-v.entry)*v.p2/100),snap(v.entry+(v.stop-v.entry)*v.p3/100)];
if(!(d*(prices[0]-prices[1])>0&&d*(prices[1]-prices[2])>0&&d*(prices[2]-v.stop)>0))throw Error('가격 단위 반영 후 진입 가격이 겹칩니다. 간격이나 틱 설정을 조정하세요.');
const rows=prices.map((p,i)=>{const risk=[.01,.02,.02][i]*v.seed,cost=Math.abs(p-v.stop)+p*fi+v.stop*fo;let q=Number((Math.floor(risk/cost/v.qtyStep)*v.qtyStep).toPrecision(14));if(q*cost>risk)q=Number((q-v.qtyStep).toPrecision(14));if(!(q>0))throw Error((i+1)+'차 수량이 최소 수량 단위보다 작습니다. 시드나 수량 단위를 확인하세요.');const fees=q*(p*fi+v.stop*fo);return {p,q,loss:q*cost,fees,margin:p*q/100+p*q*.0002};});
function aggregate(n){const r=rows.slice(0,n),q=r.reduce((s,x)=>s+x.q,0),notional=r.reduce((s,x)=>s+x.p*x.q,0),avg=notional/q,loss=r.reduce((s,x)=>s+x.loss,0),fees=r.reduce((s,x)=>s+x.fees,0);return {q,avg,loss,fees,targets:[2,3,5].map(rr=>{const raw=(rr*loss/q+d*avg+avg*fi)/(d-ft);if(!(raw>0))return {rr,p:null,net:null};const p=Number(((d===1?Math.ceil(raw/v.tick):Math.floor(raw/v.tick))*v.tick).toPrecision(14));if(!(p>0))return {rr,p:null,net:null};const fees=q*(avg*fi+p*ft),net=q*d*(p-avg)-fees;return {rr,p,net,fees};})};}
return {rows,aggregate,total:aggregate(3),margin:rows.reduce((s,x)=>s+x.margin,0)};
}

const ids=['seed','position','entry','stop','qtyStep','tick','p2','p3'],el=id=>document.getElementById(id),fmt=(x,n=8)=>new Intl.NumberFormat('ko-KR',{maximumFractionDigits:n}).format(x);
function syncDirection(){document.querySelectorAll('[data-value]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.value===el('position').value)));}
function render(){syncDirection();try{const v=Object.fromEntries(ids.map(k=>[k,k==='position'?el(k).value:Number(el(k).value)]));if(ids.some(k=>el(k).value===''))throw Error('시드·진입가·손절가와 설정값을 모두 입력해 주세요.');v.leverage=100;const a=plan(v),s=a.aggregate(Number(el('filled').value));el('error').hidden=true;el('empty').hidden=true;el('results').hidden=false;
el('direction').textContent=v.position==='long'?'↗ 롱 · 하락 시 분할':'↘ 숏 · 상승 시 분할';
el('orders').innerHTML=a.rows.map((r,i)=>`<article class="order"><div class="order-head"><b>0${i+1} <span style="font-weight:400">진입</span></b><span class="badge">손실 ${i===0?1:2}%</span></div><div><span class="metric-label">진입가 · USDT</span><div class="price">${fmt(r.p)}</div></div><div class="order-sub"><span>주문 수량</span><strong>${fmt(r.q,12)}</strong></div><div class="order-loss"><span>실질 손절 손실</span><b>${fmt(r.loss,4)} USDT</b></div></article>`).join('');
el('riskBudget').textContent='−'+fmt(v.seed*.05,4)+' USDT';el('stopValue').innerHTML=fmt(v.stop)+'<small>USDT</small>';el('totalLoss').textContent='−'+fmt(a.total.loss,4)+' USDT';el('lossRate').textContent='시드의 '+fmt(a.total.loss/v.seed*100,4)+'%';el('average').textContent=fmt(a.total.avg,4);el('quantity').textContent=fmt(a.total.q,12);el('margin').textContent=fmt(a.margin,2)+' USDT / '+fmt(v.leverage)+'배';
const floating=a.rows.reduce((sum,r)=>sum+Math.abs(r.p-a.rows[2].p)*r.q,0);el('warning').hidden=a.margin+floating<=v.seed;el('warning').textContent='시드 대비 증거금·평가손실 부담이 큽니다. 실제 주문 가능액과 청산가를 확인하세요.';
el('stage').textContent='평균가 '+fmt(s.avg,4)+' · 예상 손실 '+fmt(s.loss,4)+' USDT';el('targets').innerHTML=s.targets.map(t=>`<article class="target ${t.rr===2?'featured':''}"><div class="target-head">1 : ${t.rr}</div><div><span class="metric-label">목표가 · USDT</span><b class="target-price">${t.p===null?'도달 불가':fmt(t.p)}</b></div><div><span class="metric-label">예상 순수익</span><strong class="profit">${t.net===null?'—':'+'+fmt(t.net,2)}</strong><span class="profit-unit">USDT</span></div></article>`).join('');
}catch(e){el('results').hidden=true;el('empty').hidden=false;el('error').hidden=false;el('error').textContent=e.message;}}
function example(){const v={seed:1000,position:'long',entry:100000,stop:97000,qtyStep:0.0001,tick:0.1,p2:100/3,p3:200/3};ids.forEach(k=>el(k).value=v[k]);render();}
ids.concat('filled').forEach(id=>el(id).addEventListener('input',render));el('example').addEventListener('click',example);el('emptyExample').addEventListener('click',example);document.querySelectorAll('[data-value]').forEach(b=>b.addEventListener('click',()=>{el('position').value=b.dataset.value;if(el('entry').value||el('stop').value)render();else syncDirection();}));
