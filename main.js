import{db}from"./firebase.js";import{ref,push,set,update,remove,onChildAdded,onValue,query,limitToLast}from"https://www.gstatic.com/firebasejs/13.0.0/firebase-database.js";

const profiles={
  "2025":{name:"EFFAT",welcome:"Welcome, Effat.",sub:"TwoTalk · Effat's space",headline:"Welcome, Effat.",tagline:"Your chat is ready.", avatarKey:"iffat"},
  "1971":{name:"JUNAID",welcome:"Welcome, Junaid.",sub:"TwoTalk · Junaid's space",headline:"Welcome, Junaid.",tagline:"Your chat is ready.", avatarKey:"junaid"}
};

const ADMIN="19999";
let pin="",stop=null,current=null, typingTimeout=null;
const $=id=>document.getElementById(id);

function dots(){[...$("dots").children].forEach((x,i)=>x.classList.toggle("on",i<pin.length))}

function updateAvatar(avatarKey){
  const avatarImg = $("avatarImg");
  const avatarEmoji = $("avatarEmoji");
  if(!avatarImg || !avatarEmoji) return;

  if(avatarKey === "iffat"){
    avatarImg.src = "./iffat.png";
    avatarImg.style.display = "block";
    avatarEmoji.style.display = "none";
  } else if(avatarKey === "junaid"){
    avatarImg.src = "./junaid.png";
    avatarImg.style.display = "block";
    avatarEmoji.style.display = "none";
  } else {
    avatarImg.style.display = "none";
    avatarEmoji.style.display = "block";
  }
}

function openChat(){
  current=profiles[pin];
  $("welcome").textContent=current.welcome;
  $("sub").textContent=current.sub;
  if($("headline")) $("headline").textContent=current.headline;
  if($("tagline")) $("tagline").textContent=current.tagline;
  
  updateAvatar(current.avatarKey);

  $("gate").classList.add("hidden");
  $("chat").classList.remove("hidden");
  pin="";
  dots();
  startChat();
  setupTypingAndSeen();
}

function openAdmin(){
  pin="";
  dots();
  updateAvatar("admin");
  $("gate").classList.add("hidden");
  $("admin").classList.remove("hidden");
  startAdmin();
}

function check(){
  if(pin.length!==4&&pin!==ADMIN)return;
  if(profiles[pin])openChat();
  else if(pin===ADMIN)openAdmin();
  else{
    $("pinStatus").textContent="That code doesn't open this room."; 
    $("pinStatus").classList.add("error");
    pin="";
    dots();
    setTimeout(()=>{$("pinStatus").textContent="your little code opens the door";$("pinStatus").classList.remove("error")},1200);
  }
}

document.querySelectorAll("[data-n]").forEach(b=>b.onclick=()=>{if(pin.length<5){pin+=b.dataset.n;dots();if((pin.length===4&&profiles[pin])||pin.length===5)setTimeout(check,120)}});
$("erase").onclick=()=>{pin=pin.slice(0,-1);dots()};

document.addEventListener("keydown",e=>{
  if($("gate").classList.contains("hidden"))return;
  if(/^[0-9]$/.test(e.key)&&pin.length<5){
    pin+=e.key;
    dots();
    if((pin.length===4&&profiles[pin])||pin.length===5)setTimeout(check,120);
  }
  if(e.key==="Backspace"){pin=pin.slice(0,-1);dots()}
});

function esc(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}

function render(m,k){
  const box=$("messages");
  if(box.querySelector(`[data-id="${CSS.escape(k)}"]`)){
    // যদি মেসেজ অলরেডি থাকে, স্ট্যাটাস আপডেট হ্যান্ডেল করা
    const existing = box.querySelector(`[data-id="${CSS.escape(k)}"]`);
    const statusEl = existing.querySelector(".msg-status");
    if(statusEl) statusEl.textContent = m.status === "seen" ? "Seen ✓✓" : "Sent ✓";
    return;
  }
  box.querySelector(".loading,.empty")?.remove();
  
  const el=document.createElement("article");
  const mine=m.name===current?.name;
  el.className="message"+(mine?" mine":"");
  el.dataset.id=k;
  
  const t=m.createdAt?new Date(m.createdAt).toLocaleTimeString([],{hour:"numeric",minute:"2-digit"}):"now";
  const statusText = mine ? `<span class="msg-status">${m.status === "seen" ? "Seen ✓✓" : "Sent ✓"}</span>` : "";
  
  el.innerHTML=`<div class="meta">${esc(m.name||"Guest")} · ${t} ${statusText}</div><div class="bubble">${esc(m.text)}</div>`;
  box.appendChild(el);
  box.scrollTop=box.scrollHeight;
}

function startChat(){
  stop?.();
  $("messages").innerHTML='<div class="loading">🧸<small>getting the chat ready…</small></div>';
  
  stop=onChildAdded(query(ref(db,"messages"),limitToLast(200)),s=>{
    const m=s.val();
    if(m?.text){
      render(m,s.key);
      // যদি মেসেজটি অন্য ইউজারের হয়, তবে চ্যাটে ঢোকার সাথে সাথে এটিকে 'seen' করে দেবো
      if(m.name !== current.name && m.status !== "seen"){
        update(ref(db,"messages/"+s.key), { status: "seen" });
      }
    }
  },e=>{
    $("messages").innerHTML=`<div class="empty">☹<b>Could not load messages</b><small>${esc(e.message)}</small></div>`;
  });

  // রিয়েলটাইমে মেসেজ স্ট্যাটাস পরিবর্তনের আপডেট শোনা
  onValue(ref(db,"messages"), snap => {
    snap.forEach(child => {
      const m = child.val();
      const el = $("messages").querySelector(`[data-id="${CSS.escape(child.key)}"]`);
      if(el){
        const statusEl = el.querySelector(".msg-status");
        if(statusEl){
          statusEl.textContent = m.status === "seen" ? "Seen ✓✓" : "Sent ✓";
        }
      }
    });
  });
}

// --- টাইপিং ও সিন (Seen) সিস্টেম লজিক ---
function setupTypingAndSeen(){
  const input = $("text");
  const typingIndicator = $("typingIndicator");
  const typingText = $("typingText");

  // কে টাইপ করছে তার অপজিট ইউজার কে তা বের করা
  const otherUserName = current.name === "EFFAT" ? "JUNAID" : "EFFAT";

  // ইনপুটে লিখলে ফায়ারবেসে typing status true করা
  input.oninput = () => {
    set(ref(db, "typing/" + current.name), true);
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
      set(ref(db, "typing/" + current.name), false);
    }, 1500);
  };

  // বিপরীত ইউজারের টাইপিং স্ট্যাটাস লাইভ ট্র্যাক করা
  onValue(ref(db, "typing/" + otherUserName), snap => {
    const isTyping = snap.val();
    if(isTyping){
      typingText.textContent = otherUserName.toLowerCase() + " is typing...";
      typingIndicator.classList.remove("hidden");
    } else {
      typingIndicator.classList.add("hidden");
    }
  });
}

$("form").onsubmit=async e=>{
  e.preventDefault();
  const text=$("text").value.trim();
  if(!text)return;
  const send=$("send"),form=$("form");
  send.disabled=true;
  form.classList.add("sending");
  
  // টাইপিং বন্ধ করা সাবমিট করার সময়
  set(ref(db, "typing/" + current.name), false);

  try{
    await set(push(ref(db,"messages")),{
      name: current.name,
      text: text,
      createdAt: Date.now(),
      status: "sent" // নতুন মেসেজ পাঠানোর সময় ডিফল্ট স্ট্যাটাস Sent থাকবে
    });
    $("text").value="";
    $("text").focus();
    burst(send);
  }catch(err){
    alert("Message could not be sent: "+err.message);
  }finally{
    setTimeout(()=>form.classList.remove("sending"),450);
    send.disabled=false;
  }
};

function burst(btn){
  for(let i=0;i<3;i++){
    const s=document.createElement("span");
    s.className="send-burst";
    s.textContent=i===1?"♡":"✦";
    s.style.right=(12+i*8)+"px";
    s.style.bottom="42px";
    $("form").appendChild(s);
    setTimeout(()=>s.remove(),600);
  }
}

function closeAll(){
  stop?.();
  stop=null;
  if(current){
    set(ref(db, "typing/" + current.name), false);
  }
  current=null;
  $("chat").classList.add("hidden");
  $("admin").classList.add("hidden");
  $("gate").classList.remove("hidden");
  pin="";
  dots();
}

$("lock").onclick=closeAll;
$("adminLock").onclick=closeAll;

function startAdmin(){
  onValue(query(ref(db,"messages"),limitToLast(500)),snap=>{
    const box=$("adminMessages");
    box.innerHTML="";
    let n=0;
    snap.forEach(ch=>{
      n++;
      const m=ch.val();
      const row=document.createElement("div");
      row.className="admin-row";
      row.dataset.id=ch.key;
      row.innerHTML=`<div><div class="who">${esc(m.name||"Guest")} · ${m.createdAt?new Date(m.createdAt).toLocaleString():""}</div><div class="txt">${esc(m.text||"")}</div><div class="editbox hidden"><input value="${esc(m.text||"")}"><button data-save>Save</button></div></div><div class="admin-actions"><button data-edit>Edit</button><button class="danger" data-delete>Delete</button></div>`;
      box.appendChild(row);
    });
    $("adminCount").textContent=n+" message"+(n===1?"":"s");
    
    box.querySelectorAll("[data-delete]").forEach(b=>b.onclick=async()=>{
      if(confirm("Delete this message?")) await remove(ref(db,"messages/"+b.closest(".admin-row").dataset.id));
    });
    box.querySelectorAll("[data-edit]").forEach(b=>b.onclick=()=>{
      const r=b.closest(".admin-row");
      r.querySelector(".editbox").classList.toggle("hidden");
    });
    box.querySelectorAll("[data-save]").forEach(b=>b.onclick=async()=>{
      const r=b.closest(".admin-row");
      const value=r.querySelector("input").value.trim();
      if(value) await update(ref(db,"messages/"+r.dataset.id),{text:value});
    });
  });
}
