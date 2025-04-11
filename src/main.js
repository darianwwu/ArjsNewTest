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
  console.log("Window loaded, initializing LocAR...");
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
    console.log("Neuer Marker hinzugefügt:", newMarker);
    markerPopupText.textContent = "Marker hinzugefügt!";
        markerPopup.style.display = "block";

        // Automatisches Schließen des Popups nach 5 Sekunden
        setTimeout(() => {
          markerPopup.style.display = "none";
        }, 1500);
  });

  startBtn.addEventListener('click', () => {
    document.body.removeChild(overlayContainer);
    init();
  });

  testBtn.addEventListener('click', () => {
    const testMarker1 = {
      longitude: 7.651058,
      latitude: 51.935260,
      popupContent: "Polter 1\n" +
                    "Koordinaten:\n" +
                    "Latitude: 51.935260\n" +
                    "Longitude: 7.651058\n\n" +
                    "Länge: 13,5 m\n" +
                    "Tiefe: 3m\n" +
                    "Durchschnittliche Höhe: 1,60m\n" +
                    "Raummaß: 60,2 Rm"
    };
    const testMarker2 = {
      longitude: 7.651110,
      latitude: 51.933416,
      popupContent: "Polter 2\n" +
                  "Koordinaten:\n" +
                  "Latitude: 51.933416\n" +
                  "Longitude: 7.651110\n\n" +
                  "Länge: 16,5 m\n" +
                  "Tiefe: 4m\n" +
                  "Durchschnittliche Höhe: 1,70m\n" +
                  "Raummaß: 93,4 Rm"
    };
    const testMarker3 = {
      longitude: 7.653852,
      latitude: 51.934496,
      popupContent: "Lichtung 1\n" +
                  "Koordinaten:\n" +
                  "Latitude: 51.934496\n" +
                  "Longitude: 7.653852\n\n" +
                  "Größe: 3 ha\n"
    };
    const testMarker4 = {
      longitude: 7.658851,
      latitude: 51.934513,
      popupContent: "Lichtung 2\n" +
                  "Koordinaten:\n" +
                  "Latitude: 51.934513\n" +
                  "Longitude: 7.658851\n\n" +
                  "Größe: 6 ha\n"
    };
    const testMarker5 = {
      longitude: 7.648327,
      latitude: 51.934420,
      popupContent: "Sonstiger POI 1\n" +
                  "Koordinaten:\n" +
                  "Latitude: 51.934420\n" +
                  "Longitude: 7.648327\n\n"
    };
    targetCoords.push(testMarker1, testMarker2, testMarker3, testMarker4, testMarker5);
    console.log("targetCoords:", targetCoords);

    markerPopupText.textContent = " 5 Marker hinzugefügt!";
        markerPopup.style.display = "block";

        // Automatisches Schließen des Popups nach 1,5 Sekunden
        setTimeout(() => {
          markerPopup.style.display = "none";
        }, 1500);
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

  camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.001, 1000);
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
    // Initialisierung bei erstem Update
    currentCoords.longitude = pos.coords.longitude;
    currentCoords.latitude = pos.coords.latitude;
    console.log("GPS Update:", currentCoords);
    // Initialposition und AR-Elemente setzen
    if (!initialPositionSet) {
      initialPositionSet = true;
      addCompass();
      addArrow();
      addAllMarkers();
      setActiveMarker(0);
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

function addMarker(markerData, index) {
  const marker = new TargetMarker({
    locar: locar,
    camera: camera,
    markerCoords: { latitude: markerData.latitude, longitude: markerData.longitude },
    isIOS: isIOS,
    getScreenOrientation: () => screenOrientation,
    onClick: () => {
      const markerPopup = document.getElementById("markerPopup");
      const markerPopupText = document.getElementById("markerPopupText");
      const closeButton = document.getElementById("popupClose");

      if (index !== indexActiveMarker) {
        // Wird ein Marker angeklickt, der nicht aktiv ist, aktiviere diesen Marker
        setActiveMarker(index);
        markerPopupText.textContent = "Ziel aktualisiert!";
        markerPopup.style.display = "block";

        // Automatisches Schließen des Popups nach 5 Sekunden
        setTimeout(() => {
          markerPopup.style.display = "none";
        }, 5000);
      } else {
        // Beim erneuten Klick auf den aktiven Marker soll das vordefinierte popupContent angezeigt werden.
        markerPopupText.textContent = markerData.popupContent;
        markerPopup.style.display = "block";

        // Schließen-Button-Handler für das Popup
        closeButton.addEventListener("click", () => {
          markerPopup.style.display = "none";
        });
      }
    },
    deviceOrientationControl: absoluteDeviceOrientationControls
  });

  marker.initMarker('./images/map-marker-schwarz.png');
  markers.push(marker);
}

function addAllMarkers() {
  // Über jedes gespeicherte Marker-Datenobjekt iterieren und addMarker aufrufen
  targetCoords.forEach((markerData, index) => {
    addMarker(markerData, index);
  });
}

function setActiveMarker(index) {
  indexActiveMarker = index;
  console.log("Aktiver Marker gesetzt:", indexActiveMarker);
  
  // Alle Marker aktualisieren:
  markers.forEach((marker, idx) => {
    if(idx === indexActiveMarker) {
      marker.updateMarkerImage('./images/map-marker.png');
    } else {
      marker.updateMarkerImage('./images/map-marker-schwarz.png');
    }
  });
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