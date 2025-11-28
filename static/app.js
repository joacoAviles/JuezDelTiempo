let timerInterval=null;
let startTs=startTimestamp;
let elapsedOffset=elapsedAtLoad;

function format(sec){const h=Math.floor(sec/3600),m=Math.floor((sec%3600)/60),s=sec%60;
const pad=n=>n.toString().padStart(2,'0');return `${pad(h)}:${pad(m)}:${pad(s)}`;}

function updateTimer(){
 if(startTs==null){document.getElementById("real-time").innerText="00:00:00";
 document.getElementById("progress-label").innerText="0%";
 document.getElementById("progress-fill").style.width="0%";return;}
 const now=Math.floor(Date.now()/1000);
 const elapsed=elapsedOffset+(now-startTs);
 document.getElementById("real-time").innerText=format(elapsed);
 const est=estimatedMinutes*60;
 let p=est?Math.min(100,Math.round((elapsed/est)*100)):0;
 document.getElementById("progress-label").innerText=p+"%";
 document.getElementById("progress-fill").style.width=p+"%";
}

function startTimer(){if(!timerInterval){timerInterval=setInterval(updateTimer,1000);updateTimer();}}

async function startEvent(){
 const r=await fetch("/start",{method:"POST"});
 const d=await r.json();startTs=d.start_timestamp;elapsedOffset=0;
 clearInterval(timerInterval);timerInterval=null;startTimer();
}

async function stopEvent(){await fetch("/stop",{method:"POST"});window.location.reload();}

if(startTs!==null)startTimer();
