import { AbsoluteDeviceOrientationControls, isIOS, setObjectQuaternion } from './AbsoluteDeviceOrientationControls.js';
import { THREE } from './AbsoluteDeviceOrientationControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as LocAR from './locar/dist/locar.es.js';

// Global variables
var scene, camera, renderer, gltfloader, pfeilARObjekt;
var locar, cam, absoluteDeviceOrientationControls;
var portraitMode = window.matchMedia("(orientation: portrait)").matches;
var targetCoords = { longitude: 7.651058, latitude: 51.935260 }; // Wird als Fallback genutzt, falls noch kein Marker hinzugefügt wurde
var currentCoords = { longitude: null, latitude: null }; // Nutzerkoordinaten
let originalMarkerPosition = new THREE.Vector3();
// Flag, um sicherzustellen, dass Marker nur einmal hinzugefügt werden
let markersAdded = false;

// Array zum Speichern der Marker-Koordinaten, die der User eingibt
var markerCoordsList = [];
// Array der erstellten Marker-Objekte
var zielmarkerARObjekte = [];

const lonInput = document.getElementById("longitude"); // Inputfeld für Längengrad
const latInput = document.getElementById("latitude"); // Inputfeld für Breitengrad
const distanceOverlay = document.getElementById("distance-overlay"); // Distanzanzeige
const compassArrow = document.getElementById("compassArrow"); // Kompass-Pfeil
const compassText = document.getElementById("compassText"); // Kompass-Text

// Hole das Popup und den Close-Button aus dem DOM
const markerPopup = document.getElementById("markerPopup");
const closeButton = document.getElementById("popupClose");

// Klick-Listener für den Close-Button des Popups
closeButton.addEventListener("click", () => {
  markerPopup.style.display = "none";
});

// Für den erweiterten Klickbereich:
const clickBuffer = 50;

// Raycaster- und Maus-Vektor für Klicks
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

// Bei onload: neben Start gibt es auch einen "Hinzufügen" Button, der Marker-Koordinaten speichert
window.onload = () => {
  console.log("page loaded, proceed to init");
  const lonLatInput = document.getElementById("lonlatinput");
  const startBtn = document.getElementById("btnStart");
  const addBtn = document.getElementById("btnAdd"); // Neuer Button im HTML

  // Hinzufügen-Button: speichert die aktuellen Werte in markerCoordsList
  addBtn.addEventListener('click', () => {
    const lon = parseFloat(lonInput.value);
    const lat = parseFloat(latInput.value);
    markerCoordsList.push({ longitude: lon, latitude: lat });
    console.log("Marker hinzugefügt:", { longitude: lon, latitude: lat });
    // Optional: Feedback an den User, z.B. per Alert oder Einblenden einer Nachricht
  });

  // Start-Button: wenn der User fertig ist, wird die AR-Szene gestartet
  startBtn.addEventListener('click', () => {
    // Falls noch keine Marker hinzugefügt wurden, nutze die aktuellen Inputwerte
    if (markerCoordsList.length === 0) {
      markerCoordsList.push({ 
        longitude: parseFloat(lonInput.value), 
        latitude: parseFloat(latInput.value)
      });
    }
    // Optionale: Falls targetCoords genutzt wird – z.B. den ersten Marker als Ziel definieren
    targetCoords = markerCoordsList[0];
    document.body.removeChild(lonLatInput);
    init();
  });
};

/**
 * Initialisiert die Szene, Kamera, Renderer und LocAR
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

  // LocAR initialisieren
  locar = new LocAR.LocationBased(scene, camera, { gpsMinDistance: 1 });
  cam = new LocAR.WebcamRenderer(renderer);
  absoluteDeviceOrientationControls = new AbsoluteDeviceOrientationControls(camera);

  gltfloader = new GLTFLoader();

  // Marker werden in diesem gpsupdate-Event hinzugefügt, sobald eine initiale Position vorliegt.
  locar.on("gpsupdate", (pos, distMoved) => {
    // Aktuelle Nutzerkoordinaten setzen
    currentCoords.longitude = pos.coords.longitude;
    currentCoords.latitude = pos.coords.latitude;
    console.log("GPS Update:", currentCoords);

    // Falls noch keine Marker hinzugefügt wurden und wir eine gültige Position haben:
    if (!markersAdded && currentCoords.longitude && currentCoords.latitude) {
      markerCoordsList.forEach(coord => {
        const textureLoader = new THREE.TextureLoader();
        const markerTexture = textureLoader.load('./images/map-marker.png');
        const markerMaterial = new THREE.SpriteMaterial({ map: markerTexture });
        const markerSprite = new THREE.Sprite(markerMaterial);
        markerSprite.scale.set(5, 5, 1);
        // Marker in die Szene einfügen – locar.add() benötigt eine initiale Position.
        locar.add(markerSprite, coord.longitude, coord.latitude);
        zielmarkerARObjekte.push({
          sprite: markerSprite,
          coords: coord
        });
      });
      markersAdded = true;
    }

    // Update aller Marker-Positionen und sonstiger UI-Elemente
    updateArrow();
    updateDistance();
  });

  locar.startGps();
  renderer.setAnimationLoop(animate);
  arSzeneGeladen = true;
}


/**
 * Zentraler Loop der Animation
 */
function animate() {
  updateArrow();
  updateDistance();
  updateCompass(); // Kompass-Update
  cam.update();
  absoluteDeviceOrientationControls.update();
  renderer.render(scene, camera);
}

/**
 * Aktualisiert das Kompass GUI
 */
function updateCompass() {
  if (!absoluteDeviceOrientationControls.deviceOrientation) return;

  let heading = absoluteDeviceOrientationControls.getAlpha() * (180 / Math.PI);
  if (isIOS && absoluteDeviceOrientationControls.deviceOrientation?.webkitCompassHeading) {
    heading = 360 - absoluteDeviceOrientationControls.deviceOrientation.webkitCompassHeading;
  }
  if (!portraitMode) {
    heading = (heading - 90 + 360) % 360;
  }
  if (heading !== null) {
    compassArrow.style.transform = `rotate(${heading}deg)`;
    compassText.innerText = `${Math.round(heading)}°`;
  }
}

/**
 * Berechnet die Distanz zwischen zwei Punkten
 */
function computeDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const φ1 = THREE.MathUtils.degToRad(lat1);
  const φ2 = THREE.MathUtils.degToRad(lat2);
  const Δφ = THREE.MathUtils.degToRad(lat2 - lat1);
  const Δλ = THREE.MathUtils.degToRad(lon2 - lon1);
  const a = Math.sin(Δφ / 2) ** 2 +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Aktualisiert die Pfeilrotation des glb Modells
 */
function updateArrow() {
  if (!pfeilARObjekt || currentCoords.longitude === null || currentCoords.latitude === null) {
    return;
  }

  // Berechne den Richtungsvektor vom User zum Ziel (hier als Beispiel für den ersten Marker)
  // Du kannst den Pfeil später so anpassen, dass er z. B. auf einen ausgewählten Marker zeigt
  const primaryMarker = markerCoordsList[0] ? markerCoordsList[0] : targetCoords;
  const lonlatTarget = locar.lonLatToWorldCoords(primaryMarker.longitude, primaryMarker.latitude);
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

  // Aktualisiere jeden Marker (nur für iOS im Landscape-Modus wird hier die Korrektur angewandt)
  if (isIOS && !portraitMode) {
    zielmarkerARObjekte.forEach(markerObj => {
      const coord = markerObj.coords;
      const lonlatTarget = locar.lonLatToWorldCoords(coord.longitude, coord.latitude);
      const basePos = new THREE.Vector3(lonlatTarget[0], 1.5, lonlatTarget[1]);
    
      // Nutze markerObj.originalPosition, falls du darauf basierende Korrekturen machen möchtest.
      // Oder berechne die Korrektur direkt für jeden Marker:
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
    
      const markerPos = basePos.clone();
      markerPos.sub(camera.position);
      markerPos.applyAxisAngle(new THREE.Vector3(0,1,0), delta);
      markerPos.add(camera.position);
    
      markerObj.sprite.position.copy(markerPos);
    });
    
  }
}

/**
 * Aktualisiert die Distanzanzeige
 */
function updateDistance() {
  if (currentCoords.longitude === null || currentCoords.latitude === null) return;
  // Beispiel: Distanz vom User zum ersten Marker (oder Ziel)
  const primaryMarker = markerCoordsList[0] ? markerCoordsList[0] : targetCoords;
  const distance = computeDistance(currentCoords.latitude, currentCoords.longitude, primaryMarker.latitude, primaryMarker.longitude);
  distanceOverlay.innerText = `${Math.round(distance)} m`;
}

window.matchMedia("(orientation: portrait)").addEventListener("change", e => {
  portraitMode = e.matches;
  if (isIOS && portraitMode) {
    // Optional: Bei Rückkehr in den Portrait-Modus Markerpositionen wieder auf ihre ursprüngliche Position setzen
    // (Dies hängt von deinem gewünschten Verhalten ab)
    zielmarkerARObjekte.forEach(markerObj => {
      // Hier könnte man markerObj.sprite.position neu setzen (falls Korrekturen vorher angewandt wurden)
    });
  }
});

// Klick-Listener: Popup anzeigen, wenn der AR-Marker (bzw. der erweiterte Bereich) getroffen wird
window.addEventListener("click", (event) => {
  if(markersAdded === false) return; // Wenn noch keine Marker hinzugefügt wurden, nichts tun
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);
  
  // Hier iterieren wir über alle Marker und prüfen, ob einer getroffen wurde
  let markerClicked = false;
  zielmarkerARObjekte.forEach(markerObj => {
    const intersects = raycaster.intersectObject(markerObj.sprite, true);
    if (intersects.length > 0) {
      markerClicked = true;
    } else {
      // Erweitere den Klickbereich
      const markerPosWorld = markerObj.sprite.position.clone();
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
  });
  if (markerClicked) {
    markerPopup.style.display = "block";
  }
});
