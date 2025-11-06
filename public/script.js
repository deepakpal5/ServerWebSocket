const select=document.getElementById('endpointSelect');
const msgInput=document.getElementById('msgInput');
const sendBtn=document.getElementById('sendBtn');
const feedTitle=document.getElementById('feedTitle');
const clearBtn=document.getElementById('clearBtn');
// const messagesEl=document.getElementById('messages');
let history=new Map(),ws,endpoints=[],selected=null;

function ensureEndpoint(n){if(!history.has(n))history.set(n,[]);}
function renderSelect(list){
  endpoints=Array.isArray(list)?list.slice():[];
  select.innerHTML='';
  endpoints.forEach(name=>{
    const opt=document.createElement('option');
    opt.value=name; opt.textContent=`🔴 ${name}`; select.appendChild(opt);
    ensureEndpoint(name);
  });
  select.disabled=false;
  selected=endpoints[0]||null;
  if(selected)select.value=selected;
  feedTitle.querySelector('.meta').textContent=selected||'—';
}

function appendToHistory(endpoint,text){
  ensureEndpoint(endpoint);
  const arr=history.get(endpoint);
  arr.push({text,ts:new Date().toISOString(),endpoint});
  renderNewMessage({text,ts:new Date().toISOString(),endpoint});
}

function renderNewMessage(item){
  if(item.endpoint!==selected){updateGauges(0,0);return;}
  let data=item.text;
  if(typeof data==='string'&&(data.startsWith('{')||data.startsWith('['))){
    try{data=JSON.parse(data);}catch{}
  }
  if(data.voltage!==undefined&&data.current!==undefined){
    updateGauges(data.voltage,data.current);
  }
}

function sendMessage(){
  const text=msgInput.value.trim(); if(!text||!selected)return;
  if(ws&&ws.readyState===WebSocket.OPEN){
    ws.send(JSON.stringify({command:text,endpoint:selected}));
    appendToHistory(selected,"→ "+text);
  }else appendToHistory(selected,"⚠️ WebSocket not connected");
  msgInput.value='';
}

function updateGauges(v,c){
  const max=420;
  document.getElementById('voltageArc').setAttribute('stroke-dasharray',`${Math.min(v/max,1)*100},100`);
  document.getElementById('voltageLabel').textContent=v.toFixed(1)+'V';
  document.getElementById('currentArc').setAttribute('stroke-dasharray',`${Math.min(c/max,1)*100},100`);
  document.getElementById('currentLabel').textContent=c.toFixed(1)+'A';
}

// function clearFeed(){messagesEl.innerHTML='<div class="empty">Feed cleared</div>'; history.clear();}
select.addEventListener('change',()=>{selected=select.value;feedTitle.querySelector('.meta').textContent=selected;});
sendBtn.addEventListener('click',sendMessage);
msgInput.addEventListener('keypress',e=>{if(e.key==='Enter')sendMessage();});
// clearBtn.addEventListener('click',clearFeed);

['change','power','reset','menu'].forEach(cmd=>{
  document.getElementById(cmd+'Btn').addEventListener('click',()=>{
    if(ws&&ws.readyState===WebSocket.OPEN&&selected){
      ws.send(JSON.stringify({command:cmd,endpoint:selected}));
    }
    appendToHistory(selected||'system',`🔘 ${cmd}`);
  });
});

function openWS(){
  const url=(location.origin.replace(/^http/,'ws'));
  ws=new WebSocket(url);
  ws.onopen=()=>console.log('🟢 Connected');
  ws.onclose=()=>setTimeout(openWS,3000);
  ws.onmessage=e=>{
    try{
      const obj=JSON.parse(e.data);
      if(obj.type==="status"&&Array.isArray(obj.data)){
        Array.from(select.options).forEach(opt=>{
          const ep=obj.data.find(e=>e.endpoint===opt.value);
          opt.textContent=`${ep?.online?"🟢":"🔴"} ${opt.value}`;
        });
        return;
      }
      if(obj.endpoint&&"body" in obj){
        appendToHistory(obj.endpoint,obj.body); return;
      }
    }catch(err){console.error("Parse error:",err);}
  }
}

fetch('/endpoints').then(r=>r.json()).then(list=>{
  renderSelect(list); openWS();
}).catch(()=>{renderSelect([]); openWS();});
