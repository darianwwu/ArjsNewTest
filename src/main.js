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
let targetCoords = [{ longitude: 7.651058, latitude: 51.935260 }];
let indexActiveMarker = 0;
const currentCoords = { longitude: null, latitude: null };
let screenOrientation = { type: screen.orientation?.type, angle: screen.orientation?.angle};

// DOM-Elemente
const lonInput = document.getElementById("longitude");
const latInput = document.getElementById("latitude");
const distanceOverlay = document.getElementById("distance-overlay");
const markerPopup = document.getElementById("markerPopup");
const closeButton = document.getElementById("popupClose");

// Event-Listener
closeButton.addEventListener("click", () => {
  markerPopup.style.display = "none";
});

screen.orientation.addEventListener("change", (event) => {
  screenOrientation.type = event.target.type;
  screenOrientation.angle = event.target.angle;
});

window.onload = () => {
  const overlayContainer = document.getElementById("overlayContainer");
  const startBtn = document.getElementById("btnStart");
  const hinzufuegenBtn = document.getElementById("btnAddMarker");

  hinzufuegenBtn.addEventListener("click", () => {
    const newMarker = {
      longitude: parseFloat(lonInput.value),
      latitude: parseFloat(latInput.value),
      popupContent: "Dies ist ein Marker!"
    };
    targetCoords.push(newMarker);
    console.log("Neuer Marker hinzugefügt:", newMarker);
  });

  startBtn.addEventListener('click', () => {
    document.body.removeChild(overlayContainer);
    init();
  });
};

// Funktionen
/**
 * Initialisiert die AR-Szene, Kamera und Renderer.
 */
function init() {
  // Szene, Kamera und Renderer initialisieren
  scene = new THREE.Scene();

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambientLight);
  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
  directionalLight.position.set(1, 1, 1);
  scene.add(directionalLight);

  camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.001, 500);
  scene.add(camera);

  renderer = new THREE.WebGLRenderer({ logarithmicDepthBuffer: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  document.body.appendChild(renderer.domElement);

  // Resize-Event-Listener für den Renderer, damit er sich an die Bildschirmgröße anpasst
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

  // LocAR initialisieren
  locar = new LocAR.LocationBased(scene, camera, { gpsMinDistance: 1 });
  cam = new LocAR.WebcamRenderer(renderer);

  // Geräteorientierung initialisieren
  absoluteDeviceOrientationControls = new AbsoluteDeviceOrientationControls(camera);

  // Wir warten nun auf das erste GPS-Update, bevor wir AR-Elemente initialisieren
  let initialPositionSet = false;
  locar.on("gpsupdate", (pos) => {
    currentCoords.longitude = pos.coords.longitude;
    currentCoords.latitude = pos.coords.latitude;
    console.log("GPS Update:", currentCoords);

    // Initialposition und AR-Elemente setzen
    if (!initialPositionSet) {
      initialPositionSet = true;
      addCompass();
      addArrow();
      addAllMarkers();
    }
    
    // AR-Elemente aktualisieren
    if (arrow) arrow.update();
    markers.forEach(markerInstance => markerInstance.update());
    updateDistance(currentCoords, targetCoords[indexActiveMarker], distanceOverlay);
  });

  locar.startGps();
  renderer.setAnimationLoop(animate);
}

/**
 * Fügt die AR-Elemente (Kompass, Navigationspfeil, Zielmarker) zur Szene hinzu.
 */
function addCompass() {
  // Kompass-GUI initialisieren
  compass = new CompassGUI({
    deviceOrientationControl: absoluteDeviceOrientationControls,
    compassArrowId: "compassArrow",
    compassTextId: "compassText",
    getScreenOrientation: () => screenOrientation,
  });
}

function addArrow() {
  // AR-Navigationspfeil initialisieren
  arrow = new ARNavigationArrow({
    locar: locar,
    camera: camera,
    deviceOrientationControl: absoluteDeviceOrientationControls,
    getTargetCoords: () => targetCoords,
    currentCoords: currentCoords,
    isIOS: isIOS,
    getScreenOrientation: () => screenOrientation,
    getIndexActiveMarker: () => indexActiveMarker,
  });
  arrow.initArrow('./glbmodell/Pfeil5.glb');
}

function addMarker(markerData) {
  const marker = new TargetMarker({
    locar: locar,
    camera: camera,
    markerCoords: { latitude: markerData.latitude, longitude: markerData.longitude },
    isIOS: isIOS,
    getScreenOrientation: () => screenOrientation,
    onClick: () => {
      markerPopup.innerText = markerData.popupContent;
      markerPopup.style.display = "block";
    },
    deviceOrientationControl: absoluteDeviceOrientationControls
  });
  marker.initMarker('./images/map-marker.png');
  markers.push(marker);
}

/**
 * Animation Loop
 */
function animate() {
  // Update der AR-Elemente nur, falls initialisiert
  if (arrow) arrow.update();
  markers.forEach(markerInstance => markerInstance.update());
  if(compass) compass.update();
  
  updateDistance(currentCoords, targetCoords[indexActiveMarker], distanceOverlay);
  cam.update();
  absoluteDeviceOrientationControls.update();
  renderer.render(scene, camera);
}

function addAllMarkers() {
  // Über jedes gespeicherte Marker-Datenobjekt iterieren und addMarker aufrufen
  targetCoords.forEach(markerData => {
    addMarker(markerData);
  });
}