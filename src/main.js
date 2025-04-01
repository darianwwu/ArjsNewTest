import { AbsoluteDeviceOrientationControls, isIOS, setObjectQuaternion } from './AbsoluteDeviceOrientationControls.js';
import { THREE } from './AbsoluteDeviceOrientationControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as LocAR from './locar/dist/locar.es.js';

// Global variables
var scene, camera, renderer, gltfloader, pfeilARObjekt, zielmarkerARObjekt;
var locar, cam, absoluteDeviceOrientationControls;
var portraitMode = window.matchMedia("(orientation: portrait)").matches;
var targetCoords = { longitude: 7.651058, latitude: 51.935260 }; // Zielkoordinaten
var currentCoords = { longitude: null, latitude: null }; // Nutzerkoordinaten
let originalMarkerPosition = new THREE.Vector3();
let markersAdded = false; // Flag, um zu überprüfen, ob Marker hinzugefügt wurden

const lonInput = document.getElementById("longitude"); // HTML-Inputfeld für Längengrad
const latInput = document.getElementById("latitude");   // HTML-Inputfeld für Breitengrad
const distanceOverlay = document.getElementById("distance-overlay"); // HTML-Distanzanzeige
const compassArrow = document.getElementById("compassArrow"); // Kompass-Pfeil
const compassText = document.getElementById("compassText");   // Kompass-Text

// Hole das Popup und den Close-Button aus dem DOM
const markerPopup = document.getElementById("markerPopup");
const closeButton = document.getElementById("popupClose");

// Klick-Listener für den Close-Button
closeButton.addEventListener("click", () => {
  markerPopup.style.display = "none";
});

// Für den erweiterten Klickbereich:
const clickBuffer = 50;

// Raycaster- und Maus-Vektor für Klicks
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

/**
 * Onload-Event: Wartet bis die Seite geladen ist, um die Initialisierung zu starten.
 * Der Eventlistener für den Start-Button ruft die init()-Funktion auf.
 */
window.onload = () => {
  console.log("page loaded, proceed to init");
  const overlayContainer = document.getElementById("overlayContainer");
  const startBtn = document.getElementById("btnStart");

  startBtn.addEventListener('click', () => {
    targetCoords.longitude = parseFloat(lonInput.value);
    targetCoords.latitude = parseFloat(latInput.value);
    // Entferne den Overlay-Container beim Start
    document.body.removeChild(overlayContainer);
    init();
  });
};

/**
 * Initialisiert die Szene, Kamera, Renderer und LocAR.
 * Setzt die AR Objekte und startet den Animationsloop.
 * Integriert: Zentraler Event-Listener von LocAR für GPS-Updates.
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

  renderer = new THREE.WebGLRenderer( { logarithmicDepthBuffer: true } );
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
      markersAdded = true; // Marker wurde hinzugefügt

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
      // Nach der ersten Initialisierung: nur Rotation und Position aktualisieren.
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
 * Aktualisiert das Kompass GUI.
 * Gibt null zurück, falls keine Geräteorientierung vorhanden ist.
 */
function updateCompass() {
  if (!absoluteDeviceOrientationControls.deviceOrientation) return;

  let heading = absoluteDeviceOrientationControls.getAlpha() * (180 / Math.PI);

  if (isIOS && absoluteDeviceOrientationControls.deviceOrientation?.webkitCompassHeading) {
    heading = 360 - absoluteDeviceOrientationControls.deviceOrientation.webkitCompassHeading;
  }

  if(!portraitMode) {
    heading = (heading - 90 + 360) % 360;
  }

  if (heading !== null) {
    compassArrow.style.transform = `rotate(${heading}deg)`;
    compassText.innerText = `${Math.round(heading)}°`;
  }
}

/**
 * Berechnet die Distanz zwischen zwei Punkten auf der Erde.
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
 * Aktualisiert die Pfeilrotation des glb Modells.
 * Gibt null zurück, falls keine Koordinaten gesetzt sind.
 */
function updateArrow() {
  if (!pfeilARObjekt || currentCoords.longitude === null || currentCoords.latitude === null) {
    return;
  }

  const lonlatTarget = locar.lonLatToWorldCoords(targetCoords.longitude, targetCoords.latitude);
  const targetWorldPos = new THREE.Vector3(lonlatTarget[0], 1.5, lonlatTarget[1]);

  const lonlatUser = locar.lonLatToWorldCoords(currentCoords.longitude, currentCoords.latitude);
  const userWorldPos = new THREE.Vector3(lonlatUser[0], 1.5, lonlatUser[1]);

  const direction = new THREE.Vector3().subVectors(targetWorldPos, userWorldPos);
  const targetAngle = Math.atan2(direction.x, direction.z);

  let userHeading = absoluteDeviceOrientationControls.getAlpha();
  const compensation = (window.screen.orientation.angle || 0) * (Math.PI / 180);
  userHeading -= compensation;

  let relativeAngle = targetAngle - userHeading;
  relativeAngle += Math.PI;
  relativeAngle = ((relativeAngle + Math.PI) % (2 * Math.PI)) - Math.PI;
  pfeilARObjekt.rotation.set(0, relativeAngle, 0);

  if (isIOS && !portraitMode) {
    if (originalMarkerPosition.length() === 0) {
      originalMarkerPosition.copy(zielmarkerARObjekt.position);
    }

    const tempQuat = new THREE.Quaternion();
    const alpha = absoluteDeviceOrientationControls.getAlpha();
    const beta = absoluteDeviceOrientationControls.getBeta();
    const gamma = absoluteDeviceOrientationControls.getGamma();
    const orient = absoluteDeviceOrientationControls.screenOrientation || 0;
    setObjectQuaternion(tempQuat, alpha, beta, gamma, orient);
    const tempEuler = new THREE.Euler().setFromQuaternion(tempQuat, 'YXZ');
    const sensorY = tempEuler.y;

    const compassY = THREE.MathUtils.degToRad(360 - absoluteDeviceOrientationControls.deviceOrientation.webkitCompassHeading);
    const delta = compassY - sensorY;

    const markerPos = new THREE.Vector3(lonlatTarget[0], 1.5, lonlatTarget[1]);
    markerPos.sub(camera.position);
    markerPos.applyAxisAngle(new THREE.Vector3(0,1,0), delta);
    markerPos.add(camera.position);

    zielmarkerARObjekt.position.copy(markerPos);
  }
}

/**
 * Aktualisiert die Distanzanzeige.
 * Gibt null zurück, falls keine Koordinaten gesetzt sind.
 */
function updateDistance() {
  if (currentCoords.longitude === null || currentCoords.latitude === null) return;
  const distance = computeDistance(currentCoords.latitude, currentCoords.longitude, targetCoords.latitude, targetCoords.longitude);
  distanceOverlay.innerText = `${Math.round(distance)} m`;
}

window.matchMedia("(orientation: portrait)").addEventListener("change", e => {
  portraitMode = e.matches;

  if (isIOS && portraitMode) {
    // Setze den Marker auf die ursprüngliche Position zurück
    zielmarkerARObjekt.position.copy(originalMarkerPosition);
  }
});

window.addEventListener("click", (event) => {
  if(!markersAdded) return; // Wenn keine Marker hinzugefügt wurden, ignoriere den Klick
  // Berechne die normalisierten Mauskoordinaten
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

  // Prüfe, ob direkt auf den AR-Marker geklickt wurde
  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObject(zielmarkerARObjekt, true);

  let markerClicked = false;
  
  if (intersects.length > 0) {
    markerClicked = true;
  } else {
    // Falls kein direkter Treffer, erweitere den Klickbereich
    const markerPosWorld = zielmarkerARObjekt.position.clone();
    const markerPosScreen = markerPosWorld.project(camera);
    const markerScreenX = (markerPosScreen.x + 1) / 2 * window.innerWidth;
    const markerScreenY = (-markerPosScreen.y + 1) / 2 * window.innerHeight;
    const dx = event.clientX - markerScreenX;
    const dy = event.clientY - markerScreenY;
    const distancePx = Math.sqrt(dx * dx + dy * dy);
    if (distancePx < clickBuffer) {
      markerClicked = true;
    }
  }

  if (markerClicked) {
    markerPopup.style.display = "block";
  }
});
