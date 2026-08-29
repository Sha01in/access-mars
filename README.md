# Access Mars (rehost)

Independent rehost of [Access Mars](https://experiments.withgoogle.com/access-mars), the 2017 WebVR experiment by Google Creative Lab and NASA JPL. The original site at `accessmars.withgoogle.com` is no longer active.

This is a fork of [`googlecreativelab/access-mars`](https://github.com/googlecreativelab/access-mars) (Apache-2.0). Not an official Google or NASA product.

**Credits:** Jeremy Abel, Manny Tan, Ryan Burke, Kelly Ann Lum, Alex Menzies, NASA JPL Ops Lab, and [Google Creative Lab](https://github.com/googlecreativelab/access-mars). Terrain and mission data from NASA / JPL-Caltech.

## Chrome desktop (360)

Chrome removed the WebVR API this project was built on. The original A-Frame 0.6 scene, NASA glTF/Draco terrain (`terrain/{site}/terrain.glb` + `tiles/*.jpg`), Curiosity rover, Katie Stack voiceover, POIs, and site map are unchanged.

On current Chrome desktop:

1. Splash → **ENTER 360**
2. Watch or **SKIP INTRO** (skip also ends the rover landing animation)
3. Look around Landing Site, click POIs, and use the horizon map to travel to Pahrump Hills, Marias Pass, and Murray Buttes

Headset **Enter VR** still depends on a WebVR / WebXR polyfill and is not the supported path.

## Run locally

The `public/` folder is a complete static site (prebuilt `js/vr.js` plus terrain, audio, and rover assets):

```bash
npx serve public
```

Then open the URL printed in the terminal. Hard-refresh after CSS/JS changes (`css/vr.css`, `js/vr.js`).

## Rebuild from source

Requires Node and the original Browserify toolchain (`npm install --ignore-scripts`):

```bash
npm run build-css
npm run build
```

`build-css` compiles `src/scss/main.scss` → `public/css/vr.css`. `build` browserifies `src/js/vr.js` → `public/js/vr.js`.

## Deploy (Cloudflare Pages)

- Project name: `access-mars`
- Production branch: `master`
- Build command: *(empty)*
- Output directory: `public`

`wrangler.toml` sets `pages_build_output_dir = "public"`.

## Notes

- Four mission sites (Landing Site, Pahrump Hills, Marias Pass, Murray Buttes) are bundled in-repo.
- The original "Current Location" tile was a live update of Curiosity’s position from 2017 and is not refreshed here.
