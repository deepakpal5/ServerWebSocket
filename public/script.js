let history = new Map(), ws, endpoints = [], selected = null;

const select = document.getElementById('endpointSelect');
const feedTitle = document.getElementById('feedTitle');
const msgInput = document.getElementById('msgInput');
const sendBtn = document.getElementById('sendBtn');
const clearBtn = document.getElementById('clearBtn');
const messagesEl = document.getElementById('messages');

// --- Helpers ---
function ensureEndpoint(name) {
  if (!history.has(name)) history.set(name, []);
}

// function appendToHistory(endpoint, text) {
//   ensureEndpoint(endpoint);
//   const msg = { text, ts: new Date().toISOString(), endpoint };
//   history.get(endpoint).push(msg);
//   renderNewMessage(msg);
// }

// function renderNewMessage(item) {
//   // Create message element
//   const div = document.createElement('div');
//   div.className = 'message';
//   div.innerHTML = `<span class="time">${new Date(item.ts).toLocaleTimeString()}</span>
//                    <span class="endpoint">${item.endpoint}</span>
//                    <span class="text">${item.text}</span>`;
//   if(messagesEl.querySelector('.empty')) messagesEl.innerHTML = '';
//   messagesEl.appendChild(div);
//   messagesEl.scrollTop = messagesEl.scrollHeight;

//   // Update gauges if the message is from selected endpoint
//   if (item.endpoint === selected) {
//     let data = item.text;
//     if (typeof data === 'string' && (data.startsWith('{') || data.startsWith('['))) {
//       try { data = JSON.parse(data); } catch {}
//     }
//     if(data.voltage !== undefined && data.current !== undefined) {
//       updateGauges(data.voltage, data.current);
//     }
//   }
// }

function sendMessage() {
  const text = msgInput.value.trim();
  if (!text || !selected) return;

  if (ws && ws.readyState === WebSocket.OPEN) {
    console.log("Sending message:", text, "to", selected);
    ws.send(JSON.stringify({ command: text, endpoint: selected }));
    // appendToHistory(selected, "→ " + text);
  } 
  // else {
  //   appendToHistory(selected, "⚠️ WebSocket not connected");
  // }

  msgInput.value = '';
}

function renderSelect(list) {
  select.innerHTML = '';
  list.forEach(name => {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = `🔴 ${name}`;
    select.appendChild(opt);
    ensureEndpoint(name);
  });
  select.disabled = false;
  selected = list[0] || null;
  if(selected) select.value = selected;
  feedTitle.querySelector('.meta').textContent = selected || '—';
}

// --- Event listeners ---
select.addEventListener('change', ()=> {
  selected = select.value;
  feedTitle.querySelector('.meta').textContent = selected;
});

sendBtn.addEventListener('click', sendMessage);
msgInput.addEventListener('keypress', e => { if(e.key==='Enter') sendMessage(); });

clearBtn.addEventListener('click', ()=> {
  messagesEl.innerHTML = '<div class="empty">Feed cleared</div>';
  history.clear();
});

['CHANGE','POWER','RESET','MENU'].forEach(cmd=>{
  const btn = document.getElementById(cmd+'Btn');
  if(btn) btn.addEventListener('click', ()=> {
    if(ws && ws.readyState === WebSocket.OPEN && selected){
      console.log("Sending message:", cmd, "to", selected); // <- changed 'text' to 'cmd'
      ws.send(JSON.stringify({ command: cmd, endpoint: selected }));
    }
  });
});


// --- WebSocket ---
function openWS(){
  const url = location.origin.replace(/^http/,'ws');
  ws = new WebSocket(url);

  ws.onopen = ()=> console.log('🟢 Connected');
  ws.onclose = ()=> setTimeout(openWS,3000);

  ws.onmessage = e => {
    try{
      const obj = JSON.parse(e.data);
      // console.log('⬅️', obj);

      if(obj.type==="status" && Array.isArray(obj.data)){
        Array.from(select.options).forEach(opt => {
          const ep = obj.data.find(e=>e.endpoint===opt.value);
          opt.textContent = `${ep?.online?"🟢":"🔴"} ${opt.value}`;
        });
        return;
      }

      if(obj.endpoint && obj.body){
        const data = typeof obj.body === "string" ? JSON.parse(obj.body) : obj.body;
        // console.log("Data received for", obj.endpoint, data);
        updateUI(data);
      }
    }catch(err){
      console.error("Parse error:", err);
    }
  }
}




let pvCurrent = 0; // store previous value for animation

function updateSolarGauge(value) {
  const pvArc = document.getElementById("pvArc");
  const pvLabel = document.getElementById("pvLabel");

  // Handle missing / invalid data
  if (value == null || isNaN(value)) {
    pvArc.setAttribute("class", "fg inactive");
    pvArc.setAttribute("stroke-dasharray", "0,100");
    pvLabel.textContent = "-- Volt";
    pvLabel.style.fill = "#999";
    pvCurrent = 0;
    return;
  }

  // Clamp value (for example, assume max 24V)
  const maxVolt = 24;
  const newPercent = Math.min((value / maxVolt) * 100, 100);

  pvArc.setAttribute("class", "fg active");
  pvLabel.style.fill = "#00b894";

  // Animate from old → new
  const duration = 800; // ms
  const start = pvCurrent;
  const end = newPercent;
  const startTime = performance.now();

  function animateGauge(now) {
    const progress = Math.min((now - startTime) / duration, 1);
    const eased = start + (end - start) * progress;
    pvArc.setAttribute("stroke-dasharray", `${eased.toFixed(1)},100`);
    pvLabel.textContent = `${value.toFixed(1)} Volt`;

    if (progress < 1) {
      requestAnimationFrame(animateGauge);
    } else {
      pvCurrent = end;
    }
  }

  requestAnimationFrame(animateGauge);
}












// --- Existing UI update ---
function updateUI(data){
  // document.getElementById("pvLabel").textContent = (data.Solar_Volt) + "Volt";
  // document.getElementById("pvArc").setAttribute("stroke-dasharray", `${data.Solar_Volt},400`);




  updateSolarGauge(parseFloat(data.Solar_Volt));

  document.getElementById("inputVoltBar").style.width = (data.Input_VOLT/240*100) + "%";
  document.getElementById("inputVoltLabel").textContent = data.Input_VOLT + "V";

  document.getElementById("inputFreqBar").style.width = (data.Input_FREQ/60*100) + "%";
  document.getElementById("inputFreqLabel").textContent = data.Input_FREQ + "Hz";

  document.getElementById("outVoltBar").style.width = (data.Output_VOLT/240*100) + "%";
  document.getElementById("outVoltLabel").textContent = data.Output_VOLT + "V";


  document.getElementById("outputFreqBar").style.width = (data.Output_FREQ/60*100) + "%";
  document.getElementById("outputFreqLabel").textContent = data.Output_FREQ + "Hz";


  


  document.getElementById("battVoltBar").style.width = (data.Batt_VOLT/65*100) + "%";
  document.getElementById("battVolt").textContent = data.Batt_VOLT + " Volt";

  document.getElementById("battCurrBar").style.width = (data.Charge_CURR/65*100) + "%";
  document.getElementById("battCurr").textContent = data.Charge_CURR + " Amp";



  document.getElementById("inputFreqBar").style.width = (data.Input_FREQ/60*100) + "%";
  document.getElementById("inputFreqLabel").textContent = data.Input_FREQ + "Hz";





document.getElementById("solarMode").textContent = data.Solar_Mode;
document.getElementById("pcuSwitch").textContent = data.PCU_Switch;


  document.querySelectorAll("#loadBars .bar").forEach(bar=>{
    bar.style.height = (Math.random()*data.Output_LOAD) + "%";
  });
  document.getElementById("outLoadLabel").textContent = data.Output_LOAD + "%";

  const batteryEl = document.getElementById("battCharge").parentElement; // .battery container



document.getElementById("battCharge").style.width = Math.min(parseFloat(data.Battery_Connect)/14*100,100) + "%";



document.getElementById("battVoltLabel").textContent = data.Battery_Connect;
document.getElementById("battStatus").textContent = data.Battery_Status;

// Animate if charging
if(data.Battery_Status.toLowerCase() === "charging"){
  batteryEl.classList.add("charge-anim");
} else {
  batteryEl.classList.remove("charge-anim");
}

  document.getElementById("chargeMode").textContent = data.Charging_Mode;
  document.getElementById("battType").textContent =   data.Battery_Type;
  document.getElementById("loadSource").textContent = data.Load_Source;
  document.getElementById("gridCharge").textContent = data.Grid_Charging;
  document.getElementById("upsMode").textContent =    data.UPS_Mode;
  document.getElementById("lcdUpper").textContent =   data.Upper;
  document.getElementById("lcdLower").textContent =   data.Lower;



const pvStatusEl = document.getElementById("pvStatus");
if(data.PVA){
  pvStatusEl.textContent = "Available";
  pvStatusEl.style.color = "green";
} else if(data.PVR){
  pvStatusEl.textContent = "Reverse!";
  pvStatusEl.style.color = "red";
} else {
  pvStatusEl.textContent = "Not Available";
  pvStatusEl.style.color = "orange";
}
const mainEl = document.getElementById("mainStatus");
mainEl.textContent = data.Mains;
switch(data.Mains){
  case "ON": mainEl.style.color = "green"; break;
  case "OFF": mainEl.style.color = "red"; break;
  case "CUT": mainEl.style.color = "orange"; break;
}


  const faultEl = document.getElementById("faultMsg");
  if(data.Error_Fault && data.Error_Fault.trim() !== ""){
    faultEl.textContent = data.Error_Fault;
    faultEl.className = "fault";
  } else {
    faultEl.textContent = "No Faults";
    faultEl.className = "";
  }

  document.getElementById("timestamp").textContent = "Last updated: " + new Date().toLocaleTimeString();
}

// --- Initialize ---
fetch('/endpoints')
  .then(r=>r.json())
  .then(list => { renderSelect(list); openWS(); })
  .catch(()=> { renderSelect([]); openWS(); });
