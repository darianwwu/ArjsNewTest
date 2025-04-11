/**
 * LocAR.js Tutorial - Part 2
 * https://github.com/AR-js-org/locar.js/blob/master/docs/tutorial/part2.md
 * modified to enable device orientation on ios(btnStart)
 * modified to use webkit absoluteDeviceOrientationControl, see https://github.com/AR-js-org/AR.js/issues/466
 * see also https://github.com/mrdoob/three.js/blob/1ee2fca970e3afdc26e6c2a47c14e9e2b784ae48/examples/jsm/controls/DeviceOrientationControls.js
 * for calling this.connect()
 **/

import * as THREE from 'three';
export const isIOS = navigator.userAgent.match(/iPhone|iPad|iPod/i);

/* 
// Einfacher Kalman Filter zur Glättung der Sensordaten (momentan deaktiviert)
class KalmanFilter {
  constructor(R = 0.25, Q = 0.75) {
    this.R = R; // Messrauschen
    this.Q = Q; // Prozessrauschen
    this.x = 0; // Zustandswert
    this.P = 1; // Fehlerkovarianz
  }
  
  update(z) {
    const K = this.P / (this.P + this.R);
    this.x = this.x + K * (z - this.x);
    this.P = (1 - K) * this.P + this.Q;
    return this.x;
  }
}
*/

function AbsoluteDeviceOrientationControls(object) {
  const scope = this;
  this.object = object;
  this.object.rotation.reorder('YXZ');
  this.enabled = true;
  this.deviceOrientation = null;
  this.screenOrientation = 0;
  this.alphaOffset = 0;
  this.initialOffset = null;

  // Filterinstanzen werden vorerst nicht verwendet
  // this.alphaFilter = new KalmanFilter();
  // this.betaFilter = new KalmanFilter();
  // this.gammaFilter = new KalmanFilter();

  /** Callback-Funktion, um die Werte aus dem Event zu erhalten **/
  const onDeviceOrientationChangeEvent = function ({ alpha, beta, gamma, webkitCompassHeading }) {
    if (isIOS) {
      // Auf iOS wird neben deviceOrientation auch webkitCompassHeading benötigt
      const ccwNorthHeading = 360 - webkitCompassHeading; // Gegen den Uhrzeigersinn vom Norden
      scope.alphaOffset = THREE.MathUtils.degToRad(ccwNorthHeading - alpha);
      scope.deviceOrientation = { alpha, beta, gamma, webkitCompassHeading };
    } else {
      // Auf anderen Browsern (z B. Chrome) direkt deviceOrientationAbsolute verwenden
      if (alpha < 0) alpha += 360;
      scope.deviceOrientation = { alpha, beta, gamma };
    }

    window.dispatchEvent(new CustomEvent('camera-rotation-change', { detail: { cameraRotation: object.rotation } }));
  };

  /** Aktualisiert die Rotation basierend auf der Bildschirmorientierung **/
  const onScreenOrientationChangeEvent = function () {
    scope.screenOrientation = window.orientation || 0;
  };

  /** Registriert die Events **/
  const onRegisterEvent = function () {
    window.addEventListener('orientationchange', onScreenOrientationChangeEvent, false);
    if (isIOS) {
      window.addEventListener('deviceorientation', onDeviceOrientationChangeEvent, false);
    } else {
      window.addEventListener('deviceorientationabsolute', onDeviceOrientationChangeEvent, false);
    }
  }.bind(this);

  /** Hilfsfunktion, um Quaternionen anhand der Sensordaten zu berechnen **/
  const setObjectQuaternion = (function () {
    const zee = new THREE.Vector3(0, 0, 1);
    const euler = new THREE.Euler();
    const q0 = new THREE.Quaternion();
    const q1 = new THREE.Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5));
    return function (quaternion, alpha, beta, gamma, orient) {
      euler.set(beta, alpha, -gamma, 'YXZ'); // 'ZXY' für das Gerät, aber 'YXZ' für uns
      quaternion.setFromEuler(euler); // Euler-Winkel in Quaternion umrechnen
      // Drehung um 90° um die X-Achse (um das Gerät in die richtige Richtung zu drehen)
      quaternion.multiply(q1);
      // Korrektur der Bildschirmrotation
      quaternion.multiply(q0.setFromAxisAngle(zee, -orient));
    };
  })();

  /** Initiale Registrierung der Events **/
  this.connect = function () {
    onScreenOrientationChangeEvent(); // einmal beim Laden ausführen
    // iOS 13+: Anfrage nach Berechtigung
    if (
      window.DeviceOrientationEvent !== undefined &&
      typeof window.DeviceOrientationEvent.requestPermission === 'function'
    ) {
      window.DeviceOrientationEvent.requestPermission()
        .then(function (response) {
          if (response == 'granted') {
            onRegisterEvent();
          }
        })
        .catch(function (error) {
          console.error('THREE.AbsoluteDeviceOrientationControls: Unable to use DeviceOrientation API:', error);
        });
    } else {
      onRegisterEvent();
    }
    scope.enabled = true;
  };

  /** Entfernt die registrierten Events **/
  this.disconnect = function () {
    if (isIOS) {
      window.removeEventListener('orientationchange', onScreenOrientationChangeEvent, false);
      window.removeEventListener('deviceorientation', onDeviceOrientationChangeEvent, false);
    } else {
      window.removeEventListener('orientationchange', onScreenOrientationChangeEvent, false);
      window.removeEventListener('deviceorientationabsolute', onDeviceOrientationChangeEvent, false);
    }
    scope.enabled = false;
    scope.initialOffset = false;
    scope.deviceOrientation = null;
  };

  /** Berechnet und setzt in Echtzeit die Rotation der Kamera **/
  this.update = function ({ theta = 0 } = { theta: 0 }) {
    if (scope.enabled === false) return;
    const device = scope.deviceOrientation;
    if (device) {
      // Umwandlung der rohen Sensordaten in Radiant
      const rawAlpha = device.alpha ? THREE.MathUtils.degToRad(device.alpha) : 0;
      const rawBeta  = device.beta ? THREE.MathUtils.degToRad(device.beta) : 0;
      const rawGamma = device.gamma ? THREE.MathUtils.degToRad(device.gamma) : 0;
      const orient = scope.screenOrientation ? THREE.MathUtils.degToRad(scope.screenOrientation) : 0;

      // Ohne Filterung:
      const usedAlpha = rawAlpha + scope.alphaOffset;
      const usedBeta = rawBeta;
      const usedGamma = rawGamma;

      if (isIOS) {
        const currentQuaternion = new THREE.Quaternion();
        setObjectQuaternion(currentQuaternion, usedAlpha, usedBeta, usedGamma, orient);

        // Hole Euler-Winkel aus dem Quaternion und setze die Y-Achse anhand des Kompasswerts
        const currentEuler = new THREE.Euler().setFromQuaternion(currentQuaternion, 'YXZ');
        // Hier wird der Wert von webkitCompassHeading genutzt (bei iOS)
        currentEuler.y = THREE.MathUtils.degToRad(360 - device.webkitCompassHeading);
        currentQuaternion.setFromEuler(currentEuler);
        scope.object.quaternion.copy(currentQuaternion);
      } else {
        // Auf Android oder anderen Browsern wird direkt deviceorientationabsolute verwendet
        setObjectQuaternion(scope.object.quaternion, usedAlpha + theta, usedBeta, usedGamma, orient);
      }
    }
  };

  /** Setzt den Alpha Offset zurück (für iOS) **/
  this.updateAlphaOffset = function () {
    scope.initialOffset = false;
  };

  /** Entfernt die Steuerung **/
  this.dispose = function () {
    scope.disconnect();
  };

  /** Gibt den rohen Alpha-Wert zurück (ohne Filterung) **/
  this.getAlpha = function () {
    const { deviceOrientation: device } = scope;
    if (device && device.alpha) {
      const rawAlpha = THREE.MathUtils.degToRad(device.alpha) + scope.alphaOffset;
      return rawAlpha; // statt: scope.alphaFilter.update(rawAlpha);
    }
    return 0;
  };

  /** Gibt den rohen Beta-Wert zurück **/
  this.getBeta = function () {
    const { deviceOrientation: device } = scope;
    if (device && device.beta) {
      const rawBeta = THREE.MathUtils.degToRad(device.beta);
      return rawBeta; // statt: scope.betaFilter.update(rawBeta);
    }
    return 0;
  };

  /** Gibt den rohen Gamma-Wert zurück **/
  this.getGamma = function () {
    const { deviceOrientation: device } = scope;
    if (device && device.gamma) {
      const rawGamma = THREE.MathUtils.degToRad(device.gamma);
      return rawGamma; // statt: scope.gammaFilter.update(rawGamma);
    }
    return 0;
  };

  // Starte die Steuerung
  this.connect();
}

AbsoluteDeviceOrientationControls.prototype = Object.assign(Object.create(THREE.EventDispatcher.prototype), {
  constructor: AbsoluteDeviceOrientationControls,
});

export { AbsoluteDeviceOrientationControls };
export { THREE };
export function setObjectQuaternion(quaternion, alpha, beta, gamma, orient) {
  const zee = new THREE.Vector3(0, 0, 1);
  const euler = new THREE.Euler();
  const q0 = new THREE.Quaternion();
  const q1 = new THREE.Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5));
  euler.set(beta, alpha, -gamma, 'YXZ'); // 'ZXY' für das Gerät, aber 'YXZ' für uns
  quaternion.setFromEuler(euler);
  quaternion.multiply(q1);
  quaternion.multiply(q0.setFromAxisAngle(zee, -orient));
}
