import { AbsoluteDeviceOrientationControls, isIOS } from './AbsoluteDeviceOrientationControls.js';
import { THREE } from './AbsoluteDeviceOrientationControls.js';
import * as LocAR from './locar/dist/locar.es.js';
import { CompassGUI } from './compassGUI.js';
import { ARNavigationArrow } from './arNavigationArrow.js';
import { TargetMarker } from './targetMarker.js';
import { updateDistance } from './distanceOverlay.js';

// Globale Variablen
let scene, camera, renderer;
let locar, cam, absoluteDeviceOrientationControls;
let compass;
let arrow = null;
let markers = [];
let targetCoords = [];
let indexActiveMarker = 0;
const currentCoords = { longitude: null, latitude: null };
let screenOrientation = { type: screen.orientation?.type, angle: screen.orientation?.angle };

// LOD-Parameter
const nearDist = 10;   // ab hier beginnt Glättung
const farDist  = 500;  // ab hier maximale Glättung
const kNear    = 1.0;  // reaktiv
const kFar     = 0.05; // stark geglättet

// Haversine-Funktion zur Distanzbestimmung (Meter)
function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = a => a * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLon / 2) ** 2;
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

// DOM-Elemente
const lonInput = document.getElementById("longitude");
const latInput = document.getElementById("latitude");
const distanceOverlay = document.getElementById("distance-overlay");

screen.orientation.addEventListener("change", (event) => {
  screenOrientation.type = event.target.type;
  screenOrientation.angle = event.target.angle;
});

window.onload = () => {
  const overlayContainer = document.getElementById("overlayContainer");
  const startBtn = document.getElementById("btnStart");
  const hinzufuegenBtn = document.getElementById("btnAddMarker");
  const testBtn = document.getElementById("btnTestAdd");

  hinzufuegenBtn.addEventListener("click", () => {
    const newMarker = {
      longitude: parseFloat(lonInput.value),
      latitude: parseFloat(latInput.value),
      popupContent: "Ziel aktualisiert!"
    };
    targetCoords.push(newMarker);
    window.showMarkerPopup("Marker hinzugefügt!", 1500);
  });

  startBtn.addEventListener('click', () => {
    document.body.removeChild(overlayContainer);
    init();
  });

  testBtn.addEventListener('click', () => {
    const testMarker1 = {
      longitude: 7.651058,
      latitude: 51.935260,
      popupContent:
        "Polter 1\n" +
        "Latitude: 51.935260\n" +
        "Longitude: 7.651058\n" +
        "Länge: 13,5 m\n" +
        "Tiefe: 3 m\n" +
        "Durchschnittliche Höhe: 1,60 m\n" +
        "Raummaß: 60,2 Rm"
    };
    const testMarker2 = {
      longitude: 7.651110,
      latitude: 51.933416,
      popupContent:
        "Polter 2\n" +
        "Latitude: 51.933416\n" +
        "Longitude: 7.651110\n" +
        "Länge: 16,5 m\n" +
        "Tiefe: 4 m\n" +
        "Durchschnittliche Höhe: 1,70 m\n" +
        "Raummaß: 93,4 Rm"
    };
    const testMarker3 = {
      longitude: 7.653852,
      latitude: 51.934496,
      popupContent:
        "Lichtung 1\n" +
        "Latitude: 51.934496\n" +
        "Longitude: 7.653852\n" +
        "Größe: 3 ha"
    };
    const testMarker4 = {
      longitude: 7.658851,
      latitude: 51.934513,
      popupContent:
        "Lichtung 2\n" +
        "Latitude: 51.934513\n" +
        "Longitude: 7.658851\n" +
        "Größe: 6 ha"
    };
    const testMarker5 = {
      longitude: 7.648327,
      latitude: 51.934420,
      popupContent:
        "Sonstiger POI 1\n" +
        "Latitude: 51.934420\n" +
        "Longitude: 7.648327"
    };
    targetCoords.push(testMarker1, testMarker2, testMarker3, testMarker4, testMarker5);
    window.showMarkerPopup("5 Marker hinzugefügt!", 1500);
  });
};

function init() {
  // Szene, Kamera, Licht
  scene = new THREE.Scene();
  scene.add(new THREE.AmbientLight(0xffffff, 0.6));
  const dir = new THREE.DirectionalLight(0xffffff, 0.8);
  dir.position.set(1, 1, 1);
  scene.add(dir);

  camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.001, 1000);
  scene.add(camera);

  renderer = new THREE.WebGLRenderer({ logarithmicDepthBuffer: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  document.body.appendChild(renderer.domElement);

  window.addEventListener("resize", () => {
    if (isIOS) {
      setTimeout(() => {
        renderer.setSize(window.innerWidth, window.innerHeight);
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
      }, 200);
    } else {
      renderer.setSize(window.innerWidth, window.innerHeight);
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
    }
  });

  // LocAR und Controls
  locar = new LocAR.LocationBased(scene, camera, { gpsMinDistance: 1 });
  cam = new LocAR.WebcamRenderer(renderer);
  absoluteDeviceOrientationControls = new AbsoluteDeviceOrientationControls(camera);

  let initialSet = false;
  locar.on("gpsupdate", pos => {
    currentCoords.longitude = pos.coords.longitude;
    currentCoords.latitude = pos.coords.latitude;

    if (!initialSet) {
      initialSet = true;
      addCompass();
      addArrow();
      addAllMarkers();
      setActiveMarker(0);
    }

    if (arrow) arrow.update();
    markers.forEach(m => m.update());
    updateDistance(currentCoords, targetCoords[indexActiveMarker], distanceOverlay);
  });

  locar.startGps();
  renderer.setAnimationLoop(animate);
}

function animate() {
  // Progressive LOD: smoothingFactor nach Entfernung
  absoluteDeviceOrientationControls.update();
  if (currentCoords.latitude !== null && targetCoords[indexActiveMarker]) {
    const tgt = targetCoords[indexActiveMarker];
    const d = haversine(currentCoords.latitude, currentCoords.longitude, tgt.latitude, tgt.longitude);
    const t = Math.min(1, Math.max(0, (d - nearDist) / (farDist - nearDist)));
    absoluteDeviceOrientationControls.smoothingFactor = kNear * (1 - t) + kFar * t;
  }

  if (arrow) arrow.update();
  markers.forEach(m => m.update());
  if (compass) compass.update();
  updateDistance(currentCoords, targetCoords[indexActiveMarker], distanceOverlay);
  cam.update();
  renderer.render(scene, camera);
}

function addCompass() {
  compass = new CompassGUI({
    deviceOrientationControl: absoluteDeviceOrientationControls,
    compassArrowId: "compassArrow",
    compassTextId: "compassText",
    getScreenOrientation: () => screenOrientation,
  });
}

function addArrow() {
  arrow = new ARNavigationArrow({
    locar,
    camera,
    deviceOrientationControl: absoluteDeviceOrientationControls,
    getTargetCoords: () => targetCoords,
    currentCoords,
    isIOS,
    getScreenOrientation: () => screenOrientation,
    getIndexActiveMarker: () => indexActiveMarker,
  });
  arrow.initArrow('./glbmodell/Pfeil5.glb');
}

function addMarker(markerData, index) {
  const marker = new TargetMarker({
    locar,
    camera,
    markerCoords: { latitude: markerData.latitude, longitude: markerData.longitude },
    isIOS,
    getScreenOrientation: () => screenOrientation,
    onClick: () => {
      if (index !== indexActiveMarker) {
        setActiveMarker(index);
        window.showMarkerPopup("Ziel aktualisiert!", 5000);
      } else {
        window.showMarkerPopup(markerData.popupContent, 50000);
      }
    },
    deviceOrientationControl: absoluteDeviceOrientationControls
  });
  marker.initMarker('./images/map-marker-schwarz.png');
  markers.push(marker);
}

function addAllMarkers() {
  targetCoords.forEach((md, idx) => addMarker(md, idx));
}

function setActiveMarker(index) {
  indexActiveMarker = index;
  markers.forEach((m, idx) => {
    m.updateMarkerImage(
      idx === indexActiveMarker
        ? './images/map-marker.png'
        : './images/map-marker-schwarz.png'
    );
  });
}