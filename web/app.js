(() => {
  "use strict";

  const params = new URLSearchParams(location.search);
  const role = ["passenger", "operator", "admin", "display", "demo"].includes(params.get("role")) ? params.get("role") : "passenger";
  const main = document.querySelector("#main");
  const sidebar = document.querySelector("#sidebar");
  const topStatus = document.querySelector("#topbar-status");
  const toastNode = document.querySelector("#toast");
  const state = {page: "", locations: [], announcements: [], token: sessionStorage.getItem(`${role}-token`) || "", name: "", mapMode: "from", mapZoom: 1, mapOffset: {x: 0, y: 0}, mapDrag: null, results: [], health: null};

  const iconPaths = {
    route: '<path d="M4 19V5m0 0h9l-2 3 2 3H4"/><circle cx="18" cy="17" r="2"/><path d="M14 17h2M18 15V7a2 2 0 0 0-2-2h-2"/>',
    bookmark: '<path d="M6 4h12v17l-6-4-6 4z"/>',
    queue: '<path d="M5 6h14M5 12h14M5 18h8"/><circle cx="18" cy="18" r="2"/>',
    pin: '<path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',
    source: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5m0-9h.01"/>',
    grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
    alert: '<path d="M12 3 2.8 20h18.4L12 3Z"/><path d="M12 9v4m0 3h.01"/>',
    bus: '<path d="M5 17V6a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v11M5 11h14M7 17h10"/><circle cx="8" cy="17" r="1.5"/><circle cx="16" cy="17" r="1.5"/>',
    people: '<circle cx="9" cy="8" r="3"/><path d="M3 20v-1a6 6 0 0 1 12 0v1M17 5a3 3 0 0 1 0 6m4 9v-1a6 6 0 0 0-4-5.65"/>',
    log: '<path d="M5 4h14v16H5zM8 8h8M8 12h8M8 16h5"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="m19.4 15 .1.1a1.8 1.8 0 1 1-2.5 2.5l-.1-.1a1.8 1.8 0 0 0-3 .9v.2a1.8 1.8 0 1 1-3.6 0v-.2a1.8 1.8 0 0 0-3-.9l-.1.1a1.8 1.8 0 1 1-2.5-2.5l.1-.1a1.8 1.8 0 0 0-.9-3h-.2a1.8 1.8 0 1 1 0-3.6h.2a1.8 1.8 0 0 0 .9-3l-.1-.1a1.8 1.8 0 1 1 2.5-2.5l.1.1a1.8 1.8 0 0 0 3-.9v-.2a1.8 1.8 0 1 1 3.6 0v.2a1.8 1.8 0 0 0 3 .9l.1-.1a1.8 1.8 0 1 1 2.5 2.5l-.1.1a1.8 1.8 0 0 0 .9 3h.2a1.8 1.8 0 1 1 0 3.6h-.2a1.8 1.8 0 0 0-.9 3Z"/>',
    arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
    swap: '<path d="M4 8h16m-4-4 4 4-4 4M20 16H4m4-4-4 4 4 4"/>',
    search: '<circle cx="10" cy="10" r="6"/><path d="m15 15 5 5"/>',
    mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0m-7 7v3m-4 0h8"/>',
    speaker: '<path d="M4 9h4l5-4v14l-5-4H4zm13-2a7 7 0 0 1 0 10m3-13a11 11 0 0 1 0 16"/>',
    map: '<path d="m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2V5Zm6-2v16m6-14v16"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    expand: '<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>',
    fit: '<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/><circle cx="12" cy="12" r="3"/>',
    close: '<path d="m5 5 14 14M19 5 5 19"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    more: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
  };
  const svg = (name) => `<svg viewBox="0 0 24 24" aria-hidden="true">${iconPaths[name] || iconPaths.source}</svg>`;
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const fmtDate = (value) => { if (!value) return "—"; const date = new Date(value); return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-IN", {dateStyle:"medium",timeStyle:"short",timeZone:"Asia/Kolkata"}).format(date); };
  const fmtClock = (value) => { if (!value) return "—"; const date = new Date(value); return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-IN", {hour:"2-digit",minute:"2-digit",timeZone:"Asia/Kolkata"}).format(date); };
  const byId = (id) => state.locations.find((item) => Number(item.id) === Number(id));

  async function api(path, options = {}) {
    const headers = new Headers(options.headers || {});
    if (state.token) headers.set("Authorization", `Bearer ${state.token}`);
    if (options.body && !(options.body instanceof ArrayBuffer) && !(options.body instanceof Blob) && !(options.body instanceof FormData)) headers.set("Content-Type", "application/json");
    const response = await fetch(path, {...options, headers, cache:"no-store"});
    const data = (response.headers.get("content-type") || "").includes("application/json") ? await response.json() : {};
    if (!response.ok) {
      if (response.status === 401 && role !== "passenger" && role !== "display" && role !== "demo") {
        state.token = ""; sessionStorage.removeItem(`${role}-token`);
      }
      throw new Error(data.error || `Could not complete this local action (${response.status}).`);
    }
    return data;
  }

  function toast(message, error = false) {
    toastNode.textContent = message;
    toastNode.classList.toggle("is-error", error);
    toastNode.classList.add("is-visible");
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => toastNode.classList.remove("is-visible"), 3000);
  }

  function setStatus(label, tone = "warn") {
    topStatus.innerHTML = `<span class="status-dot"></span><span>${esc(label)}</span>`;
    topStatus.classList.toggle("is-good", tone === "good");
    const dot = $(".status-dot", topStatus);
    if (dot) dot.style.background = tone === "good" ? "var(--green)" : tone === "bad" ? "var(--red)" : "var(--yellow)";
  }

  const navConfig = {
    passenger: [
      ["journey", "Journey", "route"], ["saved", "Saved", "bookmark"], ["queue", "Queue", "queue"], ["places", "Places", "pin"], ["sources", "Sources", "source"],
    ],
    operator: [["overview", "Overview", "grid"], ["updates", "Service updates", "alert"], ["operator-queue", "Boarding queue", "queue"], ["entries", "Entered times", "bus"]],
    admin: [["admin-overview", "Overview", "grid"], ["admin-locations", "Warangal places", "pin"], ["admin-feed", "Timetable data", "bus"], ["admin-activity", "Activity log", "log"], ["admin-users", "Accounts", "people"]],
  };

  function renderPassengerHeader(active) {
    document.body.classList.add("passenger-mode");
    $(".body-grid").classList.add("passenger-layout");
    const translated = localStorage.getItem("nilaya-language") === "te";
    document.documentElement.lang = translated ? "te" : "en";
    let nav = $("#passenger-main-nav");
    if (!nav) { nav=document.createElement("nav");nav.id="passenger-main-nav";nav.className="passenger-main-nav";nav.setAttribute("aria-label","Passenger navigation");$(".brand").after(nav); }
    nav.innerHTML = [["journey",translated?"ప్రయాణం":"Explore","map"],["saved",translated?"సేవ్ చేసినవి":"Saved","bookmark"],["queue",translated?"వరుస":"Queue","queue"]].map(([id,label,key])=>'<button type="button" data-header-page="'+id+'" aria-current="'+(active===id?"page":"false")+'">'+svg(key)+'<span>'+label+'</span>'+(id==="queue"?'<span class="nav-queue-badge" data-queue-badge hidden></span>':'')+'</button>').join("");
    let tools=$("#passenger-header-tools");
    if(!tools){tools=document.createElement("div");tools.id="passenger-header-tools";tools.className="passenger-header-tools";$(".topbar").append(tools);}
    tools.innerHTML='<button class="language-button" id="language-toggle" type="button" lang="'+(translated?'en':'te')+'">'+(translated?'English':'తెలుగు preview')+'</button><details class="passenger-tools-menu"><summary aria-label="More tools">'+svg("more")+'</summary><div><button type="button" data-header-page="places">'+svg("pin")+'Warangal places</button><button type="button" data-header-page="sources">'+svg("source")+'Simulation & sources</button><hr><a href="/?role=display" target="_blank">'+svg("bus")+'Stop display</a><a href="/?role=operator" target="_blank">'+svg("people")+'Operator app</a><a href="/?role=admin" target="_blank">'+svg("grid")+'Admin dashboard</a><a href="/?role=demo" target="_blank">'+svg("settings")+'Demo controller</a></div></details>';
    $$("[data-header-page]",nav).concat($$("[data-header-page]",tools)).forEach(button=>button.addEventListener("click",()=>navigate(button.dataset.headerPage)));
    $("#language-toggle").addEventListener("click",()=>{localStorage.setItem("nilaya-language",translated?"en":"te");navigate(state.page);});
    tools.onkeydown=event=>{if(event.key==="Escape"){$("details",tools).open=false;$("summary",tools).focus();}};
  }

  function updatePassengerQueueBadge(token) {
    $$("[data-queue-badge]").forEach(node=>{node.hidden=!token;node.textContent=token?.token||"";});
  }

  function renderNav(active) {
    if (role === "passenger") renderPassengerHeader(active);
    const items = navConfig[role] || [];
    if (!items.length) { sidebar.innerHTML = ""; return; }
    sidebar.innerHTML = `<div class="nav-caption">${role === "passenger" ? "Passenger" : role === "operator" ? "Operator" : "Administrator"}</div><nav class="nav-list">${items.map(([id,label,icon]) => `<button class="nav-item" data-page="${id}" aria-current="${active===id?"page":"false"}"><span class="nav-icon">${svg(icon)}</span><span>${esc(label)}</span></button>`).join("")}</nav><div class="sidebar-bottom"><strong>Warangal tri-city</strong>Local routes and landmarks<br><a href="https://www.openstreetmap.org/search?query=Warangal%2C%20Telangana" target="_blank" rel="noreferrer">Open city map ↗</a></div>`;
    $$("[data-page]", sidebar).forEach((button) => button.addEventListener("click", () => navigate(button.dataset.page)));
  }

  function navigate(page) {
    if (state.page === "journey" && page !== "journey") journeyWorkspace.destroy();
    clearInterval(state.queueTicker);
    state.page = page;
    if (role === "passenger") renderPassenger(page);
    else if (role === "operator") renderOperator(page);
    else if (role === "admin") renderAdmin(page);
    else if (role === "display") renderDisplay();
    else renderDemo();
  }

  function pageHead(title, description = "", actions = "") {
    return `<header class="page-head"><div><h1>${esc(title)}</h1>${description ? `<p>${esc(description)}</p>` : ""}</div>${actions ? `<div class="head-actions">${actions}</div>` : ""}</header>`;
  }

  function selectOptions(selected = "", category = "") {
    return state.locations.filter((x) => !category || x.category === category).map((x) => `<option value="${x.id}" ${Number(selected) === Number(x.id) ? "selected" : ""}>${esc(x.name)}</option>`).join("");
  }

  function savedJourneys() {
    try { return JSON.parse(localStorage.getItem("nilaya-saved-journeys") || "[]"); } catch { return []; }
  }

  function renderPassenger(page = "journey") {
    renderNav(page);
    setStatus("Simulation running", "good");
    if (page === "journey") renderJourney();
    else if (page === "saved") renderSaved();
    else if (page === "queue") renderPassengerQueue();
    else if (page === "places") renderPlaces();
    else renderSources();
  }

  function renderJourney() {
    journeyWorkspace.render();
  }

  function operatorEntryMarkup(entries) {
    if (!entries.length) return "";
    return `<div class="rule"></div><h3 class="surface-title" style="font-size:13px">Operator-entered at ${esc(entries[0].location_name)} <small>check locally</small></h3>${entries.map((x) => `<article class="trip-result"><div class="trip-route"><span>${esc(x.route_label)} → ${esc(x.destination)}</span><span class="trip-times">${esc(fmtClock(x.departure_at))}</span></div><div class="trip-meta">Entered ${esc(fmtDate(x.entered_at))}${x.note ? ` · ${esc(x.note)}` : ""}</div><div class="evidence" style="color:var(--yellow)">Operator-entered · simulation</div></article>`).join("")}`;
  }

  function saveJourney(start, finish) {
    if (!start || !finish) return;
    const rows = savedJourneys().filter((x) => !(Number(x.from_id) === Number(start.id) && Number(x.to_id) === Number(finish.id)));
    rows.unshift({from_id:start.id,to_id:finish.id,from_name:start.name,to_name:finish.name,saved_at:new Date().toISOString()});
    localStorage.setItem("nilaya-saved-journeys", JSON.stringify(rows.slice(0,12)));
    toast("Journey saved on this device.");
  }

  function renderSaved() {
    const rows = savedJourneys();
    main.innerHTML = `${pageHead("Saved journeys", "Shortcuts stay on this device.")}
      <section class="surface surface-pad"><h2 class="surface-title">Your places</h2>${rows.length ? `<ul class="saved-list">${rows.map((x,i) => `<li class="list-item"><div><strong>${esc(x.from_name)} <span style="color:var(--cyan)">→</span> ${esc(x.to_name)}</strong><small>Saved ${esc(fmtDate(x.saved_at))}</small></div><div class="head-actions"><button class="btn btn-small" data-open-saved="${i}" type="button">Open</button><button class="btn btn-small btn-quiet" data-remove-saved="${i}" type="button" aria-label="Remove saved journey">Remove</button></div></li>`).join("")}</ul>` : '<div class="empty-state"><strong>No saved journeys yet.</strong>Find a route and choose “Save journey” to keep it here.</div>'}</section>`;
    $$('[data-open-saved]').forEach((button) => button.addEventListener("click", () => {
      const item = savedJourneys()[Number(button.dataset.openSaved)]; if (!item) return;
      navigate("journey"); journeyWorkspace.open(item.from_id, item.to_id);
    }));
    $$('[data-remove-saved]').forEach((button) => button.addEventListener("click", () => {
      const items = savedJourneys(); items.splice(Number(button.dataset.removeSaved),1); localStorage.setItem("nilaya-saved-journeys",JSON.stringify(items)); renderSaved();
    }));
  }

  function renderPassengerQueue() {
    const mineId = Number(localStorage.getItem("nilaya-demo-token") || 0);
    
    const stationIds = state.locations.filter((x) => x.category === "Bus station" || x.category === "Bus stop");
    main.innerHTML = `${pageHead("Waiting order", "A shared local demo queue for the selected Warangal bus station.", `<span class="demo-label">DEMO QUEUE</span>`)}
      <div class="page-grid"><section class="surface surface-pad"><h2 class="surface-title">Your place in line</h2><div id="my-token" class="empty-state"><strong>No demo token on this device.</strong>Join the local demonstration queue to try a return-from-break flow. This is not a TGSRTC boarding queue.</div>
        <div class="rule"></div><form id="join-queue-form" class="form-grid"><div class="field"><label for="queue-name">Name or initials</label><input class="input" id="queue-name" maxlength="32" placeholder="e.g. A.S."></div><div class="field"><label for="queue-stop">Bus station</label><select class="select" id="queue-stop">${stationIds.map((x) => `<option value="${x.id}" ${Number(state.queueStop)===Number(x.id)?"selected":""}>${esc(x.name)}</option>`).join("")}</select></div><button class="btn btn-primary" type="submit">Join demo queue</button></form>
      </section><aside class="surface surface-pad"><h2 class="surface-title">Break rule</h2><p class="source-note">A demonstration token keeps its original sequence for up to ten minutes while marked away. It does not reserve a seat or guarantee the next departure. A staffed operator would be required for a real queue.</p><div class="rule"></div><h3 class="surface-title">Waiting at a real stop?</h3><p class="source-note">Confirm the boarding point and departure with TGSRTC staff. NILAYA does not have authority to call passengers or hold a bus.</p></aside></div>
      <div class="split-heading"><h2>Local queue</h2><span id="queue-count">Loading shared tokens…</span></div><div id="queue-list" class="surface surface-pad"></div>`;
    $("#join-queue-form").addEventListener("submit", joinQueue);
    refreshQueue(mineId);
    state.queueTicker=setInterval(updateQueueHoldReadouts,1000);
  }

  async function joinQueue(event) {
    event.preventDefault();
    try {
      const data = await api("/api/passenger/queue", {method:"POST",body:JSON.stringify({action:"join",location_id:Number($("#queue-stop").value),label:$("#queue-name").value.trim() || "Passenger"})});
      localStorage.setItem("nilaya-demo-token",String(data.token.id));
      toast(`Demo token ${data.token.token} added.`);
      refreshQueue(Number(data.token.id));
    } catch (error) { toast(error.message,true); }
  }

  async function queueAction(action, id) {
    try {
      const data = await api("/api/passenger/queue",{method:"POST",body:JSON.stringify({action,token_id:id})});
      toast(action === "break" ? "Ten-minute demo return window started." : "Your token is back in the waiting line.");
      refreshQueue(Number(localStorage.getItem("nilaya-demo-token") || id));
    } catch (error) { toast(error.message,true); }
  }

  async function refreshQueue(mineId = 0) {
    try {
      const data = await api("/api/queue");
      const tokens = data.tokens || [];
      const mineToken = tokens.find((x) => Number(x.id) === Number(mineId));
      updatePassengerQueueBadge(mineToken);
      const mineNode = $("#my-token");
      if (mineNode) mineNode.innerHTML = mineToken ? `<div class="queue-ticket"><div><div class="ticket-label">Demo token · sequence ${mineToken.sequence_no}</div><div class="ticket-code">${esc(mineToken.token)}</div><div class="ticket-status">${esc(mineToken.status.replaceAll("_"," "))}</div></div><span class="status-label warn">Not an RTC queue</span><div class="queue-actions">${mineToken.status === "WAITING" ? `<button class="btn btn-small btn-cyan" data-queue-break="${mineToken.id}" type="button">Take a break · 10 min</button>` : ""}${mineToken.status === "AWAY_PROTECTED" ? `<button class="btn btn-small btn-primary" data-queue-return="${mineToken.id}" type="button">I’m back</button><span class="muted" style="font-size:11px">Return by ${esc(fmtDate(mineToken.hold_expires_at))} · <span data-queue-expiry="${esc(mineToken.hold_expires_at)}"></span></span>` : ""}</div></div>` : '<strong>No active token saved here.</strong>Join below to see the demo queue flow.';
      const list = $("#queue-list");
      if (list) list.innerHTML = tokens.length ? tokens.map((x) => `<div class="data-row"><strong>${esc(x.token)} · ${esc(x.passenger_label)}</strong><span>${esc(x.location_name)}</span><span>Sequence ${x.sequence_no}</span><span class="status-label ${x.status === "AWAY_PROTECTED" ? "warn" : ""}">${esc(x.status.replaceAll("_"," "))}</span></div>`).join("") : '<div class="empty-state"><strong>No one is in the local queue.</strong>Demo tokens appear here for all open NILAYA apps.</div>';
      updateQueueHoldReadouts();
      const count = $("#queue-count"); if (count) count.textContent = `${tokens.length} active ${tokens.length === 1 ? "token" : "tokens"}`;
      $$('[data-queue-break]').forEach((button) => button.addEventListener("click", () => queueAction("break",Number(button.dataset.queueBreak))));
      $$('[data-queue-return]').forEach((button) => button.addEventListener("click", () => queueAction("return",Number(button.dataset.queueReturn))));
    } catch (error) { const list = $("#queue-list"); if (list) list.textContent = error.message; }
  }

  function updateQueueHoldReadouts() {
    $$('[data-queue-expiry]').forEach(node=>{
      const seconds=Math.max(0,Math.ceil((new Date(node.dataset.queueExpiry)-Date.now())/1000));
      node.textContent=Math.floor(seconds/60)+":"+String(seconds%60).padStart(2,"0")+" remaining";
    });
  }

  function locationRows() {
    return state.locations.map((x) => `<button class="location-row" data-location-id="${x.id}" data-category="${esc(x.category)}" type="button"><span class="location-pin">${x.category.includes("Bus") ? "B" : x.category === "Railway station" ? "R" : "P"}</span><span><span class="location-name">${esc(x.name)}</span><span class="location-meta">${esc(x.category)} · ${esc(x.area)}</span></span></button>`).join("");
  }

  function bindLocationRows(selector) {
    $$("[data-location-id]", $(selector)).forEach((button) => button.addEventListener("click", () => selectMapLocation(Number(button.dataset.locationId))));
  }

  function renderPlaces() {
    main.innerHTML = `${pageHead("Warangal places", "Bus stations, railway access, landmarks and essential locations.")}
      <section class="surface map-panel"><div class="map-header"><div><h2>Tri-city locations</h2><p>Approximate coordinates · tap a marker to choose a journey place</p></div><a class="btn btn-small" href="https://www.openstreetmap.org/search?query=Warangal%2C%20Telangana" target="_blank" rel="noreferrer">Open full map ↗</a></div><div class="map-wrap"><canvas id="places-map" class="map-canvas" tabindex="0" aria-label="Interactive coordinate map for Warangal locations"></canvas><div class="map-tools"><button class="map-tool" data-zoom="in" type="button" aria-label="Zoom in">+</button><button class="map-tool" data-zoom="out" type="button" aria-label="Zoom out">−</button><button class="map-tool" data-zoom="fit" type="button" aria-label="Fit map">⌂</button></div></div><div class="map-footer"><span>Place coordinates are approximate. Check local signage for boarding.</span><span class="map-coordinate">${state.locations.length} markers</span></div></section>
      <div class="split-heading"><h2>Place list</h2><span>Use this list with keyboard or screen reader</span></div><div id="place-list" class="location-grid">${locationRows()}</div>`;
    bindMap("places-map"); bindLocationRows("#place-list");
  }

  function renderSources() {
    main.innerHTML = `${pageHead("Data sources", "What this local demo knows, and how each item was added.")}
      <div class="stack"><section class="surface surface-pad"><h2 class="surface-title">About the simulation</h2><p class="source-note">Bus routes, arrival times and departures are simulated around real Warangal places. Services repeat throughout the day so you can try journey search, saved trips and the boarding queue at any time.</p><div class="rule"></div><p class="source-note">Operator entries, notices and passenger actions are shared between the apps and recorded in the Admin activity log.</p></section>
      <section class="surface surface-pad"><h2 class="surface-title">Place names and map markers</h2><p class="source-note">Seed locations are named Warangal tri-city places. Bus station names follow TGSRTC references; landmarks are cross-checked with Telangana Tourism and Warangal District sources. The coordinate markers are approximate orientation points and should be checked before a public release.</p><p class="source-note">Contains map/place information from OpenStreetMap contributors. Map tiles are loaded only when you open the external map; NILAYA does not prefetch tiles.</p><div class="form-actions"><a class="btn btn-small" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap attribution ↗</a><a class="btn btn-small" href="https://warangal.telangana.gov.in/tourist-place/warangal-fort/" target="_blank" rel="noreferrer">Warangal District tourism ↗</a><a class="btn btn-small" href="https://tourism.telangana.gov.in/attractions/thousand-pillars-temple" target="_blank" rel="noreferrer">Telangana Tourism ↗</a></div></section>
      <section class="surface surface-pad"><h2 class="surface-title">Local database</h2><p class="source-note">All five apps use one SQLite database on this PC. Passenger searches, operator updates and queue actions appear in the Administrator activity log. This demo uses local-only sample accounts and does not send passenger data to TGSRTC.</p></section></div>`;
  }

  function noticeMarkup(item) {
    const tone = item.severity === "cancel" || item.severity === "delay" ? "is-danger" : item.severity === "access" ? "is-access" : item.source === "Simulated demo scenario" ? "is-demo" : "";
    return `<article class="notice ${tone}"><span class="notice-mark" aria-hidden="true">${item.severity === "delay" || item.severity === "cancel" ? "!" : "i"}</span><div><strong>${esc(item.title)}${item.location_name ? ` · ${esc(item.location_name)}` : ""}</strong><p>${esc(item.message)}${item.source ? ` <span class="muted">(${esc(item.source)})</span>` : ""}</p></div></article>`;
  }

  function bindMap(id) {
    const canvas = $(`#${id}`); if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let hits = [];
    const bounds = {south:17.951,north:18.011,west:79.499,east:79.625};
    function paint() {
      const rect = canvas.getBoundingClientRect(); if (!rect.width || !rect.height) return;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(rect.width*dpr); canvas.height = Math.round(rect.height*dpr);
      ctx.setTransform(dpr,0,0,dpr,0,0);
      const w=rect.width,h=rect.height;
      ctx.fillStyle="#0a0a0a";ctx.fillRect(0,0,w,h);
      const cx=w/2+state.mapOffset.x,cy=h/2+state.mapOffset.y,scale=state.mapZoom;
      const base=Math.min((w-92)/(bounds.east-bounds.west),(h-70)/(bounds.north-bounds.south));
      const sx=base*scale, sy=base*scale;
      const project=(lon,lat)=>({x:cx+(lon-(bounds.west+bounds.east)/2)*sx,y:cy-((lat-(bounds.south+bounds.north)/2)*sy)});
      // Coordinate grid, kept deliberately quiet behind real place markers.
      ctx.strokeStyle="#1c1c1c";ctx.lineWidth=1;ctx.setLineDash([]);
      const lonStep=.025,latStep=.012;
      for(let lon=Math.ceil(bounds.west/lonStep)*lonStep;lon<=bounds.east;lon+=lonStep){const p=project(lon,bounds.south);ctx.beginPath();ctx.moveTo(p.x,0);ctx.lineTo(p.x,h);ctx.stroke();}
      for(let lat=Math.ceil(bounds.south/latStep)*latStep;lat<=bounds.north;lat+=latStep){const p=project(bounds.west,lat);ctx.beginPath();ctx.moveTo(0,p.y);ctx.lineTo(w,p.y);ctx.stroke();}
      const startPlace = byId($("#from-place")?.value), endPlace = byId($("#to-place")?.value);
      if(startPlace && endPlace && startPlace.id !== endPlace.id){
        const a=project(startPlace.lon,startPlace.lat),b=project(endPlace.lon,endPlace.lat);
        ctx.strokeStyle="#3fd6c6";ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();
        const bus={x:a.x+(b.x-a.x)*.48,y:a.y+(b.y-a.y)*.48};
        ctx.fillStyle="#f2f2f2";ctx.fillRect(bus.x-7,bus.y-6,14,12);ctx.fillStyle="#050505";ctx.fillRect(bus.x-4,bus.y-3,8,4);
      }
      // Simple north marker and coordinate edges.
      ctx.fillStyle="#a6a9ad";ctx.textAlign="right";ctx.font='10px Geist, sans-serif';ctx.fillText("N",w-18,25);ctx.strokeStyle="#a6a9ad";ctx.beginPath();ctx.moveTo(w-21,37);ctx.lineTo(w-21,26);ctx.lineTo(w-25,31);ctx.moveTo(w-21,26);ctx.lineTo(w-17,31);ctx.stroke();
      hits=[];const labelBoxes=[];
      for(const item of state.locations){const p=project(Number(item.lon),Number(item.lat));if(p.x<-30||p.y<-20||p.x>w+30||p.y>h+20)continue;
        const transit=item.category.includes("Bus")||item.category==="Railway station";
        ctx.beginPath();ctx.fillStyle=transit?"#f2f2f2":"#8a8d91";ctx.arc(p.x,p.y,6.5,0,Math.PI*2);ctx.fill();ctx.lineWidth=2;ctx.strokeStyle="#0a0a0a";ctx.stroke();
        ctx.beginPath();ctx.fillStyle=transit?"#f2f2f233":"#8a8d9130";ctx.arc(p.x,p.y,11,0,Math.PI*2);ctx.fill();
        const label=item.name.replace(" City Bus Station"," Bus Station");ctx.font='500 11px Geist, sans-serif';
        const labelWidth=ctx.measureText(label).width, candidates=[
          {x:p.x+12,y:p.y-11,align:"left"},{x:p.x+12,y:p.y+23,align:"left"},
          {x:p.x-12,y:p.y-11,align:"right"},{x:p.x-12,y:p.y+23,align:"right"},
          {x:p.x,y:p.y-17,align:"center"},{x:p.x,y:p.y+29,align:"center"}
        ];
        let chosen=null;
        for(const candidate of candidates){const left=candidate.align==="left"?candidate.x:candidate.align==="right"?candidate.x-labelWidth:candidate.x-labelWidth/2;const box={left:left-4,right:left+labelWidth+4,top:candidate.y-11,bottom:candidate.y+4};if(box.left<4||box.right>w-4||box.top<4||box.bottom>h-4)continue;if(labelBoxes.some((other)=>box.left<other.right+4&&box.right+4>other.left&&box.top<other.bottom+3&&box.bottom+3>other.top))continue;chosen={...candidate,left,box};break;}
        if(chosen){ctx.fillStyle="#0a0a0a";ctx.fillRect(chosen.left-4,chosen.y-12,labelWidth+8,17);ctx.fillStyle="#f2f2f2";ctx.textAlign=chosen.align;ctx.fillText(label,chosen.x,chosen.y);labelBoxes.push(chosen.box);}
        hits.push({x:p.x,y:p.y,item});
      }
    }
    canvas._paint=paint; requestAnimationFrame(paint);
    const resize=()=>paint(); window.addEventListener("resize",resize,{passive:true});
    canvas.addEventListener("pointerdown",(event)=>{state.mapDrag={x:event.clientX,y:event.clientY,ox:state.mapOffset.x,oy:state.mapOffset.y,moved:false};canvas.setPointerCapture(event.pointerId);canvas.classList.add("is-dragging");});
    canvas.addEventListener("pointermove",(event)=>{if(!state.mapDrag)return;const dx=event.clientX-state.mapDrag.x,dy=event.clientY-state.mapDrag.y;if(Math.abs(dx)+Math.abs(dy)>4)state.mapDrag.moved=true;state.mapOffset={x:state.mapDrag.ox+dx,y:state.mapDrag.oy+dy};paint();});
    canvas.addEventListener("pointerup",(event)=>{canvas.classList.remove("is-dragging");if(state.mapDrag&&!state.mapDrag.moved){const r=canvas.getBoundingClientRect(),x=event.clientX-r.left,y=event.clientY-r.top;const hit=[...hits].reverse().find((h)=>Math.hypot(h.x-x,h.y-y)<17);if(hit)selectMapLocation(Number(hit.item.id));}state.mapDrag=null;});
    canvas.addEventListener("pointercancel",()=>{state.mapDrag=null;canvas.classList.remove("is-dragging");});
    canvas.addEventListener("keydown",(event)=>{if(event.key==="+"){state.mapZoom=Math.min(3,state.mapZoom*1.2);paint();}if(event.key==="-"){state.mapZoom=Math.max(.75,state.mapZoom/1.2);paint();}if(event.key==="Home"){state.mapZoom=1;state.mapOffset={x:0,y:0};paint();}});
    $$('[data-zoom]').forEach((button)=>button.addEventListener("click",()=>{if(button.dataset.zoom==="in")state.mapZoom=Math.min(3,state.mapZoom*1.25);else if(button.dataset.zoom==="out")state.mapZoom=Math.max(.7,state.mapZoom/1.25);else{state.mapZoom=1;state.mapOffset={x:0,y:0};}paint();}));
  }

  function selectMapLocation(id) {
    const item=byId(id); if(!item)return;
    if(role==="passenger" && state.page==="journey"){
      const select=$(state.mapMode==="from"?"#from-place":"#to-place");if(select){select.value=String(id);toast(`${item.name} set as ${state.mapMode === "from" ? "start" : "destination"}.`);}
    }else toast(`${item.name} · ${Number(item.lat).toFixed(4)}, ${Number(item.lon).toFixed(4)}`);
  }

  async function renderOperator(page = "overview") {
    renderNav(page);
    if (!state.token) { renderLogin("operator"); return; }
    setStatus("Operator session", "good");
    if (page === "overview") await operatorOverview();
    else if (page === "updates") await operatorUpdates();
    else if (page === "operator-queue") await operatorQueue();
    else await operatorEntries();
  }

  function renderLogin(targetRole) {
    const label=targetRole === "admin" ? "Administrator sign in" : "Operator sign in";
    const user=targetRole === "admin" ? "admin" : "operator";
    main.innerHTML=`<div class="login-wrap"><h1 style="font-size:29px;margin:0 0 18px">${label}</h1><section class="surface"><form id="login-form"><div class="field"><label for="login-user">Username</label><input class="input" id="login-user" autocomplete="username" value="${user}" required></div><div class="field" style="margin-top:14px"><label for="login-password">Password</label><input class="input" id="login-password" type="password" autocomplete="current-password" required></div><div id="login-error" class="signin-error" aria-live="polite"></div><button class="btn btn-primary" type="submit">Sign in</button></form><div class="login-help"><strong>Local demo account</strong><br>${user} / ${DEMO_DEMO_PASSWORD}<br>Demo credentials are stored only in this local database.</div></section></div>`;
    $("#login-form").addEventListener("submit",async(event)=>{event.preventDefault();const err=$("#login-error");err.textContent="";try{const data=await api("/api/auth/login",{method:"POST",body:JSON.stringify({username:$("#login-user").value.trim(),password:$("#login-password").value,role:targetRole})});state.token=data.token;state.name=data.name;sessionStorage.setItem(`${targetRole}-token`,data.token);navigate(targetRole==="admin"?"admin-overview":"overview");}catch(error){err.textContent=error.message;}});
  }

  const DEMO_DEMO_PASSWORD = "NilayaDemo!2026";

  async function operatorOverview() {
    const [ann,queue,obs]=await Promise.all([api("/api/announcements"),api("/api/operator/queue"),api("/api/operator/observations")]);
    main.innerHTML=`${pageHead("Operator desk", "Publish time-limited local updates and manage the demonstration queue.", `<button class="btn btn-small btn-quiet" id="signout" type="button">Sign out · ${esc(state.name||"operator")}</button>`)}
      <div class="data-banner"><div><h2>Local operator session</h2><p>Operator entries appear in Passenger, Stop Display and Administrator activity. They are local demo records and are not official TGSRTC notices.</p></div><span class="status-label warn">Simulation session</span></div>
      <div class="stat-strip"><div class="stat"><strong>${ann.announcements.length}</strong><span>Active updates</span></div><div class="stat"><strong>${queue.tokens.length}</strong><span>Open demo queue tokens</span></div><div class="stat"><strong>${obs.observations.length}</strong><span>Operator time entries</span></div></div>
      <div class="page-grid"><section class="surface surface-pad"><h2 class="surface-title">Post a service update</h2>${operatorUpdateForm()}</section><section class="surface surface-pad"><h2 class="surface-title">Record a departure entry</h2>${operatorObservationForm()}</section></div>
      <div class="split-heading"><h2>Current local updates</h2><span>${ann.announcements.length} active</span></div><div id="operator-current-updates" class="stack">${ann.announcements.length?ann.announcements.map((x)=>noticeMarkup(x)).join(""):'<div class="surface surface-pad empty-state">No operator updates are active.</div>'}</div>`;
    bindOperatorForms(); $("#signout").addEventListener("click",signOut);
  }

  function operatorUpdateForm() {
    return `<form id="operator-update-form" class="stack"><div class="field"><label for="notice-title">Short title</label><input class="input" id="notice-title" maxlength="100" placeholder="e.g. Boarding point moved" required></div><div class="form-grid"><div class="field"><label for="notice-type">Update type</label><select id="notice-type" class="select"><option value="info">Information</option><option value="delay">Delay</option><option value="access">Accessibility</option><option value="cancel">Cancellation</option></select></div><div class="field"><label for="notice-place">Place</label><select id="notice-place" class="select"><option value="0">All places</option>${selectOptions()}</select></div></div><div class="field"><label for="notice-message">What should passengers know?</label><textarea class="textarea" id="notice-message" maxlength="500" placeholder="e.g. Boarding for Kazipet is now at bay 2." required></textarea><span class="field-hint">This update is labeled “Operator-entered” and expires automatically after two hours. Close it sooner if the information changes.</span></div><button class="btn btn-primary" type="submit">Publish local update</button><div id="operator-update-status" class="field-hint" aria-live="polite"></div></form>`;
  }

  function operatorObservationForm() {
    return `<form id="operator-observation-form" class="stack"><div class="form-grid"><div class="field"><label for="entry-place">Boarding place</label><select id="entry-place" class="select">${selectOptions("", "Bus station")}${selectOptions("", "Bus stop")}</select></div><div class="field"><label for="entry-route">Route or service label</label><input class="input" id="entry-route" maxlength="80" placeholder="e.g. SIM 12" required></div></div><div class="field"><label for="entry-destination">Destination shown</label><input class="input" id="entry-destination" maxlength="120" placeholder="e.g. Hanamkonda" required></div><div class="field"><label for="entry-time">Departure time · IST</label><input class="input" id="entry-time" type="datetime-local" required></div><div class="field"><label for="entry-note">Checked by / note</label><input class="input" id="entry-note" maxlength="240" placeholder="Optional local note"></div><button class="btn btn-cyan" type="submit">Add operator entry</button><div class="field-hint">Passenger screens label these as operator-entered. All entries are part of this simulation.</div><div id="operator-observation-status" class="field-hint" aria-live="polite"></div></form>`;
  }

  function setDefaultDepartureTime() {
    const field=$("#entry-time");if(!field)return;const at=new Date(Date.now()+15*60000);at.setMinutes(Math.ceil(at.getMinutes()/5)*5,0,0);field.value=new Date(at.getTime()-at.getTimezoneOffset()*60000).toISOString().slice(0,16);
  }

  function bindOperatorForms() {
    setDefaultDepartureTime();
    $("#operator-update-form")?.addEventListener("submit",async(event)=>{event.preventDefault();const status=$("#operator-update-status");status.textContent="";try{await api("/api/operator/announcement",{method:"POST",body:JSON.stringify({title:$("#notice-title").value.trim(),message:$("#notice-message").value.trim(),severity:$("#notice-type").value,location_id:Number($("#notice-place").value)||null})});status.textContent="Update published to the local apps.";toast("Local update published.");await operatorOverview();}catch(error){status.textContent=error.message;}});
    $("#operator-observation-form")?.addEventListener("submit",async(event)=>{event.preventDefault();const status=$("#operator-observation-status");status.textContent="";try{await api("/api/operator/observation",{method:"POST",body:JSON.stringify({location_id:Number($("#entry-place").value),route:$("#entry-route").value.trim(),destination:$("#entry-destination").value.trim(),departure_at:$("#entry-time").value,note:$("#entry-note").value.trim()})});status.textContent="Entry added. It will appear on the passenger board and in Admin activity.";toast("Operator entry added.");await operatorEntries();}catch(error){status.textContent=error.message;}});
  }

  async function operatorUpdates() {
    const [ann,obs]=await Promise.all([api("/api/announcements"),api("/api/operator/observations")]);
    main.innerHTML=`${pageHead("Service updates", "Create or close local passenger notices.", `<button class="btn btn-small btn-quiet" id="signout" type="button">Sign out</button>`)}<div class="page-grid"><section class="surface surface-pad"><h2 class="surface-title">New update</h2>${operatorUpdateForm()}</section><section class="surface surface-pad"><h2 class="surface-title">Active updates</h2>${ann.announcements.length?ann.announcements.map((x)=>`${noticeMarkup(x)}<button class="btn btn-small btn-quiet" data-close-ann="${x.id}" type="button">Close update</button>`).join('<div class="rule"></div>'):'<div class="empty-state">No active updates.</div>'}</section></div><div class="split-heading"><h2>Recent operator entries</h2><span>${obs.observations.length} records</span></div><div class="surface surface-pad divider-list">${obs.observations.length?obs.observations.map(observationRow).join(""):'<div class="empty-state">No operator-entered times yet.</div>'}</div>`;
    bindOperatorForms(); $("#signout").addEventListener("click",signOut);
    $$('[data-close-ann]').forEach((button)=>button.addEventListener("click",async()=>{try{await api("/api/operator/announcement/close",{method:"POST",body:JSON.stringify({id:Number(button.dataset.closeAnn)})});toast("Update closed.");operatorUpdates();}catch(error){toast(error.message,true);}}));
  }

  async function operatorEntries() {
    const result=await api("/api/operator/observations");
    main.innerHTML=`${pageHead("Entered departures", "Add departures to the shared simulation and review previous entries.", `<button class="btn btn-small btn-quiet" id="signout" type="button">Sign out</button>`)}<section class="surface surface-pad"><h2 class="surface-title">Add a checked time</h2>${operatorObservationForm()}</section><div class="split-heading"><h2>Recent entries</h2><span>${result.observations.length} records</span></div><div class="surface surface-pad divider-list">${result.observations.length?result.observations.map(observationRow).join(""):'<div class="empty-state"><strong>No departure entries yet.</strong>Record a time after checking the details for your simulation.</div>'}</div>`;
    bindOperatorForms(); $("#signout").addEventListener("click",signOut);
  }

  function observationRow(item) {
    return `<div class="data-row"><strong>${esc(item.route_label)} → ${esc(item.destination)}</strong><span>${esc(item.location_name)}</span><span>${esc(fmtDate(item.departure_at))}</span><span class="status-label warn">Operator-entered</span></div>`;
  }

  async function operatorQueue() {
    const result=await api("/api/operator/queue");
    main.innerHTML=`${pageHead("Boarding queue", "Local demonstration only · use one shared database across the open apps.", `<button class="btn btn-small btn-quiet" id="signout" type="button">Sign out</button>`)}<div class="data-banner"><div><h2>Demo queue controls</h2><p>Calls and boarding updates are written to the shared local database. Real break protection requires a staffed terminal and an approved policy.</p></div><span class="demo-label">DEMO</span></div><section class="surface surface-pad"><h2 class="surface-title">Waiting tokens</h2>${result.tokens.length?result.tokens.map((x)=>`<div class="data-row"><strong>${esc(x.token)} · ${esc(x.passenger_label)}</strong><span>${esc(x.location_name)}</span><span>Sequence ${x.sequence_no} · ${esc(x.status.replaceAll("_"," "))}</span><span class="row-actions">${x.status==="WAITING"?`<button class="btn btn-small btn-cyan" data-queue-action="call" data-token="${x.id}" type="button">Call</button>`:""}${x.status==="CALLED"?`<button class="btn btn-small btn-primary" data-queue-action="board" data-token="${x.id}" type="button">Confirm boarded</button>`:""}</span></div>`).join(""):'<div class="empty-state">No active queue tokens. A passenger can join from the Passenger app.</div>'}</section>`;
    $("#signout").addEventListener("click",signOut);
    $$('[data-queue-action]').forEach((button)=>button.addEventListener("click",async()=>{try{await api("/api/operator/queue-action",{method:"POST",body:JSON.stringify({action:button.dataset.queueAction,token_id:Number(button.dataset.token)})});toast(`Token marked ${button.dataset.queueAction === "call" ? "called" : "boarded"}.`);operatorQueue();}catch(error){toast(error.message,true);}}));
  }

  function signOut() { sessionStorage.removeItem(`${role}-token`);state.token="";state.name="";navigate(role==="admin"?"admin-overview":"overview"); }

  async function renderAdmin(page="admin-overview") {
    renderNav(page);
    if(!state.token){renderLogin("admin");return;}
    setStatus("Administrator session","good");
    if(page==="admin-overview") await adminOverview();
    else if(page==="admin-locations") await adminLocations();
    else if(page==="admin-feed") await adminFeed();
    else if(page==="admin-activity") await adminActivity();
    else await adminUsers();
  }

  async function adminOverview() {
    const [summary,activity,ann]=await Promise.all([api("/api/admin/summary"),api("/api/admin/activity"),api("/api/announcements")]);
    const c=summary.counts, feed=summary.feed;
    main.innerHTML=`${pageHead("Administrator", "Shared local data for Passenger, Operator and Stop Display.", `<button class="btn btn-small btn-quiet" id="signout" type="button">Sign out · ${esc(state.name||"admin")}</button>`)}
      <div class="stat-strip"><div class="stat"><strong>${c.locations}</strong><span>Warangal places</span></div><div class="stat"><strong>${c.passenger_searches}</strong><span>Recorded searches</span></div><div class="stat"><strong>${c.active_queue}</strong><span>Open queue tokens</span></div><div class="stat"><strong>${c.active_announcements}</strong><span>Active operator updates</span></div><div class="stat"><strong>${c.local_trips}</strong><span>Simulation services</span></div></div>
      <section class="data-banner"><div><h2>Warangal simulation</h2><p>Passenger services and departures run throughout the day. Operator updates and queue actions are shared across all five apps.</p></div><span class="status-label">Running</span></section>
      <div class="page-grid"><section class="surface surface-pad"><h2 class="surface-title">Latest shared activity</h2><div class="activity-list">${(activity.activity||[]).slice(0,8).map(activityRow).join("")}</div><div class="form-actions"><button class="btn btn-small" data-admin-page="admin-activity" type="button">Open activity log</button></div></section><aside class="stack"><section class="surface surface-pad"><h2 class="surface-title">Simulation status</h2><div class="list-item"><div><strong>Bus services</strong><small>Generated departure times</small></div><span class="status-label">Running</span></div><div class="list-item"><div><strong>Warangal network</strong><small>${c.locations} places · ${c.local_trips} services</small></div><span class="status-label">Ready</span></div><div class="list-item"><div><strong>Operator updates</strong><small>Shared local database</small></div><span class="status-label">${ann.announcements.length} active</span></div></section><section class="surface surface-pad"><h2 class="surface-title">Local database</h2><p class="source-note">${esc(summary.data_path)}</p><p class="source-note">Passenger searches, operator changes and queue actions are stored here.</p></section></aside></div>`;
    $("#signout").addEventListener("click",signOut);bindAdminNav();
  }

  function activityRow(item) {
    return `<article class="activity-row"><time>${esc(fmtDate(item.created_at))}</time><span>${esc(item.role)}</span><div><strong>${esc(item.action.replaceAll("."," · "))}</strong><p>${esc(item.detail)}</p></div><span class="source-chip">${esc(item.source)}</span></article>`;
  }

  function bindAdminNav() {
    $$('[data-admin-page]').forEach((button)=>button.addEventListener("click",()=>navigate(button.dataset.adminPage)));
  }

  async function adminActivity() {
    const [result,users]=await Promise.all([api("/api/admin/activity"),api("/api/admin/users")]);void users;
    main.innerHTML=`${pageHead("Activity log", "Passenger searches, operator entries and queue changes from every open app.", `<button class="btn btn-small btn-quiet" id="signout" type="button">Sign out</button>`)}<section class="surface surface-pad"><div class="activity-list">${result.activity.length?result.activity.map(activityRow).join(""):'<div class="empty-state">No activity has been recorded.</div>'}</div></section>`;
    $("#signout").addEventListener("click",signOut);
  }

  async function adminLocations() {
    const result=await api("/api/admin/locations");state.locations=result.locations;
    main.innerHTML=`${pageHead("Warangal places", "Manage local place names and map coordinates.", `<button class="btn btn-small btn-quiet" id="signout" type="button">Sign out</button>`)}<div class="page-grid"><section class="surface surface-pad"><h2 class="surface-title">Place records <small>${result.locations.length} places</small></h2><div class="divider-list">${result.locations.map((x)=>`<div class="data-row"><strong>${esc(x.name)}</strong><span>${esc(x.category)} · ${esc(x.area)}</span><span class="map-coordinate">${Number(x.lat).toFixed(5)}, ${Number(x.lon).toFixed(5)}</span><a class="row-actions" href="${esc(x.source_url||`https://www.openstreetmap.org/search?query=${encodeURIComponent(x.name+", Warangal")}`)}" target="_blank" rel="noreferrer">Source ↗</a></div>`).join("")}</div></section><aside class="surface surface-pad"><h2 class="surface-title">Add a verified place</h2><form id="add-place-form" class="stack"><div class="field"><label for="add-place-name">Name</label><input class="input" id="add-place-name" required></div><div class="form-grid"><div class="field"><label for="add-place-category">Type</label><select class="select" id="add-place-category"><option>Bus station</option><option>Bus stop</option><option>Railway station</option><option>Landmark</option><option>Hospital</option><option>Other</option></select></div><div class="field"><label for="add-place-area">Area</label><input class="input" id="add-place-area" value="Warangal"></div></div><div class="form-grid"><div class="field"><label for="add-place-lat">Latitude</label><input class="input" type="number" id="add-place-lat" step="0.000001" min="17.7" max="18.3" required></div><div class="field"><label for="add-place-lon">Longitude</label><input class="input" type="number" id="add-place-lon" step="0.000001" min="79.2" max="80" required></div></div><p class="field-hint">Check the place on OpenStreetMap before adding it. Added records are marked for verification.</p><button class="btn btn-primary" type="submit">Add place</button><div id="add-place-status" class="field-hint" aria-live="polite"></div></form></aside></div>`;
    $("#signout").addEventListener("click",signOut);$("#add-place-form").addEventListener("submit",async(event)=>{event.preventDefault();try{await api("/api/admin/add-location",{method:"POST",body:JSON.stringify({name:$("#add-place-name").value,category:$("#add-place-category").value,area:$("#add-place-area").value,lat:Number($("#add-place-lat").value),lon:Number($("#add-place-lon").value)})});toast("Place added to the shared database.");adminLocations();}catch(error){$("#add-place-status").textContent=error.message;}});
  }

  async function adminFeed() {
    const summary=await api("/api/admin/summary"),feed=summary.feed;
    main.innerHTML=`${pageHead("Timetable data", "Import published Warangal-area departures from the official TGSRTC GTFS archive.", `<button class="btn btn-small btn-quiet" id="signout" type="button">Sign out</button>`)}
      <section class="data-banner"><div><h2>${feed?"Current published timetable":"Simulation timetable"}</h2><p>${feed?`${esc(feed.filename)} · ${feed.local_stops} local stops · ${feed.local_trips} local trips · ${esc(fmtDate(feed.imported_at))}`:"Simulated services are ready. You can also keep an official timetable file here for reference."}</p></div><span class="status-label">Simulation</span></section>
      <div class="page-grid"><section class="surface surface-pad"><h2 class="surface-title">Import an official GTFS ZIP</h2><p class="source-note">The local importer reads routes, stops, trips, service calendars and stop times. It keeps Warangal tri-city records and marks them as scheduled data. No arrival predictions are created from this file.</p><div class="form-actions"><a class="btn btn-small" href="https://www.tgsrtc.telangana.gov.in/open-data" target="_blank" rel="noreferrer">Request GTFS from TGSRTC ↗</a><a class="btn btn-small btn-quiet" href="https://www.tgsrtc.telangana.gov.in/open-data" target="_blank" rel="noreferrer">Read usage terms ↗</a></div><div class="dropzone"><div><label class="field-label" for="gtfs-file">Choose downloaded GTFS ZIP</label><span class="field-hint" style="display:block;margin-top:4px">ZIP archive · maximum 100 MB</span></div><input id="gtfs-file" type="file" accept=".zip,application/zip"><button id="import-gtfs" class="btn btn-primary" type="button">Import file</button></div><div id="feed-import-status" class="field-hint" style="margin-top:12px" aria-live="polite"></div></section>
      <aside class="surface surface-pad"><h2 class="surface-title">Demo services</h2><p class="source-note">Simulation services use real Warangal locations with generated routes, regular headways and illustrative journey durations. Passenger and Stop Display always show the simulation in this build.</p><div class="rule"></div><p class="source-note">Official GTFS files remain separate reference data. Retain the attribution “Contains data provided by TGSRTC” when using TGSRTC data.</p></aside></div>`;
    $("#signout").addEventListener("click",signOut);
    $("#import-gtfs").addEventListener("click",async()=>{const file=$("#gtfs-file").files[0],status=$("#feed-import-status");if(!file){status.textContent="Choose the TGSRTC GTFS ZIP first.";return;}status.textContent="Reading the official feed…";try{const raw=await file.arrayBuffer();const data=await api("/api/admin/import-gtfs",{method:"POST",headers:{"X-Filename":file.name},body:raw});status.textContent=`Imported ${data.stops} local stops and ${data.trips} trips from ${data.filename}.` ;toast("TGSRTC timetable imported.");setTimeout(()=>navigate("admin-overview"),800);}catch(error){status.textContent=error.message;}});
  }

  async function adminUsers() {
    const result=await api("/api/admin/users");
    main.innerHTML=`${pageHead("Demo accounts", "Role access for this local demonstration.", `<button class="btn btn-small btn-quiet" id="signout" type="button">Sign out</button>`)}<section class="surface surface-pad"><h2 class="surface-title">Local users</h2><div class="divider-list">${result.users.map((u)=>`<div class="data-row"><strong>${esc(u.display_name)}</strong><span>${esc(u.username)}</span><span>${esc(u.role)}</span><span class="status-label">${u.enabled?"Enabled":"Disabled"}</span></div>`).join("")}</div><div class="rule"></div><p class="source-note">The included administrator and operator passwords are for this local demo only. Passwords are salted and hashed in SQLite. Change the seeded values before any shared or public use.</p></section>`;
    $("#signout").addEventListener("click",signOut);
  }

  async function renderDisplay() {
    sidebar.innerHTML="";document.body.classList.add("display-mode");$(".body-grid").classList.add("display-layout");
    const station=state.locations.find((x)=>x.name.includes("Warangal City Bus Station"))||state.locations.find((x)=>x.category==="Bus station");
    main.classList.add("board-page");
    main.innerHTML=`<div class="board-head"><div><span class="status-label">Simulation</span><h1 id="display-location">${esc(station?.name||"Warangal City Bus Station")}</h1><p>Warangal, Telangana</p></div><div class="board-clock" id="display-clock">--:--<small>IST · loading</small></div></div><div id="display-notices" class="stack" style="margin-bottom:18px"></div><div class="board-layout"><section class="surface surface-pad"><div class="surface-title"><span>Simulated departures</span><select id="display-stop" class="select" style="max-width:270px">${selectOptions(station?.id,"Bus station")}</select></div><div id="display-board"></div><div class="board-freshness"><span class="status-dot"></span><span id="display-status">Simulation updates every 20 seconds.</span></div></section><aside class="surface surface-pad"><h2 class="surface-title">Operator-entered times</h2><div id="display-observations"></div><div class="rule"></div><h2 class="surface-title">Boarding queue</h2><div id="display-queue"></div></aside></div><footer class="board-bottom"><span>NILAYA · Warangal simulation</span><span>Simulation · illustrative timings</span></footer>`;
    const update=async()=>{try{const locId=Number($("#display-stop").value)||Number(station?.id);const data=await api(`/api/board?location_id=${locId}`);const loc=byId(locId);$("#display-location").textContent=loc?.name||"Warangal City Bus Station";$("#display-clock").innerHTML=`${new Intl.DateTimeFormat("en-IN",{hour:"2-digit",minute:"2-digit",timeZone:"Asia/Kolkata"}).format(new Date())}<small>${new Intl.DateTimeFormat("en-IN",{weekday:"long",day:"2-digit",month:"short",timeZone:"Asia/Kolkata"}).format(new Date())} · IST</small>`;$("#display-notices").innerHTML=(data.announcements||[]).map(noticeMarkup).join("");$("#display-board").innerHTML=data.departures.length?`<table class="board-table"><thead><tr><th>Time</th><th>Route</th><th>Destination</th><th>Status</th></tr></thead><tbody>${data.departures.map((x)=>`<tr><td>${esc(x.time_label)}</td><td>${esc(x.route)}</td><td>${esc(x.destination)}</td><td><span class="status-label warn">Simulation</span></td></tr>`).join("")}</tbody></table>`:'<div class="empty-state"><strong>Choose a boarding place.</strong>Select a Warangal station to see the simulation.</div>';$("#display-observations").innerHTML=data.observations.length?data.observations.map((x)=>`<div class="list-item"><div><strong>${esc(x.route_label)} → ${esc(x.destination)}</strong><small>${esc(x.location_name)} · ${esc(fmtDate(x.entered_at))}</small></div><span class="status-label warn">Operator-entered</span></div>`).join(""):'<div class="empty-state">No local operator entries.</div>';const q=await api("/api/queue");$("#display-queue").innerHTML=q.tokens.length?q.tokens.slice(0,8).map((x)=>`<div class="list-item"><div><strong>${esc(x.token)}</strong><small>Sequence ${x.sequence_no} · ${esc(x.location_name)}</small></div><span class="status-label ${x.status==="AWAY_PROTECTED"?"warn":""}">${esc(x.status.replaceAll("_"," "))}</span></div>`).join(""):'<div class="empty-state">No active demo tokens.</div>';setStatus("Local stop display","good");}catch(error){$("#display-status").textContent=error.message;setStatus("Connection interrupted","bad");}};
    $("#display-stop").addEventListener("change",update);update();setInterval(update,20000);
  }

  function renderDemo() {
    renderNav("");setStatus("Demo controller","warn");
    main.innerHTML=`${pageHead("Demo controller", "Add clearly marked walkthrough entries that appear in the other local apps.", `<span class="demo-label">SIMULATED</span>`)}<div class="notice is-demo"><span class="notice-mark">i</span><div><strong>Practice records only</strong><p>Walkthrough actions are labeled as simulated and do not represent a real passenger, bus or TGSRTC service change.</p></div></div><div class="controller-actions"><section class="controller-action"><h3>Passenger search</h3><p>Record an example from Warangal City Bus Station to Thousand Pillar Temple. The Admin activity log will show the entry.</p><button class="btn btn-primary" data-scenario="passenger-search" type="button">Add sample search</button></section><section class="controller-action"><h3>Operator notice</h3><p>Post a training notice at Hanamkonda City Bus Station. It will be visible to Passenger and Stop Display.</p><button class="btn btn-cyan" data-scenario="operator-notice" type="button">Add practice notice</button></section><section class="controller-action"><h3>Open the connected apps</h3><p>Each app uses this PC’s shared NILAYA database when run from the same Windows account.</p><div class="form-actions"><a class="btn btn-small" href="/?role=passenger">Passenger</a><a class="btn btn-small" href="/?role=operator">Operator</a><a class="btn btn-small" href="/?role=admin">Admin</a><a class="btn btn-small" href="/?role=display">Stop Display</a></div></section><section class="controller-action"><h3>Clear walkthrough records</h3><p>Remove only the simulated notice and activity created from this controller.</p><button class="btn btn-small btn-danger" data-scenario="clear-demo" type="button">Clear walkthrough data</button></section></div><div class="split-heading"><h2>Demo locations</h2><span>${state.locations.length} in shared database</span></div><div class="surface surface-pad">${locationRows()}</div>`;
    $$('[data-scenario]').forEach((button)=>button.addEventListener("click",async()=>{try{await api("/api/demo/run-scenario",{method:"POST",body:JSON.stringify({action:button.dataset.scenario})});toast(button.dataset.scenario==="clear-demo"?"Walkthrough records cleared.":"Walkthrough record added to the shared database.");}catch(error){toast(error.message,true);}}));
  }

  const journeyWorkspace = window.createJourneyWorkspace({
    root:main,api,esc,svg,getLocations:()=>state.locations,savedJourneys,saveJourney,toast,
    operatorEntryMarkup,noticeMarkup,updateQueueBadge:updatePassengerQueueBadge,
    openQueue:(id)=>{state.queueStop=id;navigate("queue");}
  });

  async function boot() {
    try { const [locationData,health,ann]=await Promise.all([api("/api/locations"),api("/api/health"),api("/api/announcements")]);state.locations=locationData.locations;state.health=health;state.announcements=ann.announcements; }
    catch(error){main.innerHTML=`${pageHead("NILAYA could not connect", "The local service is not responding.")}<section class="surface surface-pad"><p class="source-note">${esc(error.message)}</p><button class="btn btn-primary" onclick="location.reload()" type="button">Try again</button></section>`;setStatus("Connection interrupted","bad");return;}
    if(role==="passenger")navigate("journey");
    else if(role==="operator")navigate("overview");
    else if(role==="admin")navigate("admin-overview");
    else if(role==="display")navigate("display");
    else navigate("demo");
  }

  boot();
})();

