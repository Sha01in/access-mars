# Access Mars (rehost)

Independent rehost of [Access Mars](https://experiments.withgoogle.com/access-mars), the 2017 WebVR experiment by Google Creative Lab and NASA JPL. The original site at `accessmars.withgoogle.com` is no longer active.

This is a fork of [`googlecreativelab/access-mars`](https://github.com/googlecreativelab/access-mars) (Apache-2.0). Not an official Google or NASA product.

## Run locally

The `public/` folder is already a complete static site (prebuilt `js/vr.js` plus terrain, audio, and rover assets). No Node 8 / browserify toolchain required:

```bash
npx serve public
```

Then open the URL printed in the terminal.

## Deploy (Cloudflare Pages)

- Project name: `access-mars`
- Production branch: `master`
- Build command: *(empty)*
- Output directory: `public`

`wrangler.toml` sets `pages_build_output_dir = "public"`.

## Notes

- Four mission sites (Landing Site, Pahrump Hills, Marias Pass, Murray Buttes) are bundled in-repo.
- The original "Current Location" tile was a live update of Curiosity’s position from 2017 and is not refreshed here.
- Credits: Jeremy Abel, Manny Tan, Ryan Burke, Kelly Ann Lum, Alex Menzies, NASA JPL Ops Lab, and Google Creative Lab.
