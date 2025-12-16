let history = new Map(), ws, endpoints = [], selected = null;

const select = document.getElementById('endpointSelect');
const feedTitle = document.getElementById('feedTitle');

function ensureEndpoint(name) {
  if (!history.has(name)) history.set(name, []);
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




['CHANGE', 'POWER', 'RESET', 'MENU'].forEach(cmd => {
  const btn = document.getElementById(cmd + 'Btn');
  if (!btn) return;

  btn.addEventListener('click', () => {
    if (!ws || ws.readyState !== WebSocket.OPEN || !selected) return;

    const payload = {
      Status: true,
      Command: cmd
    };

    console.log("📤 Dashboard sending:", payload);

    ws.send(JSON.stringify({
      endpoint: selected,
      command: JSON.stringify(payload)  
    }));
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




function updateSolarGauge( value) {
    

    const angle = ( value/ 30) * 360;
    const gauge = document.getElementById("SolarAnglegauge");
    const valueText = document.getElementById("SolarTextgaugeValue");
    gauge.style.background = `conic-gradient(#00b894 ${angle}deg, #ddd ${angle}deg)`;
    valueText.textContent = value + " Amp";
  }

function updateLOADGauge( value) {
    const angle = ( value/ 120) * 360;
    const gauge = document.getElementById("loadAnglegauge");
    const valueText = document.getElementById("loadTextgaugeValue");

   
    gauge.style.background = `conic-gradient(#00b894 ${angle}deg, #ddd ${angle}deg)`;

  
    valueText.textContent = value + " %";

  

  }


function updateUI(data){



updateLOADGauge(data.Output_LOAD)


  updateSolarGauge(parseFloat(data.Solar_Current));

  document.getElementById("inputVoltBar").style.width = (data.Input_VOLT/340*100) + "%";
  document.getElementById("inputVoltLabel").textContent = data.Input_VOLT + "V";

  document.getElementById("inputFreqBar").style.width = (data.Input_FREQ/60*100) + "%";
  document.getElementById("inputFreqLabel").textContent = data.Input_FREQ + "Hz";

  document.getElementById("outVoltBar").style.width = (data.Output_VOLT/340*100) + "%";
  document.getElementById("outVoltLabel").textContent = data.Output_VOLT + "V";


  document.getElementById("outputFreqBar").style.width = (data.Output_FREQ/70*100) + "%";
  document.getElementById("outputFreqLabel").textContent = data.Output_FREQ + "Hz";


  


  document.getElementById("battVoltBar").style.width = (data.Batt_VOLT/70*100) + "%";
  document.getElementById("battVolt").textContent = data.Batt_VOLT + " Volt";

  document.getElementById("battCurrBar").style.width = (data.Charge_CURR/70*100) + "%";
  document.getElementById("battCurr").textContent = data.Charge_CURR + " Amp";



  document.getElementById("inputFreqBar").style.width = (data.Input_FREQ/70*100) + "%";
  document.getElementById("inputFreqLabel").textContent = data.Input_FREQ + "Hz";





document.getElementById("solarMode").textContent = data.Solar_Mode;
document.getElementById("pcuSwitch").textContent = data.PCU_Switch;




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
  pvStatusEl.textContent = "Unavailable";
  pvStatusEl.style.color = "red";
} 

else if (!data.PVR) {
  pvStatusEl.textContent = "Reverse Polarity";
  pvStatusEl.style.color = "red";
}

else {
  pvStatusEl.textContent = "ok";
  pvStatusEl.style.color = "green";
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
