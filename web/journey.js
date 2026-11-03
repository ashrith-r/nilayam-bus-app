/* Passenger workspace. Service and queue records come from the shared local API. */
window.createJourneyWorkspace = function (deps) {
  "use strict";
  const E = deps.esc;
  const $ = (selector, root = deps.root) => root.querySelector(selector);
  const $$ = (selector, root = deps.root) => [...root.querySelectorAll(selector)];
  const state = {from:0,to:0,services:[],results:[],active:0,selectedStop:0,mapView:"map",zoom:1,x:0,y:0,updated:0,tokenStation:null};
  let controller, observer, timers = [], requestId = 0, mapRequest, recognition, speaking = false, expandedHome;
  const namesTE = {
    "Warangal City Bus Station":"వరంగల్ సిటీ బస్ స్టేషన్",
    "Hanamkonda City Bus Station":"హనుమకొండ సిటీ బస్ స్టేషన్",
    "Kazipet Bus Stop":"కాజీపేట బస్ స్టాప్",
    "Warangal Railway Station":"వరంగల్ రైల్వే స్టేషన్",
    "Thousand Pillar Temple":"వేయి స్తంభాల గుడి",
    "Bhadrakali Temple":"భద్రకాళి ఆలయం",
    "Warangal Fort":"వరంగల్ కోట",
    "MGM Government Hospital":"ఎంజీఎం ప్రభుత్వ ఆసుపత్రి"
  };
  const te = () => localStorage.getItem("nilaya-language") === "te";
  const T = (en, translated) => te() ? translated : en;
  const name = place => te() ? namesTE[place?.name] || place?.name || "" : place?.name || "";
  const place = id => deps.getLocations().find(p => Number(p.id) === Number(id));
  const icon = key => deps.svg(key);
  const normalize = value => String(value || "").toLocaleLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
  const clock = value => new Intl.DateTimeFormat("en-GB", {hour:"2-digit",minute:"2-digit",timeZone:"Asia/Kolkata"}).format(new Date(value));
  const selected = () => state.results[state.active];
  const listen = (node, event, fn) => node?.addEventListener(event, fn, {signal:controller.signal});
  const shortName = value => value.replace(" City Bus Station"," Bus Station").replace("MGM Government Hospital","MGM Hospital");

  function destroy() {
    ++requestId;
    timers.forEach(clearInterval); timers = [];
    observer?.disconnect(); observer = null;
    cancelAnimationFrame(mapRequest);
    if ($("#expanded-route-map")?.open) { $("#expanded-route-map").close(); restoreMap(); }
    controller?.abort();
    recognition?.abort(); recognition = null;
    if (speaking) window.speechSynthesis?.cancel();
    speaking = false;
  }

  function render() {
    destroy(); controller = new AbortController();
    const places = deps.getLocations();
    if (!place(state.from)) state.from = places.find(p => p.name === "Warangal City Bus Station")?.id || places[0]?.id;
    if (!place(state.to) || state.to === state.from) state.to = places.find(p => p.name === "Thousand Pillar Temple" && p.id !== state.from)?.id || places.find(p => p.id !== state.from)?.id;
    state.mapView = "map"; state.selectedStop = state.from; state.tokenStation = null;
    const options = places.map(p => '<option value="' + p.id + '"' + (p.id === Number(state.from) ? ' selected' : '') + '>' + E(name(p)) + '</option>').join("");
    const destinations = places.map(p => '<option value="' + p.id + '"' + (p.id === Number(state.to) ? ' selected' : '') + '>' + E(name(p)) + '</option>').join("");
    deps.root.innerHTML =
      '<div class="workspace-heading"><h1>' + T("Plan a journey","ప్రయాణాన్ని ప్లాన్ చేయండి") + '</h1><span class="status-label">' + T("Simulation · Warangal","సిమ్యులేషన్ · వరంగల్") + '</span></div>' +
      '<div id="journey-notices" class="notice-list"></div>' +
      '<form id="journey-form" class="route-planner" role="search">' +
        '<div class="boarding-picker"><span class="planner-icon">' + icon("pin") + '</span><div class="field"><label for="from-place">' + T("Boarding at","ఎక్కే ప్రదేశం") + '</label><select class="select" id="from-place">' + options + '</select></div></div>' +
        '<button type="button" id="swap-places" class="swap-button" aria-label="' + T("Swap start and destination","ప్రారంభం, గమ్యం మార్చండి") + '">' + icon("swap") + '</button>' +
        '<div class="destination-picker"><label for="destination">' + T("Destination","గమ్యం") + '</label><div class="destination-input-row"><span class="planner-icon">' + icon("search") + '</span><input id="destination" type="search" role="combobox" aria-autocomplete="list" aria-controls="destination-matches" aria-expanded="false" autocomplete="off" value="' + E(name(place(state.to))) + '" placeholder="' + T("Place, landmark or SIM service","ప్రదేశం లేదా SIM సర్వీస్") + '"><button class="icon-btn" id="voice-search" type="button" aria-label="' + T("Search by voice","వాయిస్ శోధన") + '">' + icon("mic") + '</button></div><div id="destination-matches" class="destination-matches" role="listbox" aria-label="' + T("Matching destinations","సరిపోలే గమ్యాలు") + '" hidden></div><select id="to-place" hidden tabindex="-1" aria-hidden="true">' + destinations + '</select></div>' +
        '<button class="btn btn-primary find-route" type="submit">' + T("Find route","మార్గం చూడండి") + icon("arrow") + '</button>' +
      '</form><p id="search-feedback" class="planner-feedback" role="status" aria-live="polite"></p>' +
      '<div class="journey-workspace"><section id="results-content" class="surface journey-card" aria-label="' + T("Selected service","ఎంచుకున్న సర్వీస్") + '" aria-busy="true"><div class="journey-loading">' + T("Finding your next service…","తదుపరి సర్వీస్ కోసం చూస్తున్నాం…") + '</div></section>' +
        '<div class="workspace-right"><section id="route-map-panel" class="surface route-map-panel" aria-label="' + T("Route map","మార్గ పటం") + '">' +
          '<div class="route-map-toolbar"><div class="map-segments" role="group" aria-label="' + T("Map display","పటం వీక్షణ") + '"><button type="button" data-map-view="map" aria-pressed="true">' + icon("map") + T("Map","పటం") + '</button><button type="button" data-map-view="stops" aria-pressed="false">' + icon("list") + T("Stops","స్టాప్‌లు") + '</button></div><button class="icon-btn" type="button" id="expand-map" aria-label="' + T("Expand map","పటాన్ని విస్తరించండి") + '" aria-expanded="false">' + icon("expand") + '</button></div>' +
          '<div id="route-map-wrap" class="route-map-wrap" tabindex="0" role="group" aria-label="' + T("Illustrative route map. Arrow keys pan, plus and minus zoom, Home fits the route.","మార్గ పటం. బాణం కీలతో కదపండి. ప్లస్, మైనస్‌తో జూమ్ చేయండి.") + '"><div id="route-map-drawing"></div><div class="route-map-tools"><button type="button" class="map-tool" data-map-zoom="in" aria-label="' + T("Zoom in","జూమ్ పెంచండి") + '">' + icon("plus") + '</button><button type="button" class="map-tool" data-map-zoom="out" aria-label="' + T("Zoom out","జూమ్ తగ్గించండి") + '">' + icon("minus") + '</button><button type="button" class="map-tool" data-map-zoom="fit" aria-label="' + T("Fit route","మార్గాన్ని సరిపోల్చండి") + '">' + icon("fit") + '</button></div><span class="schematic-caption">' + T("Illustrative streets · simulation","ఊహాత్మక వీధులు · సిమ్యులేషన్") + '</span></div>' +
          '<div id="map-route-stops" class="map-route-stops" hidden></div><div id="map-stop-detail" class="map-stop-detail"></div>' +
          '<div class="route-map-foot"><span><i></i>' + T("Selected route","ఎంచుకున్న మార్గం") + '</span><a href="https://www.openstreetmap.org/search?query=Warangal%2C%20Telangana" target="_blank" rel="noreferrer">' + T("Open city map","నగర పటం") + ' ↗</a></div>' +
        '</section><section class="surface journey-queue" aria-labelledby="summary-queue-title"><div class="summary-heading"><h2 id="summary-queue-title">' + icon("queue") + T("Boarding queue","ఎక్కే వరుస") + '</h2><button type="button" class="btn btn-small btn-quiet" id="open-summary-queue">' + T("Open","తెరవండి") + icon("arrow") + '</button></div><div id="queue-summary-body"></div></section></div></div>' +
      '<section class="quick-destinations" aria-labelledby="quick-title"><div class="split-heading"><h2 id="quick-title">' + T("Destinations","గమ్యాలు") + '</h2><span id="quick-origin"></span></div><div id="destination-shortcuts" class="destination-shortcut-list"></div></section>' +
      '<details class="all-places-details"><summary>' + T("All Warangal places","వరంగల్‌లోని అన్ని ప్రదేశాలు") + '<span>' + places.length + ' ' + T("places","ప్రదేశాలు") + '</span></summary><div class="location-grid">' + places.map(p => '<button type="button" class="location-row" data-destination-id="' + p.id + '"><span class="location-pin">' + icon(p.category.includes("Bus") ? "bus" : "pin") + '</span><span><span class="location-name">' + E(name(p)) + '</span><span class="location-meta">' + E(p.area) + ' · ' + E(p.category) + '</span></span></button>').join("") + '</div></details>' +
      '<footer class="workspace-footer"><span>' + T("Warangal simulation · illustrative routes and timings","వరంగల్ సిమ్యులేషన్ · ఊహాత్మక మార్గాలు, సమయాలు") + '</span><button class="btn btn-small btn-quiet" id="read-stop" type="button">' + icon("speaker") + T("Read boarding stop","ఎక్కే ప్రదేశం వినండి") + '</button></footer><dialog id="expanded-route-map" class="map-dialog" aria-label="' + T("Expanded route map","విస్తరించిన మార్గ పటం") + '"></dialog>';
    bindControls();
    loadServices(); loadJourney(false);
    refreshNotices(); refreshQueueSummary();
    timers.push(setInterval(tick,1000));
    timers.push(setInterval(() => {
      if (!$("#results-content")?.contains(document.activeElement)) loadJourney(false, true);
      refreshNotices(); refreshQueueSummary();
    },20000));
    observer = new ResizeObserver(() => { cancelAnimationFrame(mapRequest); mapRequest = requestAnimationFrame(drawMap); });
    observer.observe($("#route-map-wrap"));
    document.fonts?.ready.then(() => {if ($("#route-map-wrap")) drawMap();});
  }

  function bindControls() {
    listen($("#journey-form"), "submit", event => {event.preventDefault(); submitSearch();});
    listen($("#from-place"),"change",() => {
      state.from = Number($("#from-place").value);
      if (state.to === state.from) setDestination(deps.getLocations().find(p => p.id !== state.from)?.id);
      loadServices(); loadJourney(true);
    });
    listen($("#destination"),"input",showMatches);
    listen($("#destination"),"focus",() => {$("#destination").select(); showMatches();});
    listen($("#destination"),"keydown",event => {
      const matches = $$(".destination-option");
      let current = matches.findIndex(node => node.id === $("#destination").getAttribute("aria-activedescendant"));
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault(); if (!matches.length) {showMatches(); return;}
        current = (current + (event.key === "ArrowDown" ? 1 : -1) + matches.length) % matches.length;
        matches.forEach((node,index) => node.setAttribute("aria-selected",String(index === current)));
        $("#destination").setAttribute("aria-activedescendant",matches[current].id); matches[current].scrollIntoView({block:"nearest"});
      } else if(event.key === "Enter" && !$("#destination-matches").hidden && current >= 0) {
        event.preventDefault(); chooseDestination(Number(matches[current].dataset.matchId));
      } else if(event.key === "Escape") {event.preventDefault(); closeMatches();}
    });
    listen($("#destination-matches"),"click",event => {const option = event.target.closest("[data-match-id]"); if(option) chooseDestination(Number(option.dataset.matchId));});
    listen(document,"pointerdown",event => {if(!event.target.closest(".destination-picker")) closeMatches();});
    listen($("#swap-places"),"click",() => {
      const old = state.from; state.from = state.to; setDestination(old); $("#from-place").value = String(state.from);
      loadServices(); loadJourney(true);
    });
    listen($("#voice-search"),"click",voiceSearch);
    listen($("#results-content"),"click",event => {
      const departure = event.target.closest("[data-departure]");
      if (departure) {state.active = Number(departure.dataset.departure); renderService(); selectStop(state.from); drawMap(); return;}
      if (event.target.closest("#save-current-journey")) toggleSaved();
      if (event.target.closest("#read-journey")) readJourney();
      const stop = event.target.closest("[data-route-stop]");
      if (stop) {selectStop(Number(stop.dataset.routeStop)); if (state.mapView === "stops") showMapView("map");}
    });
    listen($("#destination-shortcuts"),"click",event => {const button=event.target.closest("[data-destination-id]");if(button) chooseDestination(Number(button.dataset.destinationId));});
    listen($(".all-places-details"),"click",event => {const button=event.target.closest("[data-destination-id]");if(button) chooseDestination(Number(button.dataset.destinationId));});
    listen($("#open-summary-queue"),"click",() => deps.openQueue(state.tokenStation || queueStation()?.id));
    listen($("#queue-summary-body"),"click",event => {if(event.target.closest("[data-open-queue]")) deps.openQueue(state.tokenStation || queueStation()?.id);});
    listen($("#read-stop"),"click",() => speak(T("Boarding at ","ఎక్కే ప్రదేశం ") + name(place(state.from)) + ". " + T("Simulation service. Check your selected route before boarding.","సిమ్యులేషన్ సర్వీస్. ఎక్కే ముందు ఎంచుకున్న మార్గాన్ని చూడండి."), $("#read-stop")));
    $$("[data-map-view]").forEach(button => listen(button,"click",() => showMapView(button.dataset.mapView)));
    $$("[data-map-zoom]").forEach(button => listen(button,"click",() => zoomMap(button.dataset.mapZoom)));
    listen($("#map-route-stops"),"click",event => {const button=event.target.closest("[data-select-stop]");if(button) selectStop(Number(button.dataset.selectStop));});
    listen($("#map-stop-detail"),"click",event => {
      if(event.target.closest("[data-start-here]")) {state.from=state.selectedStop;$("#from-place").value=String(state.from);if(state.from===state.to)setDestination(deps.getLocations().find(p=>p.id!==state.from)?.id);loadServices();loadJourney(true);}
      if(event.target.closest("[data-go-here]")) chooseDestination(state.selectedStop);
    });
    listen($("#expand-map"),"click",toggleExpanded);
    listen($("#expanded-route-map"),"close",restoreMap);
    bindMapGestures();
  }

  async function loadServices() {
    const from=state.from;
    try {const data=await deps.api("/api/services?from_id="+from);if(from!==state.from)return;state.services=data.services||[];renderShortcuts();}
    catch(error){feedback(error.message);}
  }

  function matchingPlaces(query) {
    const needle=normalize(query);
    return deps.getLocations().filter(p => Number(p.id)!==Number(state.from)).filter(p => {
      const service=state.services.find(s=>Number(s.to_id)===Number(p.id));
      return !needle || [p.name,p.aliases,p.area,namesTE[p.name],service?.route].some(text=>normalize(text).includes(needle));
    });
  }

  function showMatches() {
    const input=$("#destination"), list=$("#destination-matches");if(!input||!list)return;
    const matches=matchingPlaces(input.value);
    list.innerHTML=matches.length?matches.map(p=>{
      const service=state.services.find(s=>Number(s.to_id)===Number(p.id));
      return '<div class="destination-option" id="destination-option-'+p.id+'" role="option" aria-selected="false" data-match-id="'+p.id+'"><span>'+icon(p.category.includes("Bus")?"bus":"pin")+'</span><div><strong>'+E(name(p))+'</strong><small>'+E(service?service.route+" · "+service.duration+" "+T("min journey","నిమిషాల ప్రయాణం"):p.area)+'</small></div></div>';
    }).join(""):'<div class="destination-no-match">'+T("No matching place. Try Warangal, Kazipet or a SIM number.","సరిపోలే ప్రదేశం లేదు. వరంగల్ లేదా కాజీపేట ప్రయత్నించండి.")+'</div>';
    list.hidden=false;input.setAttribute("aria-expanded","true");input.removeAttribute("aria-activedescendant");
  }
  function closeMatches(){const list=$("#destination-matches");if(list)list.hidden=true;$("#destination")?.setAttribute("aria-expanded","false");$("#destination")?.removeAttribute("aria-activedescendant");}
  function setDestination(id){state.to=Number(id);if($("#to-place"))$("#to-place").value=String(id);if($("#destination"))$("#destination").value=name(place(id));}
  function chooseDestination(id){if(Number(id)===Number(state.from)){feedback(T("Choose a destination different from your boarding place.","ఎక్కే ప్రదేశం కాకుండా మరో గమ్యాన్ని ఎంచుకోండి."));return;}setDestination(id);closeMatches();loadJourney(true);}
  function submitSearch() {
    const input=$("#destination");const current=place($("#to-place").value);
    if(current && normalize(input.value)===normalize(name(current))){state.to=Number(current.id);closeMatches();loadJourney(true);return;}
    const matches=matchingPlaces(input.value);
    const exact=matches.find(p=>{
      const service=state.services.find(s=>Number(s.to_id)===Number(p.id));
      return [p.name,namesTE[p.name],service?.route,...String(p.aliases||"").split(";")].some(text=>text && normalize(text)===normalize(input.value));
    });
    if(exact || matches.length===1){chooseDestination((exact||matches[0]).id);}
    else {showMatches();input.focus();feedback(matches.length?T("Choose a destination from the matches.","సరిపోలిన గమ్యాలలో ఒకదాన్ని ఎంచుకోండి."):T("No place matched. Search a Warangal place or SIM service.","వరంగల్ ప్రదేశం లేదా SIM సర్వీస్ కోసం శోధించండి."));}
  }
  function feedback(text){if($("#search-feedback"))$("#search-feedback").textContent=text;}

  async function loadJourney(record, refresh=false) {
    const from=Number($("#from-place")?.value||state.from), to=Number($("#to-place")?.value||state.to);
    if(from===to){feedback(T("Choose two different places.","రెండు వేర్వేరు ప్రదేశాలను ఎంచుకోండి."));return;}
    state.from=from;state.to=to;
    const sequence=++requestId, activeTime=selected()?.departure_at;
    if(!refresh){feedback(T("Finding services…","సర్వీసుల కోసం చూస్తున్నాం…"));$("#results-content")?.setAttribute("aria-busy","true");}
    try{
      const data=record?await deps.api("/api/passenger/search",{method:"POST",body:JSON.stringify({from_id:from,to_id:to})}):await deps.api("/api/journey?from_id="+from+"&to_id="+to);
      if(sequence!==requestId || !$("#from-place"))return;
      state.results=data.options||[];state.operatorEntries=data.operator_entries||[];state.updated=Date.now();
      state.active=refresh?Math.max(0,state.results.findIndex(item=>item.departure_at===activeTime)):0;
      if(!refresh){state.zoom=1;state.x=0;state.y=0;state.selectedStop=from;}
      renderService();
      if(!refresh){renderMapStops();selectStop(state.selectedStop);renderShortcuts();refreshQueueSummary();}
      drawMap();
      $("#results-content")?.setAttribute("aria-busy","false");
      feedback("");
      if(record){try{localStorage.setItem("nilaya-recent-journey",JSON.stringify({from_id:from,to_id:to}));}catch(_){}}
    }catch(error){if(sequence!==requestId)return;$("#results-content")?.setAttribute("aria-busy","false");feedback(error.message);}
  }

  function renderService() {
    const service=selected(), node=$("#results-content");if(!node)return;
    if(!service){node.innerHTML='<div class="journey-loading">'+T("Choose another destination to see a service.","సర్వీస్ చూడటానికి మరో గమ్యాన్ని ఎంచుకోండి.")+'</div>';return;}
    const openDetails=$$("details[open]",node).map(detail=>detail.dataset.keepOpen);
    const stopRows=(service.stops||[]).map((stop,index,array)=>
      '<li class="'+(index===0?'is-boarding':index===array.length-1?'is-destination':'')+'"><button type="button" data-route-stop="'+stop.id+'"><span class="stop-line-dot"></span><span><strong>'+E(name(stop))+(index===0?'<span class="boarding-label">'+T("Board here","ఇక్కడ ఎక్కండి")+'</span>':'')+'</strong><small>'+ (index===0?E(stop.area)+" · "+T("Starting stop","ప్రారంభ స్టాప్"):index===array.length-1?T("Your destination","మీ గమ్యం")+' · '+stop.offset_minutes+' '+T("min ride","నిమిషాల ప్రయాణం"):'+'+stop.offset_minutes+' '+T("min from boarding","నిమిషాలు")) +'</small></span>'+ (index===array.length-1?icon("pin"):'')+'</button></li>'
    ).join("");
    node.innerHTML='<div class="selected-service-top"><span class="service-route-badge">'+icon("bus")+E(service.route)+'</span><span class="route-direction">'+T("Toward ","దిశ: ")+E(place(state.to)?.area||"Warangal")+'</span><button class="btn btn-small save-trip" id="save-current-journey" type="button" aria-pressed="false">'+icon("bookmark")+'<span>'+T("Save trip","సేవ్ చేయండి")+'</span></button></div>'+
      '<h2 class="selected-destination">'+T("To ","గమ్యం: ")+E(name(place(state.to)))+'</h2>'+
      '<div class="arrival-readouts"><div><span>'+T("Arrives in","చేరుకునే సమయం")+'</span><strong id="arrival-countdown"></strong></div><div><span>'+T("Boarding window · IST","ఎక్కే సమయం · IST")+'</span><strong id="arrival-window"></strong></div></div>'+
      '<div class="journey-freshness"><span class="simulation-signal">'+T("Simulated arrival","సిమ్యులేషన్ రాక")+'</span><span id="journey-freshness"></span></div>'+
      '<div class="ride-facts"><span>'+icon("clock")+service.duration_minutes+' '+T("min ride","నిమిషాల ప్రయాణం")+'</span><span>'+T("Every ","ప్రతి ")+service.headway_minutes+' '+T("min","నిమిషాలకు")+'</span><span>'+Math.max(0,(service.stops||[]).length-1)+' '+T("stops","స్టాప్‌లు")+'</span></div>'+
      '<ol class="journey-stop-timeline">'+stopRows+'</ol>'+
      '<div class="selected-trip-actions"><button class="btn btn-small btn-quiet" id="read-journey" type="button">'+icon("speaker")+T("Read journey","ప్రయాణం వినండి")+'</button><details class="arrival-explainer" data-keep-open="arrival"><summary>'+T("Arrival details","రాక వివరాలు")+'</summary><p>'+T("The window shows when this simulated bus reaches your boarding stop. The route, intermediate stops and two-minute window are illustrative. Your destination arrival is ","సిమ్యులేషన్ బస్సు ఎక్కే ప్రదేశానికి చేరుకునే సమయం ఇది. మార్గం, స్టాప్‌లు, రెండు నిమిషాల సమయ పరిధి ఊహాత్మకమైనవి. గమ్యానికి చేరుకునే సమయం ")+E(service.arrival)+'.</p></details></div>'+
      '<details class="later-services" data-keep-open="later"><summary>'+T("Later services","తదుపరి సర్వీసులు")+'<span>'+Math.max(0,state.results.length-1)+' '+T("more","మరిన్ని")+'</span></summary><div>'+state.results.map((item,index)=>'<button type="button" class="departure-option trip-result" data-departure="'+index+'" aria-pressed="'+(index===state.active)+'"><span>'+E(item.route)+'<small>'+item.duration_minutes+' '+T("min ride","నిమిషాల ప్రయాణం")+'</small></span><strong>'+E(item.departure)+' <span>→</span> '+E(item.arrival)+'</strong><span class="departure-chosen">'+(index===state.active?icon("check"):'')+'</span></button>').join("")+'</div></details>'+
      deps.operatorEntryMarkup(state.operatorEntries||[]);
    openDetails.forEach(key=>{$('[data-keep-open="'+key+'"]',node)?.setAttribute("open","");});
    updateSaved();tick();
  }

  function updateSaved(){
    const exists=deps.savedJourneys().some(row=>Number(row.from_id)===state.from && Number(row.to_id)===state.to);
    const button=$("#save-current-journey");if(!button)return;
    button.setAttribute("aria-pressed",String(exists));$("span",button).textContent=exists?T("Saved","సేవ్ అయింది"):T("Save trip","సేవ్ చేయండి");
  }
  function toggleSaved(){
    const rows=deps.savedJourneys();const exists=rows.some(row=>Number(row.from_id)===state.from && Number(row.to_id)===state.to);
    try{if(exists){localStorage.setItem("nilaya-saved-journeys",JSON.stringify(rows.filter(row=>!(Number(row.from_id)===state.from && Number(row.to_id)===state.to))));deps.toast(T("Trip removed from saved.","సేవ్ చేసిన ప్రయాణం తీసివేయబడింది."));}else deps.saveJourney(place(state.from),place(state.to));updateSaved();}
    catch(_){deps.toast(T("Could not save. Check browser storage and try again.","సేవ్ కాలేదు. బ్రౌజర్ నిల్వను తనిఖీ చేసి మళ్లీ ప్రయత్నించండి."),true);}
  }

  function tick(){
    const service=selected();if(!service||!$("#arrival-countdown"))return;
    const first=Math.max(0,Math.ceil((new Date(service.departure_at)-Date.now())/60000)),last=Math.max(0,Math.ceil((new Date(service.departure_at).getTime()+120000-Date.now())/60000));
    $("#arrival-countdown").textContent=first===0?T("Boarding now","ఇప్పుడు ఎక్కండి"):first+"–"+last+" "+T("min","నిమి");
    $("#arrival-window").textContent=clock(service.departure_at)+"–"+clock(new Date(service.departure_at).getTime()+120000);
    $("#journey-freshness").textContent=T("Updated ","నవీకరించబడింది: ")+Math.floor((Date.now()-state.updated)/1000)+T("s ago"," సెకన్ల క్రితం");
    $$("[data-hold-until]").forEach(node=>{const seconds=Math.max(0,Math.ceil((new Date(node.dataset.holdUntil)-Date.now())/1000));node.textContent=Math.floor(seconds/60)+":"+String(seconds%60).padStart(2,"0")+" "+T("left","మిగిలింది");});
  }

  function renderShortcuts(){
    const node=$("#destination-shortcuts");if(!node)return;
    let recent;try{recent=JSON.parse(localStorage.getItem("nilaya-recent-journey")||"null");}catch(_){}
    const preferred=["Thousand Pillar Temple","Kazipet Bus Stop","Warangal Fort","Bhadrakali Temple"].map(label=>deps.getLocations().find(p=>p.name===label)).filter(p=>p&&p.id!==state.from);
    if(recent?.from_id===state.from && place(recent.to_id) && recent.to_id!==state.from && !preferred.some(p=>p.id===recent.to_id))preferred.unshift(place(recent.to_id));
    node.innerHTML=preferred.slice(0,4).map(p=>{const service=state.services.find(s=>Number(s.to_id)===p.id);return '<button type="button" class="destination-shortcut" data-destination-id="'+p.id+'"><span><strong>'+E(name(p))+'</strong><small>'+E(service?service.route+" · "+service.duration+" "+T("min ride","నిమిషాల ప్రయాణం"):p.area)+'</small></span>'+icon("arrow")+'</button>';}).join("");
    $("#quick-origin").textContent=T("From ","నుంచి: ")+name(place(state.from));
  }

  function queueStation(){
    const origin=place(state.from), stations=deps.getLocations().filter(p=>p.category.includes("Bus"));
    if(!origin)return stations[0];
    return stations.sort((a,b)=>Math.hypot(a.lat-origin.lat,a.lon-origin.lon)-Math.hypot(b.lat-origin.lat,b.lon-origin.lon))[0];
  }
  async function refreshQueueSummary(){
    const node=$("#queue-summary-body");if(!node||node.contains(document.activeElement))return;
    try{
      const data=await deps.api("/api/queue");if(!$("#queue-summary-body"))return;
      const station=queueStation(), mineId=Number(localStorage.getItem("nilaya-demo-token")||0);
      const mine=(data.tokens||[]).find(token=>Number(token.id)===mineId), tokens=(data.tokens||[]).filter(token=>Number(token.location_id)===station?.id);
      state.tokenStation = mine ? Number(mine.location_id) : null;
      const summaryStation = mine ? place(mine.location_id) : station;
      deps.updateQueueBadge?.(mine);
      const status=mine?mine.status.replaceAll("_"," ").toLocaleLowerCase():"";
      $("#queue-summary-body").innerHTML='<p class="queue-summary-place">'+E(name(summaryStation) || mine?.location_name || "")+'</p>'+
        (mine?'<div class="queue-summary-ticket"><strong>'+E(mine.token)+'</strong><div><span>'+E(status)+'</span><small>'+T("Original sequence ","అసలు క్రమం ")+mine.sequence_no+'</small></div>'+(mine.status==="AWAY_PROTECTED"?'<span class="hold-readout" data-hold-until="'+E(mine.hold_expires_at)+'"></span>':'')+'</div>':'<p class="queue-summary-copy">'+(tokens.length?tokens.length+" "+T("waiting at this stop","మంది ఈ స్టాప్‌లో వేచి ఉన్నారు"):T("No one waiting at this stop.","ఈ స్టాప్‌లో ఎవరూ వేచి లేరు."))+'</p>')+
        '<button class="btn btn-small" type="button" data-open-queue>'+ (mine?T("Manage your token","మీ టోకెన్‌ను నిర్వహించండి"):T("Join simulation queue","సిమ్యులేషన్ వరుసలో చేరండి"))+icon("arrow")+'</button>';
      tick();
    }catch(error){if($("#queue-summary-body"))$("#queue-summary-body").textContent=error.message;}
  }
  async function refreshNotices(){
    try{const data=await deps.api("/api/announcements");if($("#journey-notices"))$("#journey-notices").innerHTML=(data.announcements||[]).map(deps.noticeMarkup).join("");}catch(_){}
  }

  function routeStops(){return selected()?.stops||[place(state.from),place(state.to)].filter(Boolean);}
  function renderMapStops(){
    const stops=routeStops(), node=$("#map-route-stops");if(!node)return;
    node.innerHTML=stops.map((stop,index)=>'<button type="button" data-select-stop="'+stop.id+'" aria-pressed="'+(stop.id===state.selectedStop)+'"><span class="map-list-number">'+(index+1)+'</span><span><strong>'+E(name(stop))+'</strong><small>'+ (index===0?T("Board here","ఇక్కడ ఎక్కండి"):index===stops.length-1?T("Your destination","మీ గమ్యం"):'+'+stop.offset_minutes+' '+T("min","నిమిషాలు"))+'</small></span>'+icon("pin")+'</button>').join("");
  }
  function selectStop(id){
    const stop=place(id);if(!stop)return;state.selectedStop=Number(id);
    const index=routeStops().findIndex(p=>Number(p.id)===Number(id));
    const label=id===state.from?T("Board here","ఇక్కడ ఎక్కండి"):id===state.to?T("Your destination","మీ గమ్యం"):T("Along this route","ఈ మార్గంలో");
    if($("#map-stop-detail"))$("#map-stop-detail").innerHTML='<div><strong>'+E(name(stop))+'</strong><small>'+E(stop.area)+' · '+label+'</small></div><div class="map-stop-actions"><button class="btn btn-small btn-quiet" type="button" data-start-here '+(id===state.from?'disabled':'')+'>'+T("Start here","ఇక్కడ ప్రారంభం")+'</button><button class="btn btn-small" type="button" data-go-here '+(id===state.from||id===state.to?'disabled':'')+'>'+T("Go here","ఇక్కడికి వెళ్లండి")+'</button></div>';
    $$("[data-select-stop]").forEach(button=>button.setAttribute("aria-pressed",String(Number(button.dataset.selectStop)===Number(id))));
    $$("[data-map-stop]").forEach(group=>group.classList.toggle("selected-stop",Number(group.dataset.mapStop)===Number(id)));
  }
  function showMapView(view){
    state.mapView=view;
    $("#route-map-wrap").hidden=view!=="map";$("#map-route-stops").hidden=view!=="stops";
    $$("[data-map-view]").forEach(button=>button.setAttribute("aria-pressed",String(button.dataset.mapView===view)));
    if(view==="map")drawMap();
  }
  function transformMap(){const group=$("#map-camera");if(group){const w=Number(group.dataset.width),h=Number(group.dataset.height);group.setAttribute("transform","translate("+state.x+" "+state.y+") translate("+w/2+" "+h/2+") scale("+state.zoom+") translate("+(-w/2)+" "+(-h/2)+")");}}
  function zoomMap(action){if(action==="fit"){state.zoom=1;state.x=0;state.y=0;}else state.zoom=Math.min(3.5,Math.max(.65,state.zoom*(action==="in"?1.25:.8)));transformMap();}

  function drawMap(){
    const wrap=$("#route-map-wrap"), drawing=$("#route-map-drawing");if(!wrap||!drawing||wrap.hidden)return;
    const stops=routeStops();if(stops.length<2)return;
    const focusedMarker=drawing.contains(document.activeElement)?document.activeElement.closest("[data-map-stop]")?.dataset.mapStop:null;
    const w=Math.max(280,wrap.clientWidth),h=Math.max(280,wrap.clientHeight);
    const minLon=Math.min(...stops.map(p=>p.lon)),maxLon=Math.max(...stops.map(p=>p.lon)),minLat=Math.min(...stops.map(p=>p.lat)),maxLat=Math.max(...stops.map(p=>p.lat));
    const spanX=Math.max(.012,maxLon-minLon),spanY=Math.max(.008,maxLat-minLat);
    const scale=Math.min((w-150)/spanX,(h-120)/spanY);
    const project=p=>({x:w/2+(p.lon-(minLon+maxLon)/2)*scale,y:h/2-(p.lat-(minLat+maxLat)/2)*scale});
    const points=stops.map(project),path=points.map((p,index)=>(index?"L":"M")+p.x+","+p.y).join(" ");
    const networkNames=["Warangal Fort","Warangal Railway Station","Warangal City Bus Station","MGM Government Hospital","Bhadrakali Temple","Thousand Pillar Temple","Hanamkonda City Bus Station","Kazipet Bus Stop"];
    const network=networkNames.map(label=>deps.getLocations().find(p=>p.name===label)).filter(Boolean).map(project);
    const networkPath=network.map((p,index)=>(index?"L":"M")+p.x+","+p.y).join(" ");
    const labelBoxes=[], measure=document.createElement("canvas").getContext("2d");measure.font="500 12px Geist, sans-serif";
    const markers=stops.map((stop,index)=>{
      const p=points[index], text=shortName(name(stop)),textWidth=Math.min(w-30,measure.measureText(text).width);
      const candidates=[{x:p.x+15,y:p.y-16,anchor:"start"},{x:p.x-15,y:p.y+28,anchor:"end"},{x:p.x-15,y:p.y-16,anchor:"end"},{x:p.x+15,y:p.y+28,anchor:"start"},{x:p.x,y:p.y-24,anchor:"middle"}];
      let label="";
      for(const option of candidates){const left=option.anchor==="start"?option.x:option.anchor==="end"?option.x-textWidth:option.x-textWidth/2;const box={left,right:left+textWidth,top:option.y-13,bottom:option.y+4};if(box.left<10||box.right>w-10||box.top<8||box.bottom>h-28||box.right>w-64&&box.bottom>h-145)continue;if(labelBoxes.some(b=>box.left<b.right+8&&box.right>b.left-8&&box.top<b.bottom+7&&box.bottom>b.top-7))continue;labelBoxes.push(box);label='<text class="route-place-label" x="'+option.x+'" y="'+option.y+'" text-anchor="'+option.anchor+'">'+E(text)+'</text>';break;}
      return '<g class="route-place-marker '+(stop.id===state.selectedStop?'selected-stop ':'')+(index===0?'origin-marker':'')+'" tabindex="0" role="button" data-map-stop="'+stop.id+'" aria-label="'+E(name(stop))+' · '+(index===0?T("Board here","ఇక్కడ ఎక్కండి"):index===stops.length-1?T("Your destination","మీ గమ్యం"):T("Route stop","మార్గంలోని స్టాప్"))+'"><circle class="marker-hit" cx="'+p.x+'" cy="'+p.y+'" r="21"/><circle class="marker-selection" cx="'+p.x+'" cy="'+p.y+'" r="15"/><circle class="marker-dot" cx="'+p.x+'" cy="'+p.y+'" r="'+(index===0?9:6)+'"/>'+label+'</g>';
    }).join("");
    const a=points[0],b=points[1],dx=b.x-a.x,dy=b.y-a.y,length=Math.hypot(dx,dy)||1;
    const eta=Math.max(0,(new Date(selected()?.departure_at)-Date.now())/60000),distance=Math.min(80,20+eta*3);
    const bus={x:Math.max(28,Math.min(w-42,a.x-dx/length*distance)),y:Math.max(24,Math.min(h-44,a.y-dy/length*distance))};
    if(bus.x>w-72 && bus.y>h-155)bus.x=w-90;
    drawing.innerHTML='<svg id="route-map-svg" viewBox="0 0 '+w+' '+h+'" aria-label="'+E(stops.map(name).join(" → "))+'"><g id="map-camera" data-width="'+w+'" data-height="'+h+'"><rect x="-2000" y="-2000" width="5000" height="5000" class="street-ground"/><g class="street-layout" transform="scale('+w/760+' '+h/440+')"><path class="city-blocks" d="m30 40 190-20 30 90-190 30Zm260-20 180 10-20 95-170-10Zm200 10 215 30-30 80-205-20ZM55 190l180-35 20 90-185 30Zm250-30 160 5-20 90-170 5Zm185 25 200-20 40 70-220 40ZM70 315l170-25 25 100-190 30Zm240-10 160-10 10 110-170 5Zm225-10 180-20-20 130-165 10Z"/><path class="minor-streets" d="M130-100v700M345-100v700M580-100v700M-100 65h1000M-100 215h1000M-100 370h1000"/><path class="major-streets" d="M-60 165 215 120 480 155 850 110M-60 305 260 260 510 290 850 250M250-100 270 140 250 250 285 600M485-100 455 130 485 275 505 600M65-100 40 150 90 280 70 600M760-100 675 130 710 270 660 600M-60 440 210 350 405 335 850 370"/></g><path class="corridor-road" d="'+networkPath+'"/><path class="selected-route-underlay" d="'+path+'"/><path class="selected-route-line" d="'+path+'"/>'+markers+'<g class="simulated-bus-marker" transform="translate('+bus.x+' '+bus.y+')" role="img" aria-label="'+E(selected()?.route||"SIM")+' simulated bus"><rect x="-22" y="-12" width="44" height="25" rx="5"/><text text-anchor="middle" y="4">BUS</text></g></g></svg>';
    transformMap();
    if(focusedMarker)$('[data-map-stop="'+focusedMarker+'"]',drawing)?.focus({preventScroll:true});
  }

  function bindMapGestures(){
    const wrap=$("#route-map-wrap");let drag;
    listen(wrap,"click",event=>{const marker=event.target.closest("[data-map-stop]");if(marker)selectStop(Number(marker.dataset.mapStop));});
    listen(wrap,"pointerdown",event=>{if(event.target.closest("button,[data-map-stop]"))return;drag={x:event.clientX,y:event.clientY,ox:state.x,oy:state.y};wrap.setPointerCapture(event.pointerId);wrap.classList.add("is-dragging");});
    listen(wrap,"pointermove",event=>{if(!drag)return;state.x=drag.ox+event.clientX-drag.x;state.y=drag.oy+event.clientY-drag.y;transformMap();});
    const end=()=>{drag=null;wrap.classList.remove("is-dragging");};listen(wrap,"pointerup",end);listen(wrap,"pointercancel",end);
    listen(wrap,"keydown",event=>{
      const marker=event.target.closest("[data-map-stop]");
      if(marker && (event.key==="Enter"||event.key===" ")){event.preventDefault();selectStop(Number(marker.dataset.mapStop));return;}
      if(event.target!==wrap)return;
      const moves={ArrowLeft:[35,0],ArrowRight:[-35,0],ArrowUp:[0,35],ArrowDown:[0,-35]};
      if(moves[event.key]){event.preventDefault();state.x+=moves[event.key][0];state.y+=moves[event.key][1];transformMap();}
      if(event.key==="+"||event.key==="="){event.preventDefault();zoomMap("in");}
      if(event.key==="-"){event.preventDefault();zoomMap("out");}
      if(event.key==="Home"){event.preventDefault();zoomMap("fit");}
    });
  }

  function toggleExpanded(){
    const dialog=$("#expanded-route-map"), panel=$("#route-map-panel");
    if(dialog.open){dialog.close();return;}
    expandedHome=document.createComment("route map home");panel.before(expandedHome);dialog.append(panel);panel.classList.add("is-expanded");
    $("#expand-map").innerHTML=icon("close");$("#expand-map").setAttribute("aria-label",T("Close expanded map","విస్తరించిన పటాన్ని మూసివేయండి"));$("#expand-map").setAttribute("aria-expanded","true");
    dialog.showModal();document.body.classList.add("route-map-open");$("#expand-map").focus();drawMap();
  }
  function restoreMap(){
    const panel=$("#route-map-panel");if(!panel||!expandedHome)return;
    expandedHome.replaceWith(panel);expandedHome=null;panel.classList.remove("is-expanded");document.body.classList.remove("route-map-open");
    $("#expand-map").innerHTML=icon("expand");$("#expand-map").setAttribute("aria-label",T("Expand map","పటాన్ని విస్తరించండి"));$("#expand-map").setAttribute("aria-expanded","false");$("#expand-map").focus();drawMap();
  }

  function voiceSearch(){
    const Recognition=window.SpeechRecognition||window.webkitSpeechRecognition;
    if(!Recognition){feedback(T("Voice search is not supported here. Type a place or SIM service instead.","ఇక్కడ వాయిస్ శోధనకు మద్దతు లేదు. ప్రదేశాన్ని టైప్ చేయండి."));$("#destination").focus();return;}
    recognition?.abort();recognition=new Recognition();recognition.lang=te()?"te-IN":"en-IN";recognition.interimResults=false;
    recognition.onstart=()=>{feedback(T("Listening… say a Warangal destination.","వింటున్నాం… వరంగల్ గమ్యాన్ని చెప్పండి."));$("#voice-search")?.setAttribute("aria-pressed","true");};
    recognition.onresult=event=>{if(!$("#destination"))return;$("#destination").value=event.results[0][0].transcript;showMatches();feedback(T("Choose the place you meant, then find your route.","మీరు కోరుకున్న ప్రదేశాన్ని ఎంచుకోండి."));};
    recognition.onerror=event=>feedback(event.error==="not-allowed"?T("Microphone permission was declined. You can type your destination.","మైక్రోఫోన్ అనుమతి ఇవ్వలేదు. గమ్యాన్ని టైప్ చేయవచ్చు."):T("Could not hear a destination. Try again or type it.","గమ్యాన్ని వినలేకపోయాం. మళ్లీ ప్రయత్నించండి లేదా టైప్ చేయండి."));
    recognition.onend=()=>$("#voice-search")?.setAttribute("aria-pressed","false");
    try{recognition.start();}catch(_){feedback(T("Could not start the microphone. Type your destination.","మైక్రోఫోన్ ప్రారంభం కాలేదు. గమ్యాన్ని టైప్ చేయండి."));}
  }
  function speak(text,button){
    if(!window.speechSynthesis){deps.toast(T("Read aloud is not supported in this browser.","ఈ బ్రౌజర్‌లో చదివి వినిపించడం సాధ్యం కాదు."));return;}
    if(speaking){speechSynthesis.cancel();speaking=false;button?.setAttribute("aria-pressed","false");return;}
    speechSynthesis.cancel();const utterance=new SpeechSynthesisUtterance(text);utterance.lang=te()?"te-IN":"en-IN";utterance.rate=.95;
    speaking=true;button?.setAttribute("aria-pressed","true");utterance.onend=utterance.onerror=()=>{speaking=false;button?.setAttribute("aria-pressed","false");};speechSynthesis.speak(utterance);
  }
  function readJourney(){
    const service=selected();if(!service)return;
    speak(T("Simulation journey. Board at ","సిమ్యులేషన్ ప్రయాణం. ఎక్కే ప్రదేశం ")+name(place(state.from))+". "+service.route+". "+$("#arrival-countdown").textContent+". "+T("To ","గమ్యం ")+name(place(state.to))+". "+service.duration_minutes+T(" minute ride. Stops: "," నిమిషాల ప్రయాణం. స్టాప్‌లు: ")+routeStops().map(name).join(", "),$("#read-journey"));
  }
  function open(from,to){state.from=Number(from);setDestination(to);$("#from-place").value=String(from);loadServices();loadJourney(true);}
  return {render,destroy,open,language:()=>te()?"te":"en"};
};

