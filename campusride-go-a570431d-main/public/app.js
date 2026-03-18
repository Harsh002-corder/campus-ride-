const TMU_CENTER = { lat: 28.8244, lng: 78.6579 };
const DEFAULT_ZOOM = 16;
const GPS_EMIT_INTERVAL_MS = 2000;
const ROUTE_REFRESH_MS = 1200;

// Frontend realtime tracking runtime state.

let map;
let socket;
let watchId = null;
let simulationIntervalId = null;
let routeTimer = null;

let directionsService;
let directionsRenderer;

let driverMarker = null;
let passengerMarker = null;

let latestDriverLocation = null;
let latestPassengerLocation = null;

let currentRole = "passenger";
let currentRideId = "demo-ride-1";
let currentName = "Campus User";
let rideStatus = "requested";

let lastDriverEmitAt = 0;
let lastPassengerEmitAt = 0;

const roleSelect = document.getElementById("roleSelect");
const nameInput = document.getElementById("nameInput");
const rideIdInput = document.getElementById("rideIdInput");
const connectBtn = document.getElementById("connectBtn");
const acceptBtn = document.getElementById("acceptBtn");
const completeBtn = document.getElementById("completeBtn");

const driverNameEl = document.getElementById("driverName");
const distanceTextEl = document.getElementById("distanceText");
const etaTextEl = document.getElementById("etaText");
const rideStatusEl = document.getElementById("rideStatus");
const statusPillEl = document.getElementById("statusPill");
const modeTextEl = document.getElementById("modeText");

function createSvgDataUri(svg) {
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

const driverIconUrl = createSvgDataUri(`
<svg xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 44 44">
  <circle cx="22" cy="22" r="20" fill="#1d4ed8" opacity="0.92"/>
  <path d="M12 24h20l-2-8c-.3-1.2-1.4-2-2.6-2H16.6c-1.2 0-2.3.8-2.6 2l-2 8z" fill="#fff"/>
  <circle cx="17" cy="27" r="3" fill="#0f172a"/>
  <circle cx="27" cy="27" r="3" fill="#0f172a"/>
</svg>
`);

const passengerIconUrl = createSvgDataUri(`
<svg xmlns="http://www.w3.org/2000/svg" width="42" height="42" viewBox="0 0 42 42">
  <circle cx="21" cy="21" r="19" fill="#059669" opacity="0.94"/>
  <circle cx="21" cy="14" r="5" fill="#fff"/>
  <path d="M12 30c0-5 4-9 9-9s9 4 9 9" fill="#fff"/>
</svg>
`);

function loadGoogleMaps() {
  return new Promise((resolve, reject) => {
    if (window.google?.maps) {
      resolve();
      return;
    }

    const apiKey = window.GOOGLE_MAPS_API_KEY;
    if (!apiKey || apiKey === "YOUR_GOOGLE_MAPS_API_KEY") {
      reject(new Error("Missing Google Maps API key. Set window.GOOGLE_MAPS_API_KEY in index.html"));
      return;
    }

    const callbackName = `initCampusMap_${Date.now()}`;
    window[callbackName] = () => {
      delete window[callbackName];
      resolve();
    };

    const script = document.createElement("script");
    script.async = true;
    script.defer = true;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=geometry&callback=${callbackName}`;
    script.onerror = () => reject(new Error("Failed to load Google Maps script"));
    document.head.appendChild(script);
  });
}

function getQueryParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    role: params.get("role") || "passenger",
    name: params.get("name") || "Campus User",
    rideId: params.get("rideId") || "demo-ride-1",
  };
}

function setQueryParams(role, name, rideId) {
  const params = new URLSearchParams(window.location.search);
  params.set("role", role);
  params.set("name", name);
  params.set("rideId", rideId);
  const nextUrl = `${window.location.pathname}?${params.toString()}`;
  window.history.replaceState({}, "", nextUrl);
}

function setRideStatus(status) {
  rideStatus = status;
  rideStatusEl.textContent = status;
  statusPillEl.textContent = `Status: ${status}`;
}

function ensureMarker(type) {
  if (!map) return null;

  if (type === "driver") {
    if (!driverMarker) {
      driverMarker = new google.maps.Marker({
        map,
        title: "Driver",
        icon: {
          url: driverIconUrl,
          scaledSize: new google.maps.Size(36, 36),
          anchor: new google.maps.Point(18, 18),
        },
      });
    }
    return driverMarker;
  }

  if (!passengerMarker) {
    passengerMarker = new google.maps.Marker({
      map,
      title: "Passenger",
      icon: {
        url: passengerIconUrl,
        scaledSize: new google.maps.Size(34, 34),
        anchor: new google.maps.Point(17, 17),
      },
    });
  }
  return passengerMarker;
}

function animateMarker(marker, targetLocation, duration = 900) {
  // Smooth marker transition so movement looks natural, not jumpy.
  if (!marker) return;

  const startPosition = marker.getPosition();
  if (!startPosition) {
    marker.setPosition(targetLocation);
    return;
  }

  const start = { lat: startPosition.lat(), lng: startPosition.lng() };
  const end = { lat: targetLocation.lat, lng: targetLocation.lng };

  const startedAt = performance.now();

  function frame(now) {
    const progress = Math.min((now - startedAt) / duration, 1);
    const eased = progress < 0.5
      ? 2 * progress * progress
      : 1 - Math.pow(-2 * progress + 2, 2) / 2;

    const next = {
      lat: start.lat + (end.lat - start.lat) * eased,
      lng: start.lng + (end.lng - start.lng) * eased,
    };

    marker.setPosition(next);

    if (progress < 1) {
      marker._anim = requestAnimationFrame(frame);
    }
  }

  if (marker._anim) {
    cancelAnimationFrame(marker._anim);
  }

  marker._anim = requestAnimationFrame(frame);
}

function fitDriverPassengerBounds() {
  if (!map || !latestDriverLocation || !latestPassengerLocation) return;
  const bounds = new google.maps.LatLngBounds();
  bounds.extend(latestDriverLocation);
  bounds.extend(latestPassengerLocation);
  map.fitBounds(bounds, 80);
}

function scheduleRouteRefresh() {
  if (routeTimer) {
    clearTimeout(routeTimer);
  }
  routeTimer = setTimeout(updateRouteAndEta, ROUTE_REFRESH_MS);
}

function updateRouteAndEta() {
  // Recompute route/ETA between driver and passenger using Directions API.
  if (!directionsService || !directionsRenderer || !latestDriverLocation || !latestPassengerLocation) {
    return;
  }

  directionsService.route(
    {
      origin: latestDriverLocation,
      destination: latestPassengerLocation,
      travelMode: google.maps.TravelMode.DRIVING,
      optimizeWaypoints: false,
    },
    (result, status) => {
      if (status !== "OK" || !result) {
        distanceTextEl.textContent = "--";
        etaTextEl.textContent = "--";
        return;
      }

      directionsRenderer.setDirections(result);

      const leg = result.routes?.[0]?.legs?.[0];
      distanceTextEl.textContent = leg?.distance?.text || "--";
      etaTextEl.textContent = leg?.duration?.text || "--";
    },
  );
}

function emitLocationWithThrottle(type, location) {
  if (!socket || !location) return;

  const now = Date.now();
  if (type === "driver") {
    if (now - lastDriverEmitAt < GPS_EMIT_INTERVAL_MS) return;
    lastDriverEmitAt = now;
    socket.emit("driverLocationUpdate", location);
    return;
  }

  if (now - lastPassengerEmitAt < GPS_EMIT_INTERVAL_MS) return;
  lastPassengerEmitAt = now;
  socket.emit("passengerLocationUpdate", location);
}

function stopGpsAndSimulation() {
  if (watchId !== null && navigator.geolocation) {
    navigator.geolocation.clearWatch(watchId);
    watchId = null;
  }

  if (simulationIntervalId) {
    clearInterval(simulationIntervalId);
    simulationIntervalId = null;
  }
}

function startDriverSimulation() {
  // Test mode: simulate driver movement if GPS is unavailable.
  modeTextEl.textContent = "Mode: Simulation (driver)";

  let t = 0;
  let simulated = latestDriverLocation || {
    lat: TMU_CENTER.lat + 0.0016,
    lng: TMU_CENTER.lng - 0.0018,
  };

  simulationIntervalId = setInterval(() => {
    t += 0.22;

    const target = latestPassengerLocation || TMU_CENTER;

    simulated = {
      lat: simulated.lat + (target.lat - simulated.lat) * 0.12 + Math.sin(t) * 0.00005,
      lng: simulated.lng + (target.lng - simulated.lng) * 0.12 + Math.cos(t) * 0.00005,
    };

    latestDriverLocation = simulated;
    animateMarker(ensureMarker("driver"), simulated, 1200);
    emitLocationWithThrottle("driver", simulated);
    scheduleRouteRefresh();
  }, GPS_EMIT_INTERVAL_MS);
}

function startLocationSharing() {
  stopGpsAndSimulation();

  if (!navigator.geolocation) {
    if (currentRole === "driver") {
      startDriverSimulation();
      return;
    }
    modeTextEl.textContent = "Mode: GPS unavailable";
    return;
  }

  modeTextEl.textContent = "Mode: GPS";

  watchId = navigator.geolocation.watchPosition(
    (position) => {
      const location = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      };

      if (currentRole === "driver") {
        latestDriverLocation = location;
        animateMarker(ensureMarker("driver"), location);
        emitLocationWithThrottle("driver", location);
      } else {
        latestPassengerLocation = location;
        animateMarker(ensureMarker("passenger"), location);
        emitLocationWithThrottle("passenger", location);
      }

      scheduleRouteRefresh();
      fitDriverPassengerBounds();
    },
    () => {
      if (currentRole === "driver") {
        startDriverSimulation();
      } else {
        modeTextEl.textContent = "Mode: Passenger GPS denied";
      }
    },
    {
      enableHighAccuracy: true,
      timeout: 9000,
      maximumAge: 2000,
    },
  );
}

function connectSocket() {
  if (socket) {
    socket.disconnect();
  }

  socket = io({
    transports: ["websocket", "polling"],
    query: {
      role: currentRole,
      name: currentName,
      rideId: currentRideId,
    },
  });

  socket.on("connect", () => {
    startLocationSharing();
  });

  socket.on("rideState", (state) => {
    if (!state) return;

    driverNameEl.textContent = state.driverName || "Campus Driver";
    setRideStatus(state.status || "requested");

    if (state.driverLocation) {
      latestDriverLocation = state.driverLocation;
      animateMarker(ensureMarker("driver"), state.driverLocation);
    }

    if (state.passengerLocation) {
      latestPassengerLocation = state.passengerLocation;
      animateMarker(ensureMarker("passenger"), state.passengerLocation);
    }

    scheduleRouteRefresh();
    fitDriverPassengerBounds();
  });

  socket.on("driverLocationUpdate", ({ driverName, location }) => {
    if (!location) return;
    if (driverName) driverNameEl.textContent = driverName;

    latestDriverLocation = location;
    animateMarker(ensureMarker("driver"), location);
    scheduleRouteRefresh();
  });

  socket.on("passengerLocationUpdate", ({ location }) => {
    if (!location) return;
    latestPassengerLocation = location;
    animateMarker(ensureMarker("passenger"), location);
    scheduleRouteRefresh();
  });

  socket.on("rideAccepted", ({ status }) => {
    setRideStatus(status || "accepted");
  });

  socket.on("rideCompleted", ({ status }) => {
    setRideStatus(status || "completed");
  });
}

function initMap() {
  map = new google.maps.Map(document.getElementById("map"), {
    center: TMU_CENTER,
    zoom: DEFAULT_ZOOM,
    disableDefaultUI: true,
    zoomControl: true,
    mapTypeControl: false,
    streetViewControl: false,
    fullscreenControl: true,
  });

  directionsService = new google.maps.DirectionsService();
  directionsRenderer = new google.maps.DirectionsRenderer({
    suppressMarkers: true,
    polylineOptions: {
      strokeColor: "#2563eb",
      strokeOpacity: 0.9,
      strokeWeight: 5,
    },
  });
  directionsRenderer.setMap(map);
}

function applyRoleUI() {
  const isDriver = currentRole === "driver";
  acceptBtn.style.display = isDriver ? "inline-block" : "none";
  completeBtn.style.display = isDriver ? "inline-block" : "none";
}

function bindUiEvents() {
  connectBtn.addEventListener("click", () => {
    currentRole = roleSelect.value === "driver" ? "driver" : "passenger";
    currentName = (nameInput.value || "Campus User").trim();
    currentRideId = (rideIdInput.value || "demo-ride-1").trim();

    setQueryParams(currentRole, currentName, currentRideId);
    applyRoleUI();
    connectSocket();
  });

  acceptBtn.addEventListener("click", () => {
    if (socket) socket.emit("rideAccepted");
  });

  completeBtn.addEventListener("click", () => {
    if (socket) socket.emit("rideCompleted");
  });
}

async function bootstrap() {
  try {
    const query = getQueryParams();
    currentRole = query.role === "driver" ? "driver" : "passenger";
    currentName = query.name;
    currentRideId = query.rideId;

    roleSelect.value = currentRole;
    nameInput.value = currentName;
    rideIdInput.value = currentRideId;

    await loadGoogleMaps();
    initMap();
    bindUiEvents();
    applyRoleUI();
    connectSocket();
  } catch (error) {
    const text = error instanceof Error ? error.message : "Map initialization failed";
    statusPillEl.textContent = `Error: ${text}`;
  }
}

bootstrap();
