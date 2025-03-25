import { AbsoluteDeviceOrientationControls, isIOS } from './AbsoluteDeviceOrientationControls.js';
import { THREE } from './AbsoluteDeviceOrientationControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as LocAR from './locar/dist/locar.es.js';

// Global variables
var scene, camera, renderer, gltfloader, pfeilARObjekt, zielmarkerARObjekt;
var locar, cam, absoluteDeviceOrientationControls;

var targetCoords = { longitude: 7.651058, latitude: 51.935260 }; // Zielkoordinaten
var currentCoords = { longitude: null, latitude: null }; // Nutzerkoordinaten

const lonInput = document.getElementById("longitude"); // HTML-Inputfeld für Längengrad
const latInput = document.getElementById("latitude"); // HTML-Inputfeld für Breitengrad
const distanceOverlay = document.getElementById("distance-overlay"); // HTML-Distanzanzeige
const compassArrow = document.getElementById("compassArrow"); // Kompass-Pfeil
const compassText = document.getElementById("compassText");// Kompass-Text

/**
 * Onload-Event: Wartet bis die Seite geladen ist, um die Initialisierung zu starten
 * Integriert: Eventlistener für Start-Button, der die init() Funktion aufruft
 */
window.onload = () => {
  console.log("page loaded, proceed to init");
  const overlay = document.getElementById("overlay");
  const startBtn = document.getElementById("btnStart");
  const lonLatInput = document.getElementById("lonlatinput");

  startBtn.addEventListener('click', () => {
    targetCoords.longitude = parseFloat(lonInput.value);
    targetCoords.latitude = parseFloat(latInput.value);
    document.body.removeChild(overlay);
    document.body.removeChild(lonLatInput);
    init();
  });
};

/**
 * Initialisiert die Szene, Kamera, Renderer und LocAR
 * Setzt erstmalig alle AR Objekte und startet den Animation Loop
 * Integriert: Zentraler Event-Listener von LocAR für GPS-Updates
 */
function init() {
  scene = new THREE.Scene();

  // Licht hinzufügen
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambientLight);
  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
  directionalLight.position.set(1, 1, 1);
  scene.add(directionalLight);

  // Kamera und Renderer
  camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.001, 500);
  scene.add(camera);

  renderer = new THREE.WebGLRenderer();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  document.body.appendChild(renderer.domElement);

  window.addEventListener("resize", () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
  });

  // LocAR initialisieren
  locar = new LocAR.LocationBased(scene, camera, { gpsMinDistance: 1});
  cam = new LocAR.WebcamRenderer(renderer);
  absoluteDeviceOrientationControls = new AbsoluteDeviceOrientationControls(camera);

  let firstLocation = true;
  gltfloader = new GLTFLoader();

  locar.on("gpsupdate", (pos, distMoved) => {
    // Bei jedem GPS-Update aktuelle Nutzerdaten setzen
    currentCoords.longitude = pos.coords.longitude;
    currentCoords.latitude = pos.coords.latitude;
    console.log("GPS Update: ", currentCoords);
    if (firstLocation) {
      // Marker-Objekt erstellen (einmalig)
      const textureLoader = new THREE.TextureLoader();
      const markerTexture = textureLoader.load('./images/map-marker.png');
      const markerMaterial = new THREE.SpriteMaterial({ map: markerTexture });
      zielmarkerARObjekt = new THREE.Sprite(markerMaterial);
      zielmarkerARObjekt.scale.set(5, 5, 1);
      locar.add(zielmarkerARObjekt, targetCoords.longitude, targetCoords.latitude);

      // Initialen Pfeil laden (einmalig)
      gltfloader.load('./glbmodell/Pfeil5.glb', function (gltf) {
        pfeilARObjekt = gltf.scene;
        pfeilARObjekt.scale.set(0.3, 0.3, 0.3);
        pfeilARObjekt.traverse(child => child.frustumCulled = false);
        camera.add(pfeilARObjekt);
        pfeilARObjekt.position.set(0, -1, -3);
        updateArrow();
      });

      firstLocation = false;
    } else {
      // Nach erster Initialisierung: nicht neu laden, nur Rotation, Position aktualisieren.
      updateArrow();
    }
    updateDistance();
  });

  locar.startGps();
  renderer.setAnimationLoop(animate);
}

/**
 * Zentraler Loop der Animation
 */
function animate() {
  updateArrow();
  updateDistance();
  updateCompass(); // NEU: Kompass-Update
  cam.update();
  absoluteDeviceOrientationControls.update();
  renderer.render(scene, camera);
}

/**
 * Aktualisiert das Kompass GUI
 * @returns null, wenn keine Geräteorientierung vorhanden ist
 */
function updateCompass() {
  if (!absoluteDeviceOrientationControls.deviceOrientation) return;

  let heading = absoluteDeviceOrientationControls.getAlpha() * (180 / Math.PI);
  if (isIOS && absoluteDeviceOrientationControls.deviceOrientation?.webkitCompassHeading) {
    heading = absoluteDeviceOrientationControls.deviceOrientation.webkitCompassHeading; // Korrektur
  }
  else {
    heading = -heading;
  }  

  // Normalisieren auf 0-360 Grad
  heading = (heading + 360) % 360;

  if (heading !== null) {
    compassArrow.style.transform = `rotate(${-heading}deg)`; // Invertiere Drehung
    compassText.innerText = `${Math.round(heading)}°`;
  }
}


/**
 * Berechnet die Distanz zwischen zwei Punkten auf der Erde
 * @param {*} lat1 Latitude Punkt 1
 * @param {*} lon1 Longitude Punkt 1
 * @param {*} lat2 Latitude Punkt 2
 * @param {*} lon2 Longitude Punkt 2
 * @returns Distanz in Metern
 */
function computeDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const φ1 = THREE.MathUtils.degToRad(lat1);
  const φ2 = THREE.MathUtils.degToRad(lat2);
  const Δφ = THREE.MathUtils.degToRad(lat2 - lat1);
  const Δλ = THREE.MathUtils.degToRad(lon2 - lon1);

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Aktualisiert die Pfeilrotation des glb Modells
 * @returns null, falls keine Koordinaten gesetzt sind
 */
function updateArrow() {
  if (!pfeilARObjekt || currentCoords.longitude === null || currentCoords.latitude === null) {
    return;
  }
  
  // Zielstandort in Weltkoordinaten (x, z von lonLatToWorldCoords; y konstant 1.5)
  const lonlatTarget = locar.lonLatToWorldCoords(targetCoords.longitude, targetCoords.latitude);
  const targetWorldPos = new THREE.Vector3(lonlatTarget[0], 1.5, lonlatTarget[1]);
  
  // Nutzerstandort in Weltkoordinaten (x, z; y konstant 1.5)
  const lonlatUser = locar.lonLatToWorldCoords(currentCoords.longitude, currentCoords.latitude);
  const userWorldPos = new THREE.Vector3(lonlatUser[0], 1.5, lonlatUser[1]);
  
  // Vektor vom Nutzer zum Ziel
  const direction = new THREE.Vector3().subVectors(targetWorldPos, userWorldPos);
  
  // Bestimme den Winkel (in Radianten) des Richtungsvektors in der horizontalen Ebene
  const targetAngle = Math.atan2(direction.x, direction.z);
  
  // Nutzer-Heading (in Radianten) über getAlpha() – dieser Wert ist für beide Plattformen konsistent
  const userHeading = absoluteDeviceOrientationControls.getAlpha();
  
  // Berechne den relativen Winkel
  let relativeAngle = targetAngle - userHeading;
  
  // Korrigiere auf iOS: wenn der Pfeil um 180° falsch ist, addiere π
  //if (isIOS) {
    relativeAngle += Math.PI;
  //}
  
  // Normiere den Winkel auf den Bereich -π ... π (optional)
  relativeAngle = ((relativeAngle + Math.PI) % (2 * Math.PI)) - Math.PI;
  
  // Setze die Rotation des Pfeils (nur um die Y-Achse)
  pfeilARObjekt.rotation.set(0, relativeAngle, 0);
  
  // Debug-Ausgaben Test
  console.log("UserWorldPos:", userWorldPos);
  console.log("TargetWorldPos:", targetWorldPos);
  console.log("Direction:", direction);
  console.log("Target angle (rad):", targetAngle);
  console.log("User heading (rad, getAlpha):", userHeading);
  console.log("Relative angle (rad):", relativeAngle);
}

/**
 * Aktualisiert die Distanzanzeige
 * @returns null, falls keine Koordinaten gesetzt sind
 */
function updateDistance() {
  if (currentCoords.longitude === null || currentCoords.latitude === null) return;
  const distance = computeDistance(currentCoords.latitude, currentCoords.longitude, targetCoords.latitude, targetCoords.longitude);
  distanceOverlay.innerText = `${Math.round(distance)} m`;
}
