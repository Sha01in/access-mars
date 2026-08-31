// Copyright 2017 Google Inc.
//
//   Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
//   You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
//   Unless required by applicable law or agreed to in writing, software
//   distributed under the License is distributed on an "AS IS" BASIS,
//   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
//   See the License for the specific language governing permissions and
// limitations under the License.

/**
 * Handheld / foldable magic-window stabilizer for A-Frame 0.6 look-controls.
 *
 * Mobile 360 uses THREE.VRControls + webvr-polyfill FusionPoseSensor with no
 * deadzone. Foldables (Pixel Fold) also spam orientation while the hinge
 * moves. This damps only the sensor (HMD) euler; touch yaw/pitch and desktop
 * mouse-drag are left alone.
 */

export const PHONE_LOOK = {
	deadzone: 1.75,
	gain: 0.32,
	filter: 0.30,
	maxStep: 5
};

export const FOLDABLE_LOOK = {
	deadzone: 3.0,
	gain: 0.16,
	filter: 0.18,
	maxStep: 3.5
};

export const FOLD_FREEZE_MS = 500;
export const POSTURE_FREEZE_MS = 650;
export const JUMP_IGNORE_DEG = 35;

let geometryUnstableUntil = 0;
let geometryListenersInstalled = false;

export function shortestAngleDelta( from, to ) {
	let delta = to - from;
	while ( delta > 180 ) delta -= 360;
	while ( delta < -180 ) delta += 360;
	return delta;
}

export function lerpAngle( from, to, t ) {
	return from + shortestAngleDelta( from, to ) * t;
}

export function copyEuler( src ) {
	return { x: src.x, y: src.y, z: src.z };
}

export function isNearlyIdentityEuler( euler ) {
	return Math.abs( euler.x ) < 0.5 && Math.abs( euler.y ) < 0.5 && Math.abs( euler.z ) < 0.5;
}

export function eulerJumpDeg( from, to ) {
	const dx = shortestAngleDelta( from.x, to.x );
	const dy = shortestAngleDelta( from.y, to.y );
	const dz = shortestAngleDelta( from.z, to.z );
	return Math.sqrt( dx * dx + dy * dy + dz * dz );
}

export function isFoldableDevice( nav, win ) {
	const navigatorObj = nav || ( typeof navigator !== 'undefined' ? navigator : null );
	const windowObj = win || ( typeof window !== 'undefined' ? window : null );
	if ( !navigatorObj ) return false;

	const ua = navigatorObj.userAgent || '';
	if ( /Fold/i.test( ua ) ) return true;
	// Presence of the Device Posture API is not enough — desktop Chrome
	// exposes it with type "continuous". Only a folded hinge is a signal.
	if ( navigatorObj.devicePosture && navigatorObj.devicePosture.type === 'folded' ) return true;

	try {
		if ( windowObj && windowObj.matchMedia ) {
			return windowObj.matchMedia( '(horizontal-viewport-segments: 2)' ).matches ||
				windowObj.matchMedia( '(vertical-viewport-segments: 2)' ).matches ||
				windowObj.matchMedia( '(spanning: single-fold-horizontal)' ).matches ||
				windowObj.matchMedia( '(spanning: single-fold-vertical)' ).matches;
		}
	} catch ( err ) {
		// matchMedia may throw for unknown media features
	}

	return false;
}

export function lookProfileForDevice( nav, win ) {
	return isFoldableDevice( nav, win ) ? FOLDABLE_LOOK : PHONE_LOOK;
}

export function markGeometryUnstable( durationMs, nowMs ) {
	const now = nowMs !== undefined ? nowMs : ( typeof performance !== 'undefined' ? performance.now() : Date.now() );
	const until = now + ( durationMs || FOLD_FREEZE_MS );
	if ( until > geometryUnstableUntil ) geometryUnstableUntil = until;
}

export function getGeometryUnstableUntil() {
	return geometryUnstableUntil;
}

export function resetGeometryUnstableForTests() {
	geometryUnstableUntil = 0;
}

export function createStabilizerState( profile ) {
	const cfg = profile || PHONE_LOOK;
	return {
		filtered: null,
		applied: null,
		prevRaw: null,
		identityLock: true,
		needsRebase: false,
		deadzone: cfg.deadzone,
		gain: cfg.gain,
		filter: cfg.filter,
		maxStep: cfg.maxStep
	};
}

/**
 * Advance the handheld look filter.
 * `freezeUntil` is an absolute timestamp in the same clock as `now`.
 */
export function stepMagicWindowStabilizer( state, raw, now, freezeUntil ) {
	if ( !state.applied ) {
		state.applied = copyEuler( raw );
		state.filtered = copyEuler( raw );
		state.prevRaw = copyEuler( raw );
		state.identityLock = isNearlyIdentityEuler( raw );
		return copyEuler( state.applied );
	}

	if ( freezeUntil && now < freezeUntil ) {
		state.needsRebase = true;
		state.prevRaw = copyEuler( raw );
		return copyEuler( state.applied );
	}

	if ( state.needsRebase ) {
		state.applied = copyEuler( raw );
		state.filtered = copyEuler( raw );
		state.prevRaw = copyEuler( raw );
		state.needsRebase = false;
		state.identityLock = isNearlyIdentityEuler( raw );
		return copyEuler( state.applied );
	}

	if ( state.identityLock && !isNearlyIdentityEuler( raw ) ) {
		state.applied = copyEuler( raw );
		state.filtered = copyEuler( raw );
		state.prevRaw = copyEuler( raw );
		state.identityLock = false;
		return copyEuler( state.applied );
	}

	if ( state.prevRaw && eulerJumpDeg( state.prevRaw, raw ) > JUMP_IGNORE_DEG ) {
		if ( !state.identityLock ) {
			state.prevRaw = copyEuler( raw );
			return copyEuler( state.applied );
		}
	}

	state.prevRaw = copyEuler( raw );
	state.filtered.x = lerpAngle( state.filtered.x, raw.x, state.filter );
	state.filtered.y = lerpAngle( state.filtered.y, raw.y, state.filter );
	state.filtered.z = lerpAngle( state.filtered.z, raw.z, state.filter );

	followAxis( state, 'x' );
	followAxis( state, 'y' );
	followAxis( state, 'z' );

	return copyEuler( state.applied );
}

function followAxis( state, axis ) {
	const delta = shortestAngleDelta( state.applied[ axis ], state.filtered[ axis ] );
	if ( Math.abs( delta ) <= state.deadzone ) return;

	let excess = delta - Math.sign( delta ) * state.deadzone;
	const step = state.maxStep;
	if ( excess > step ) excess = step;
	if ( excess < -step ) excess = -step;
	state.applied[ axis ] += excess * state.gain;
}

function installGeometryListeners() {
	if ( geometryListenersInstalled || typeof window === 'undefined' ) return;
	geometryListenersInstalled = true;

	const mark = function() { markGeometryUnstable( FOLD_FREEZE_MS ); };
	window.addEventListener( 'orientationchange', mark, { passive: true } );
	window.addEventListener( 'resize', mark, { passive: true } );

	if ( window.screen && screen.orientation && screen.orientation.addEventListener ) {
		screen.orientation.addEventListener( 'change', mark );
	}

	if ( window.visualViewport ) {
		window.visualViewport.addEventListener( 'resize', mark, { passive: true } );
	}

	if ( navigator.devicePosture && navigator.devicePosture.addEventListener ) {
		navigator.devicePosture.addEventListener( 'change', function() {
			markGeometryUnstable( POSTURE_FREEZE_MS );
		} );
	}

	try {
		if ( window.matchMedia ) {
			const posture = window.matchMedia( '(device-posture: folded)' );
			if ( posture && posture.addEventListener ) {
				posture.addEventListener( 'change', function() {
					markGeometryUnstable( POSTURE_FREEZE_MS );
				} );
			}
		}
	} catch ( err ) {
		// ignore unsupported media queries
	}
}

function applyStabilizedMobileOrientation( comp ) {
	const radToDeg = THREE.Math.radToDeg;
	const hmdEuler = comp.hmdEuler;
	const hmdQuaternion = comp.hmdQuaternion;

	hmdQuaternion.copy( comp.dolly.quaternion );
	hmdEuler.setFromQuaternion( hmdQuaternion, 'YXZ' );

	const raw = {
		x: radToDeg( hmdEuler.x ),
		y: radToDeg( hmdEuler.y ),
		z: radToDeg( hmdEuler.z )
	};

	if ( !comp._mwStab ) {
		comp._mwStab = createStabilizerState( lookProfileForDevice() );
	}

	const now = ( typeof performance !== 'undefined' ) ? performance.now() : Date.now();
	const damped = stepMagicWindowStabilizer( comp._mwStab, raw, now, geometryUnstableUntil );

	comp.el.setAttribute( 'rotation', {
		x: damped.x + radToDeg( comp.pitchObject.rotation.x ),
		y: damped.y + radToDeg( comp.yawObject.rotation.y ),
		z: damped.z
	} );
}

/**
 * Patch A-Frame look-controls so only the mobile sensor path is damped.
 * Desktop (and any non-mobile) still uses the original mouse-drag code.
 */
export function patchLookControlsForHandheld() {
	if ( typeof AFRAME === 'undefined' || !AFRAME.components || !AFRAME.components[ 'look-controls' ] ) {
		return false;
	}

	const proto = AFRAME.components[ 'look-controls' ].Component.prototype;
	if ( proto.__mwStabilized ) return true;
	proto.__mwStabilized = true;

	installGeometryListeners();

	const original = proto.updateOrientation;
	proto.updateOrientation = function() {
		const sceneEl = this.el && this.el.sceneEl;
		if ( !sceneEl || !sceneEl.isMobile ) {
			return original.call( this );
		}
		applyStabilizedMobileOrientation( this );
	};

	return true;
}
