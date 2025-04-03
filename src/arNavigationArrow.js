import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { THREE } from './AbsoluteDeviceOrientationControls.js';
import { setObjectQuaternion } from './AbsoluteDeviceOrientationControls.js';

export class ARNavigationArrow {
  constructor({ locar, camera, deviceOrientationControl, targetCoords, currentCoords, isIOS, getScreenOrientation }) {
    this.locar = locar;
    this.camera = camera;
    this.deviceOrientationControl = deviceOrientationControl;
    this.targetCoords = targetCoords;
    this.currentCoords = currentCoords;
    this.isIOS = isIOS;
    this.getScreenOrientation = getScreenOrientation;
    this.loader = new GLTFLoader();
    this.arrowObject = null;
  }

  // Initialisiert den AR-Navigationspfeil
  initArrow(modelPath, onLoadCallback = () => {}) {
    this.loader.load(modelPath, (gltf) => {
      this.arrowObject = gltf.scene;
      this.arrowObject.scale.set(0.3, 0.3, 0.3);
      // Frustrum Culling deaktivieren, damit der Pfeil immer sichtbar ist
      this.arrowObject.traverse(child => child.frustumCulled = false);
      // Pfeil dem Kamera-Objekt hinzufügen
      this.camera.add(this.arrowObject);
      this.arrowObject.position.set(0, -1, -3);
      onLoadCallback();
    });
  }

  // Aktualisiert die Position und Rotation des AR-Navigationspfeils
  update() {
    if (!this.arrowObject || this.currentCoords.longitude === null || this.currentCoords.latitude === null) {
      return;
    }

    const { type, angle } = this.getScreenOrientation();

    // Umrechnung der Zielkoordinaten in Weltkoordinaten
    const lonlatTarget = this.locar.lonLatToWorldCoords(this.targetCoords.longitude, this.targetCoords.latitude);
    const targetWorldPos = new THREE.Vector3(lonlatTarget[0], 1.5, lonlatTarget[1]);

    // Umrechnung der Nutzerkoordinaten in Weltkoordinaten
    const lonlatUser = this.locar.lonLatToWorldCoords(this.currentCoords.longitude, this.currentCoords.latitude);
    const userWorldPos = new THREE.Vector3(lonlatUser[0], 1.5, lonlatUser[1]);

    // Berechnung der Richtung vom Nutzer zum Ziel
    const direction = new THREE.Vector3().subVectors(targetWorldPos, userWorldPos);
    const targetAngle = Math.atan2(direction.x, direction.z);

    // Ermitteln des Nutzer-Headings inkl. eventueller Kompensation
    let userHeading = this.deviceOrientationControl.getAlpha();
    const compensation = angle * (Math.PI / 180);
    userHeading -= compensation;

    let relativeAngle = targetAngle - userHeading;
    relativeAngle += Math.PI;
    relativeAngle = ((relativeAngle + Math.PI) % (2 * Math.PI)) - Math.PI;
    this.arrowObject.rotation.set(0, relativeAngle, 0);

    // iOS-spezifische Anpassungen, wenn im Landscape-Modus
    if (this.isIOS && (type.startsWith('landscape'))) {
      const tempQuat = new THREE.Quaternion();
      const alpha = this.deviceOrientationControl.getAlpha();
      const beta = this.deviceOrientationControl.getBeta();
      const gamma = this.deviceOrientationControl.getGamma();
      const orient = angle || 0;
      setObjectQuaternion(tempQuat, alpha, beta, gamma, orient);
    }
  }
}