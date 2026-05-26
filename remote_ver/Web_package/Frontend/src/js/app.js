// ─────────────────────────────────────────
// Config
// ─────────────────────────────────────────
//const API = "http://192.168.1.121:8000";

const API = "http://127.0.0.1:8000";

// ─────────────────────────────────────────
// Pending-request guard
// ─────────────────────────────────────────
const pending = {};

function withPending(key, btnIds, fn) {
  return async (...args) => {
    if (pending[key]) return;
    pending[key] = true;
    btnIds.forEach(id => { const el = document.getElementById(id); if (el) el.disabled = true; });
    try { await fn(...args); }
    finally {
      pending[key] = false;
      btnIds.forEach(id => { const el = document.getElementById(id); if (el) el.disabled = false; });
    }
  };
}

// ─────────────────────────────────────────
// State
// ─────────────────────────────────────────
const image = { psi: null, roi: null };
let point1 = null, point2 = null;
let imageCaptured = false, refCaptured = false;

// ─────────────────────────────────────────
// DOM ready
// ─────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("openCam")        .addEventListener("click", withPending("cam",     ["openCam","stopCam"],          initializeCamera));
  document.getElementById("stopCam")        .addEventListener("click", withPending("camStop", ["openCam","stopCam"],          stopCamera));
  document.getElementById("setExposureBtn") .addEventListener("click", withPending("expo",    ["setExposureBtn"],             setExposure));
  document.getElementById("captureImageBtn").addEventListener("click", withPending("capture", ["captureImageBtn"],            captureImage));
  document.getElementById("phaseDiff")      .addEventListener("click", withPending("phase",   ["phaseDiff"],                  sendParams));
  document.getElementById("selectRoiBtn")   .addEventListener("click", withPending("roi",     ["selectRoiBtn"],               startROISelection));
  document.getElementById("3dbtn")          .addEventListener("click", withPending("3d",      ["3dbtn"],                      fetch3DPlot));
  document.getElementById("1dbtn")          .addEventListener("click", withPending("1d",      ["1dbtn"],                      startPointsSelection));

  document.getElementById("imageFile").addEventListener("change", () => console.log("Object image selected"));
  document.getElementById("refFile")  .addEventListener("change", () => console.log("Reference image selected"));
});

// ─────────────────────────────────────────
// Camera
// ─────────────────────────────────────────
async function initializeCamera() {
  try {
    const res  = await fetch(`${API}/start_camera`);
    const data = await res.json();
    if (data.error) { alert("Failed to start camera: " + data.error); return; }
    const img  = document.getElementById("cameraStream");
    const view = document.getElementById("cameraView");
    img.src = `${API}/camera_feed`;
    img.classList.add("active");
    view.classList.add("streaming");
  } catch (err) {
    alert("Error connecting to server: " + err.message);
  }
}

async function stopCamera() {
  const img  = document.getElementById("cameraStream");
  const view = document.getElementById("cameraView");
  img.src = "";
  img.classList.remove("active");
  view.classList.remove("streaming");
  try { await fetch(`${API}/stop_camera`); } catch {}
}

async function setExposure() {
  const val = document.getElementById("exposureInput").value;
  try {
    const res  = await fetch(`${API}/set_exposure`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ exposure: parseFloat(val) })
    });
    const data = await res.json();
    if (!data.success) alert("Failed to set exposure.");
  } catch (err) {
    alert("Error setting exposure: " + err.message);
  }
}

async function captureImage() {
  const type = document.getElementById("captureType").value;
  try {
    const res  = await fetch(`${API}/capture_image`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type })
    });
    const data = await res.json();
    if      (data.success_ref) { refCaptured   = true; alert(`Captured as ${type}`); }
    else if (data.success_img) { imageCaptured = true; alert(`Captured as ${type}`); }
    else alert("Capture failed");
  } catch (err) {
    alert("Capture error: " + err.message);
  }
}

// ─────────────────────────────────────────
// Phase difference
// ─────────────────────────────────────────
async function sendParams() {
  const imageFile = document.getElementById("imageFile").files[0];
  const refFile   = document.getElementById("refFile").files[0];
  if (!imageFile && !imageCaptured) { alert("Please provide an object image."); return; }
  if (!refFile   && !refCaptured)   { alert("Please provide a reference image."); return; }

  const fd = new FormData();
  fd.append("wavelength",         document.getElementById("wavelength").value);
  fd.append("pixel_size",         document.getElementById("pixelSize").value);
  fd.append("magnification",      document.getElementById("magnification").value);
  fd.append("delta_ri",           document.getElementById("ri").value);
  fd.append("dc_remove",          document.getElementById("skipPixels").value);
  fd.append("filter_type",        document.getElementById("filterType").value);
  fd.append("filter_size",        document.getElementById("filterSize").value);
  fd.append("beam_type",          document.getElementById("beams").value);
  fd.append("threshold_strength", "1.0");
  if (imageFile) fd.append("image",     imageFile);
  if (refFile)   fd.append("reference", refFile);

  try {
    const res = await fetch(`${API}/run_phase_difference`, { method: "POST", body: fd });
    if (!res.ok) throw new Error("Server error " + res.status);
    const data = await res.json();

    document.getElementById("phaseOutput").innerHTML =
      `<div id="plotImage" style="width:100%;height:100%;"></div>`;
    Plotly.newPlot("plotImage", [], {
      images: [{
        source: "data:image/png;base64," + data.phase_image,
        x:0, y:0, sizex:1, sizey:1, xref:"x", yref:"y", sizing:"stretch", layer:"below"
      }],
      xaxis: { showgrid:false, zeroline:false, visible:false, range:[0,1], autorange:false },
      yaxis: { showgrid:false, zeroline:false, visible:false, scaleanchor:"x", range:[1,0], autorange:false },
      margin: { l:0, r:0, t:0, b:0 }
    }, { responsive:true, displayModeBar:true, scrollZoom:true, displaylogo:false });

    image.psi = data.phase_image;
  } catch (err) { alert("Error: " + err.message); }
}

// ─────────────────────────────────────────
// ROI
// ─────────────────────────────────────────
async function startROISelection() {
  if (!image.psi) { alert("No phase image available."); return; }
  const popup = window.open("", "ROI", "width=800,height=600");
  popup.document.write(`<html><head><title>Select ROI</title>
    <style>body{margin:0}canvas{display:block;cursor:crosshair;}</style></head><body>
    <canvas id="c"></canvas><script>
    const c=document.getElementById('c'),ctx=c.getContext('2d'),img=new Image();
    img.src="data:image/png;base64,${image.psi}";
    let s,drawing=false;
    img.onload=()=>{c.width=img.width;c.height=img.height;ctx.drawImage(img,0,0);};
    c.onmousedown=e=>{const r=c.getBoundingClientRect();s={x:e.clientX-r.left,y:e.clientY-r.top};drawing=true;};
    c.onmousemove=e=>{if(!drawing)return;const r=c.getBoundingClientRect(),ex=e.clientX-r.left,ey=e.clientY-r.top;ctx.drawImage(img,0,0);ctx.strokeStyle='red';ctx.lineWidth=2;ctx.strokeRect(s.x,s.y,ex-s.x,ey-s.y);};
    c.onmouseup=e=>{drawing=false;const r=c.getBoundingClientRect(),ex=e.clientX-r.left,ey=e.clientY-r.top;window.opener.receiveROI({x1:Math.round(Math.min(s.x,ex)),y1:Math.round(Math.min(s.y,ey)),x2:Math.round(Math.max(s.x,ex)),y2:Math.round(Math.max(s.y,ey))});setTimeout(()=>window.close(),400);};
    <\/script></body></html>`);
}

function receiveROI(coords) { selectROI(coords.x1, coords.y1, coords.x2, coords.y2); }

async function selectROI(x1, y1, x2, y2) {
  try {
    const res  = await fetch(`${API}/select_roi`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ x1, y1, x2, y2 })
    });
    const data = await res.json();
    if (data.error) { alert(data.error); return; }
    image.roi = data.roi_image;
    document.getElementById("roiOutput").innerHTML =
      `<img src="data:image/png;base64,${data.roi_image}" style="max-width:100%;" />`;
  } catch (err) { alert("ROI error: " + err.message); }
}

// ─────────────────────────────────────────
// 3D plot
// ─────────────────────────────────────────
async function fetch3DPlot() {
  try {
    const res  = await fetch(`${API}/compute_3d`);
    const data = await res.json();
    if (data.error) { alert(data.error); return; }
    document.getElementById("output3D").innerHTML =
      `<div id="plot3d" style="width:100%;height:100%;"></div>`;
    Plotly.newPlot("plot3d", [{
      type:"surface", x:data.x, y:data.y, z:data.z, colorscale:"Jet"
    }], {
      scene:{ xaxis:{title:"X (µm)"}, yaxis:{title:"Y (µm)"}, zaxis:{title:"Thickness (µm)"} },
      margin:{ l:0, r:0, b:0, t:0 }
    });
  } catch (err) { alert("3D error: " + err.message); }
}

// ─────────────────────────────────────────
// 1D profile
// ─────────────────────────────────────────
async function startPointsSelection() {
  const src = image.roi || image.psi;
  if (!src) { alert("Please compute the phase difference first."); return; }
  const popup = window.open("", "Points", "width=800,height=600");
  popup.document.write(`<html><head><title>Select Points</title>
    <style>html,body{margin:0;padding:0;width:100%;height:100%;overflow:hidden;}
    canvas{display:block;width:100vw;height:100vh;cursor:crosshair;}
    #tip{position:fixed;background:rgba(0,0,0,.7);color:#fff;padding:3px 8px;font:12px monospace;border-radius:4px;pointer-events:none;}
    </style></head><body><canvas id="c"></canvas><div id="tip"></div><script>
    const c=document.getElementById('c'),ctx=c.getContext('2d'),img=new Image();
    img.src="data:image/png;base64,${src}";
    let pts=[],iw,ih;
    const sc=()=>Math.min(c.width/iw,c.height/ih);
    const off=()=>({x:(c.width-iw*sc())/2,y:(c.height-ih*sc())/2});
    const resize=()=>{c.width=window.innerWidth;c.height=window.innerHeight;if(img.complete)draw();};
    const draw=()=>{const s=sc(),o=off();ctx.clearRect(0,0,c.width,c.height);ctx.drawImage(img,o.x,o.y,iw*s,ih*s);ctx.fillStyle='red';pts.forEach(p=>{ctx.beginPath();ctx.arc(p.cx,p.cy,5,0,2*Math.PI);ctx.fill();});if(pts.length===2){ctx.beginPath();ctx.moveTo(pts[0].cx,pts[0].cy);ctx.lineTo(pts[1].cx,pts[1].cy);ctx.strokeStyle='blue';ctx.lineWidth=2;ctx.stroke();}};
    img.onload=()=>{iw=img.width;ih=img.height;resize();};
    window.addEventListener('resize',resize);
    c.addEventListener('click',e=>{const r=c.getBoundingClientRect(),s=sc(),o=off(),x=(e.clientX-r.left-o.x)/s,y=(e.clientY-r.top-o.y)/s;pts.push({x,y,cx:e.clientX-r.left,cy:e.clientY-r.top});draw();if(pts.length===2){window.opener.receivePoints(pts[0],pts[1]);setTimeout(()=>window.close(),800);}});
    c.addEventListener('mousemove',e=>{const r=c.getBoundingClientRect(),s=sc(),o=off(),x=Math.floor((e.clientX-r.left-o.x)/s),y=Math.floor((e.clientY-r.top-o.y)/s),t=document.getElementById('tip');if(x>=0&&x<iw&&y>=0&&y<ih){const d=ctx.getImageData(e.clientX-r.left,e.clientY-r.top,1,1).data;t.textContent=\`(\${x},\${y}) R=\${d[0]} G=\${d[1]} B=\${d[2]}\`;t.style.cssText=\`left:\${e.clientX+12}px;top:\${e.clientY+12}px;\`;}else t.textContent='';});
    <\/script></body></html>`);
}

function receivePoints(p1, p2) { point1=p1; point2=p2; fetch1DPlot(); }

async function fetch1DPlot() {
  if (!point1 || !point2) { alert("Select two points first."); return; }
  try {
    const res  = await fetch(`${API}/compute_1d`, {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ x1:Math.round(point1.x), y1:Math.round(point1.y), x2:Math.round(point2.x), y2:Math.round(point2.y) })
    });
    const data = await res.json();
    if (data.error) { alert(data.error); return; }
    document.getElementById("output1D").innerHTML =
      `<div id="plot1d" style="width:100%;height:100%;"></div>`;
    Plotly.newPlot("plot1d", [{
      x:data.x, y:data.y, mode:"lines", type:"scatter", line:{color:"#3f7fff"}
    }], {
      xaxis:{title:"Distance (µm)"}, yaxis:{title:"Thickness (µm)"},
      margin:{l:40,r:10,b:40,t:10}
    }, { responsive:true });
  } catch (err) { alert("1D error: " + err.message); }
}