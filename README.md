# Joust: Flight Duel

A small, single-player browser game inspired by the classic Joust arcade mechanics.

## Play

Run the game locally with:

```sh
npm install
npm run dev
```

Use Left/Right or A/D to steer. Press Z once to flap upward; release and press again for another flap. Press Enter to start or restart.

## Manual Playability Reference

[Play classic Joust Arcade Game Online - Nintendo, Atari and Sega Games](https://www.free80sarcade.com/joust.php) is a useful reference for manually comparing the original game's flight, jousting, and overall playability.

## Potential Art and Sound References

- [Joust NES sound effects - The Sounds Resource](https://sounds.spriters-resource.com/nes/joust/asset/397793/) lists a downloadable set of sound effects for consideration.
- [Joust pixel-art sprite sheet (608 x 512)](public/assets/joust-sprites.jpg) is the bundled atlas used by the game and inspector.

Confirm usage and redistribution terms before distributing the bundled sprite sheet.

## P3 Media

The browser game loads its bundled sprite atlas from `public/assets/joust-sprites.jpg` and uses animated player/Bounder/Hunter mounts, static direction-aware rider overlays, and tiled platform art, with vector fallbacks while loading. Gameplay sound cues are synthesized with Web Audio; the linked WAV pack is not bundled unless reuse is confirmed.

## Checks

```sh
npm run test
npm run test:coverage
npm run test:e2e
npm run build
```

Install Playwright's browser once with `npx playwright install chromium`. The `vitest.explorer` and `ms-playwright.playwright` VS Code extensions provide unit and browser test discovery in the Testing panel.

## Sprite Inspector

Run `npm run dev:inspector` to open the standalone sprite review app in `sprite-inspector/`. It reads the same manifest-indexed JSON definitions as the game and supports magnified animation frames, atlas crops, frame-bound metadata, rider compositions, and a local atlas image override. Player rider crops use native left/right frames, with their source rectangles, draw size, and placement editable. Save overwrites changed sprite JSON files and rotates each previous file to `.json.bak`.