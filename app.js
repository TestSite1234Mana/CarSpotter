const DB_NAME="CarSpotterDB", STORE="cars", DB_VERSION=1;
let db, cars=[], currentDetailId=null, currentPhoto=null;

const $=id=>document.getElementById(id);
const today=()=>new Date().toISOString().slice(0,10);

function openDB(){
  return new Promise((resolve,reject)=>{
    const req=indexedDB.open(DB_NAME,DB_VERSION);
    req.onupgradeneeded=e=>{const d=e.target.result;if(!d.objectStoreNames.contains(STORE))d.createObjectStore(STORE,{keyPath:"id"});};
    req.onsuccess=e=>{db=e.target.result;resolve(db)};
    req.onerror=()=>reject(req.error);
  });
}
function tx(mode="readonly"){return db.transaction(STORE,mode).objectStore(STORE)}
function getAll(){return new Promise((res,rej)=>{const r=tx().getAll();r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})}
function put(car){return new Promise((res,rej)=>{const r=tx("readwrite").put(car);r.onsuccess=res;r.onerror=()=>rej(r.error)})}
function remove(id){return new Promise((res,rej)=>{const r=tx("readwrite").delete(id);r.onsuccess=res;r.onerror=()=>rej(r.error)})}
function clearDB(){return new Promise((res,rej)=>{const r=tx("readwrite").clear();r.onsuccess=res;r.onerror=()=>rej(r.error)})}

function showPage(id){
  document.querySelectorAll(".page").forEach(p=>p.classList.add("hidden"));
  $(id).classList.remove("hidden");
  document.querySelectorAll(".nav-btn").forEach(b=>b.classList.toggle("active",b.dataset.page===id));
  if(id==="statsPage")renderStats();
}

function openModal(car=null){
  $("carForm").reset(); currentPhoto=car?.image||null;
  $("carId").value=car?.id||"";
  $("make").value=car?.make||"";
  $("model").value=car?.model||"";
  $("year").value=car?.year||"";
  $("dateSeen").value=car?.dateSeen||today();
  $("location").value=car?.location||"";
  $("engine").value=car?.engine||"";
  $("power").value=car?.power||"";
  $("drivetrain").value=car?.drivetrain||"";
  $("tags").value=car?.tags||"";
  $("notes").value=car?.notes||"";
  $("favorite").checked=!!car?.favorite;
  $("modalTitle").textContent=car?"Edit car":"Add car";
  setPreview(currentPhoto);
  $("modal").classList.remove("hidden");
}
function closeModal(){$("modal").classList.add("hidden")}
function setPreview(src){
  const wrap=document.querySelector(".photo-picker");
  if(src){$("photoPreview").src=src;wrap.classList.add("has-image")}else{wrap.classList.remove("has-image");$("photoPreview").removeAttribute("src")}
}
function imageFromFile(file){
  return new Promise((resolve,reject)=>{
    if(!file)return resolve(null);
    const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(file);
  });
}

async function saveForm(e){
  e.preventDefault();
  const id=$("carId").value||crypto.randomUUID();
  const old=cars.find(c=>c.id===id);
  const car={id,make:$("make").value.trim(),model:$("model").value.trim(),year:$("year").value||"",dateSeen:$("dateSeen").value,location:$("location").value.trim(),engine:$("engine").value.trim(),power:$("power").value.trim(),drivetrain:$("drivetrain").value,tags:$("tags").value.trim(),notes:$("notes").value.trim(),favorite:$("favorite").checked,image:currentPhoto,createdAt:old?.createdAt||Date.now()};
  await put(car); cars=await getAll(); closeModal(); renderCars();
}
function filtered(){
  const q=$("search").value.toLowerCase().trim(), tag=$("tagFilter").value, drive=$("driveFilter").value, fav=$("favFilter").checked, sort=$("sortFilter").value;
  let list=cars.filter(c=>{
    const hay=[c.make,c.model,c.year,c.location,c.engine,c.power,c.drivetrain,c.tags,c.notes].join(" ").toLowerCase();
    return (!q||hay.includes(q))&&(!tag||c.tags.split(",").map(x=>x.trim()).includes(tag))&&(!drive||c.drivetrain===drive)&&(!fav||c.favorite);
  });
  list.sort((a,b)=>sort==="oldest"?a.dateSeen.localeCompare(b.dateSeen):sort==="make"?`${a.make} ${a.model}`.localeCompare(`${b.make} ${b.model}`):sort==="power"?powerNumber(b.power)-powerNumber(a.power):b.dateSeen.localeCompare(a.dateSeen));
  return list;
}
function powerNumber(s){const m=String(s||"").match(/[\d,.]+/);return m?parseFloat(m[0].replace(",","")):0}
function placeholder(){return "data:image/svg+xml;charset=utf-8,"+encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="600" height="450"><rect width="100%" height="100%" fill="#333"/><text x="50%" y="50%" text-anchor="middle" dominant-baseline="middle" fill="#aaa" font-size="70">🚗</text></svg>`)}
function renderCars(){
  const list=filtered(), grid=$("carGrid");grid.innerHTML="";
  $("heroCount").textContent=cars.length;$("heroFavorites").textContent=cars.filter(c=>c.favorite).length;$("heroMakes").textContent=new Set(cars.map(c=>c.make.toLowerCase()).filter(Boolean)).size;
  $("emptyState").classList.toggle("hidden",list.length>0);
  $("emptyTitle").textContent=cars.length?"No matching cars":"No cars yet";
  $("emptyText").textContent=cars.length?"Try changing your search or filters.":"Start your collection with your first sighting.";
  list.forEach(c=>{
    const card=document.createElement("article");card.className="car-card";card.onclick=()=>openDetail(c.id);
    card.innerHTML=`<div class="fav-badge">${c.favorite?"★":"☆"}</div><img src="${c.image||placeholder()}" alt="${esc(c.make+" "+c.model)}"><div class="card-body"><h3>${esc(c.make)} ${esc(c.model)}</h3><p>${esc(c.year||"Year unknown")} · ${esc(c.dateSeen||"")}</p><p>${esc(c.location||"Location unknown")}</p></div>`;
    grid.appendChild(card);
  });
  refreshTagFilter();
}
function refreshTagFilter(){
  const tags=[...new Set(cars.flatMap(c=>c.tags.split(",").map(x=>x.trim()).filter(Boolean)))].sort();
  $("tagFilter").innerHTML='<option value="">All tags</option>'+tags.map(t=>`<option>${esc(t)}</option>`).join("");
}
function esc(s){return String(s||"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}

function openDetail(id){
  currentDetailId=id;const c=cars.find(x=>x.id===id);if(!c)return;
  $("detailTitle").textContent=`${c.make} ${c.model}`;
  $("detailImage").src=c.image||placeholder();
  $("detailFavorite").textContent=c.favorite?"★ Favorited":"☆ Favorite";
  const items=[["Year",c.year],["Date seen",c.dateSeen],["Location",c.location],["Engine",c.engine],["Power",c.power],["Drivetrain",c.drivetrain],["Tags",c.tags]];
  $("detailBody").innerHTML=items.filter(x=>x[1]).map(([k,v])=>`<div class="detail-item"><small>${k}</small><strong>${esc(v)}</strong></div>`).join("")+(c.notes?`<div class="detail-item detail-notes"><small>Notes</small><strong>${esc(c.notes)}</strong></div>`:"");
  $("detailModal").classList.remove("hidden");
}
function closeDetail(){$("detailModal").classList.add("hidden");currentDetailId=null}

function renderStats(){
  $("statTotal").textContent=cars.length;$("statFavs").textContent=cars.filter(c=>c.favorite).length;
  $("statMakes").textContent=new Set(cars.map(c=>c.make.toLowerCase()).filter(Boolean)).size;
  $("statModels").textContent=new Set(cars.map(c=>`${c.make} ${c.model}`.toLowerCase()).filter(Boolean)).size;
  const makeCount={};cars.forEach(c=>{if(c.make)makeCount[c.make]=(makeCount[c.make]||0)+1});
  const tagCount={};cars.forEach(c=>c.tags.split(",").map(x=>x.trim()).filter(Boolean).forEach(t=>tagCount[t]=(tagCount[t]||0)+1));
  renderBars("makeStats",makeCount);renderBars("tagStats",tagCount);
}
function renderBars(id,obj){
  const entries=Object.entries(obj).sort((a,b)=>b[1]-a[1]).slice(0,8), max=entries[0]?.[1]||1;
  $(id).innerHTML=entries.length?entries.map(([k,v])=>`<div class="bar-row"><span>${esc(k)}</span><div class="bar"><i style="width:${v/max*100}%"></i></div><b>${v}</b></div>`).join(""):`<span class="muted">Nothing here yet.</span>`;
}

async function exportBackup(){
  const data={app:"CarSpotter",version:1,exportedAt:new Date().toISOString(),cars};
  const blob=new Blob([JSON.stringify(data)],{type:"application/json"});
  const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`carspotter-backup-${today()}.json`;a.click();URL.revokeObjectURL(a.href);
}
async function importBackup(file){
  const text=await file.text(), data=JSON.parse(text);
  if(!data.cars||!Array.isArray(data.cars))throw new Error("Invalid backup");
  if(!confirm(`Import ${data.cars.length} cars? This will add them to your current collection.`))return;
  for(const c of data.cars){if(!c.id)c.id=crypto.randomUUID();await put(c)}
  cars=await getAll();renderCars();alert("Import complete.");
}

$("topAdd").onclick=()=>openModal();$("navAdd").onclick=()=>openModal();$("emptyAdd").onclick=()=>openModal();
$("closeModal").onclick=closeModal;$("closeDetail").onclick=closeDetail;$("carForm").onsubmit=saveForm;
async function handlePhotoInput(e){
  currentPhoto=await imageFromFile(e.target.files[0]);
  setPreview(currentPhoto);
  e.target.value="";
}
$("cameraInput").onchange=handlePhotoInput;
$("galleryInput").onchange=handlePhotoInput;
$("search").oninput=renderCars;$("tagFilter").onchange=renderCars;$("driveFilter").onchange=renderCars;$("favFilter").onchange=renderCars;$("sortFilter").onchange=renderCars;
$("filterBtn").onclick=()=>$("filters").classList.toggle("hidden");
document.querySelectorAll(".nav-btn").forEach(b=>b.onclick=()=>showPage(b.dataset.page));
$("detailFavorite").onclick=async()=>{const c=cars.find(x=>x.id===currentDetailId);c.favorite=!c.favorite;await put(c);cars=await getAll();openDetail(c.id);renderCars()};
$("detailEdit").onclick=()=>{const c=cars.find(x=>x.id===currentDetailId);closeDetail();openModal(c)};
$("detailDelete").onclick=async()=>{if(confirm("Delete this car?")){await remove(currentDetailId);cars=await getAll();closeDetail();renderCars()}};
$("exportBtn").onclick=exportBackup;
$("importInput").onchange=async e=>{try{await importBackup(e.target.files[0])}catch(err){alert("Could not import that backup.")}e.target.value=""};
$("deleteAllBtn").onclick=async()=>{if(confirm("Delete ALL cars and photos from this device? This cannot be undone unless you have a backup.")){await clearDB();cars=[];renderCars();renderStats()}};

(async()=>{await openDB();cars=await getAll();$("dateSeen").value=today();renderCars()})();

if("serviceWorker" in navigator) window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js"));
