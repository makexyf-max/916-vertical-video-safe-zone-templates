// Dependency-free, deterministic RGBA PNG renderer. Run with Node.js 22+.
// Reference values mirror components/SafeZoneChecker.tsx; no website code is changed.
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { deflateSync, inflateSync } from "node:zlib";

const WIDTH = 1080;
const HEIGHT = 1920;
const HEADING = "# 916 Vertical Video Safe Zone Templates & Transparent PNG Overlays";
const specs = [
  { file: "tiktok-safe-zone-1080x1920.png", label: "TikTok 2026", top: 130, right: 140, bottom: 350, left: 44, color: [239, 68, 68] },
  { file: "reels-safe-zone-1080x1920.png", label: "Instagram Reels", top: 220, right: 120, bottom: 420, left: 0, color: [245, 158, 11] },
  { file: "universal-900x1400-safe-box.png", label: "Centered composition box", top: 260, right: 90, bottom: 260, left: 90, color: [34, 211, 238] },
];

// A small embedded pixel font makes labels portable: no fonts, browser, or native bindings.
const font = Object.fromEntries(Object.entries({
  A: "01110/10001/10001/11111/10001/10001/10001", B: "11110/10001/10001/11110/10001/10001/11110",
  C: "01111/10000/10000/10000/10000/10000/01111", D: "11110/10001/10001/10001/10001/10001/11110",
  E: "11111/10000/10000/11110/10000/10000/11111", F: "11111/10000/10000/11110/10000/10000/10000",
  G: "01111/10000/10000/10111/10001/10001/01111", H: "10001/10001/10001/11111/10001/10001/10001",
  I: "11111/00100/00100/00100/00100/00100/11111", J: "00111/00010/00010/00010/10010/10010/01100",
  K: "10001/10010/10100/11000/10100/10010/10001", L: "10000/10000/10000/10000/10000/10000/11111",
  M: "10001/11011/10101/10101/10001/10001/10001", N: "10001/11001/10101/10011/10001/10001/10001",
  O: "01110/10001/10001/10001/10001/10001/01110", P: "11110/10001/10001/11110/10000/10000/10000",
  Q: "01110/10001/10001/10001/10101/10010/01101", R: "11110/10001/10001/11110/10100/10010/10001",
  S: "01111/10000/10000/01110/00001/00001/11110", T: "11111/00100/00100/00100/00100/00100/00100",
  U: "10001/10001/10001/10001/10001/10001/01110", V: "10001/10001/10001/10001/10001/01010/00100",
  W: "10001/10001/10001/10101/10101/10101/01010", X: "10001/10001/01010/00100/01010/10001/10001",
  Y: "10001/10001/01010/00100/00100/00100/00100", Z: "11111/00001/00010/00100/01000/10000/11111",
  0: "01110/10001/10011/10101/11001/10001/01110", 1: "00100/01100/00100/00100/00100/00100/01110",
  2: "01110/10001/00001/00010/00100/01000/11111", 3: "11110/00001/00001/01110/00001/00001/11110",
  4: "00010/00110/01010/10010/11111/00010/00010", 5: "11111/10000/10000/11110/00001/00001/11110",
  6: "01110/10000/10000/11110/10001/10001/01110", 7: "11111/00001/00010/00100/01000/01000/01000",
  8: "01110/10001/10001/01110/10001/10001/01110", 9: "01110/10001/10001/01111/00001/00001/01110",
  "-": "00000/00000/00000/11111/00000/00000/00000", "/": "00001/00001/00010/00100/01000/10000/10000",
  " ": "00000/00000/00000/00000/00000/00000/00000",
}).map(([character, rows]) => [character, rows.split("/")]));

function render(spec) {
  const pixels = Buffer.alloc(WIDTH * HEIGHT * 4);

  function rect(x, y, width, height, color) {
    const [red, green, blue, alpha] = color;
    for (let row = Math.max(0, y); row < Math.min(HEIGHT, y + height); row++) {
      for (let column = Math.max(0, x); column < Math.min(WIDTH, x + width); column++) {
        const offset = (row * WIDTH + column) * 4;
        const sourceAlpha = alpha / 255;
        const remainingAlpha = pixels[offset + 3] / 255 * (1 - sourceAlpha);
        const outputAlpha = sourceAlpha + remainingAlpha;
        pixels[offset] = Math.round((red * sourceAlpha + pixels[offset] * remainingAlpha) / outputAlpha);
        pixels[offset + 1] = Math.round((green * sourceAlpha + pixels[offset + 1] * remainingAlpha) / outputAlpha);
        pixels[offset + 2] = Math.round((blue * sourceAlpha + pixels[offset + 2] * remainingAlpha) / outputAlpha);
        pixels[offset + 3] = Math.round(outputAlpha * 255);
      }
    }
  }

  function frame(x, y, width, height, thickness, color) {
    rect(x, y, width, thickness, color);
    rect(x, y + height - thickness, width, thickness, color);
    rect(x, y + thickness, thickness, height - thickness * 2, color);
    rect(x + width - thickness, y + thickness, thickness, height - thickness * 2, color);
  }

  function label(text, x, y, scale = 3) {
    rect(x - 10, y - 10, text.length * 6 * scale + 17, 7 * scale + 20, [2, 6, 23, 214]);
    for (const [index, character] of [...text.toUpperCase()].entries()) {
      const glyph = font[character];
      assert(glyph, `Missing glyph: ${character}`);
      glyph.forEach((row, rowIndex) => [...row].forEach((bit, column) => {
        if (bit === "1") rect(x + (index * 6 + column) * scale, y + rowIndex * scale, scale, scale, [241, 245, 249, 255]);
      }));
    }
  }

  const universal = spec.file.startsWith("universal-");
  const fill = [...spec.color, universal ? 36 : 82];
  // Disjoint bands keep intersections from becoming darker than the rest of a zone.
  rect(0, 0, WIDTH, spec.top, fill);
  rect(0, HEIGHT - spec.bottom, WIDTH, spec.bottom, fill);
  rect(0, spec.top, spec.left, HEIGHT - spec.top - spec.bottom, fill);
  rect(WIDTH - spec.right, spec.top, spec.right, HEIGHT - spec.top - spec.bottom, fill);

  // 10% reference grid: dashed marks only, not a baked-in checkerboard background.
  for (let x = 108; x < WIDTH; x += 108) {
    for (let y = 0; y < HEIGHT; y += 28) rect(x, y, 2, 14, [226, 232, 240, 70]);
  }
  for (let y = 192; y < HEIGHT; y += 192) {
    for (let x = 0; x < WIDTH; x += 28) rect(x, y, 14, 2, [226, 232, 240, 70]);
  }
  frame(spec.left, spec.top, WIDTH - spec.left - spec.right, HEIGHT - spec.top - spec.bottom, universal ? 6 : 3, [...spec.color, 245]);

  if (universal) {
    label("900 X 1400 COMPOSITION BOX", 90, 48, 4);
    label("TOP 260 PX / BOTTOM 260 PX", 90, 126);
    label("LEFT 90 PX / RIGHT 90 PX", 90, 180);
    label("CENTERED REFERENCE - NOT A UI GUARANTEE", 90, 1740);
    label("REMOVE OVERLAY BEFORE EXPORT", 90, 1812);
  } else {
    label(`${spec.label.toUpperCase()} / REFERENCE`, 32, 30, 4);
    label(`TOP UI / ${spec.top} PX`, 32, 84);
    label("RIGHT", WIDTH - spec.right + 16, 870);
    label(`${spec.right}PX`, WIDTH - spec.right + 16, 918);
    label(`BOTTOM UI / ${spec.bottom} PX`, 32, HEIGHT - spec.bottom + 36, 4);
    label("KEEP ESSENTIAL TEXT OUTSIDE COLORED BANDS", 32, HEIGHT - spec.bottom + 102);
    label("REMOVE OVERLAY BEFORE EXPORT", 32, 1810);
    label("VERIFY CURRENT PLATFORM UI", 32, 1864);
    if (spec.left) {
      // The narrow 44 px band is represented by its true width, not widened for a label.
      label(`LEFT UI / ${spec.left} PX`, 32, HEIGHT - spec.bottom + 168);
    }
  }
  return pixels;
}

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const name = Buffer.from(type, "ascii");
  const result = Buffer.alloc(data.length + 12);
  result.writeUInt32BE(data.length, 0);
  name.copy(result, 4);
  data.copy(result, 8);
  result.writeUInt32BE(crc32(Buffer.concat([name, data])), data.length + 8);
  return result;
}

function encodePng(pixels, spec) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(WIDTH, 0);
  header.writeUInt32BE(HEIGHT, 4);
  header[8] = 8;
  header[9] = 6; // Truecolor with an 8-bit alpha channel, not an opaque RGB image.
  const stride = WIDTH * 4;
  const scanlines = Buffer.alloc((stride + 1) * HEIGHT);
  for (let y = 0; y < HEIGHT; y++) pixels.copy(scanlines, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", header),
    chunk("sRGB", Buffer.from([0])),
    chunk("tEXt", Buffer.from(`Description\0${spec.label}; 1080x1920; project reference, not an official platform specification.`, "latin1")),
    chunk("IDAT", deflateSync(scanlines, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function verifyPng(bytes, expectedPixels, spec) {
  assert.equal(bytes.subarray(0, 8).toString("hex"), "89504e470d0a1a0a", "PNG signature");
  const chunks = [];
  const imageData = [];
  for (let offset = 8; offset < bytes.length;) {
    const length = bytes.readUInt32BE(offset);
    assert(offset + length + 12 <= bytes.length, "Truncated PNG chunk");
    const type = bytes.toString("ascii", offset + 4, offset + 8);
    const data = bytes.subarray(offset + 8, offset + 8 + length);
    assert.equal(bytes.readUInt32BE(offset + length + 8), crc32(bytes.subarray(offset + 4, offset + 8 + length)), `${type} CRC`);
    chunks.push(type);
    if (type === "IHDR") {
      assert.equal(data.readUInt32BE(0), WIDTH);
      assert.equal(data.readUInt32BE(4), HEIGHT);
      assert.deepEqual([...data.subarray(8)], [8, 6, 0, 0, 0], "8-bit non-interlaced RGBA");
    }
    if (type === "IDAT") imageData.push(data);
    offset += length + 12;
  }
  assert.equal(chunks[0], "IHDR");
  assert.equal(chunks.at(-1), "IEND");
  const decoded = inflateSync(Buffer.concat(imageData));
  assert.equal(decoded.length, (WIDTH * 4 + 1) * HEIGHT);
  for (let y = 0; y < HEIGHT; y++) {
    const offset = y * (WIDTH * 4 + 1);
    assert.equal(decoded[offset], 0, "Unfiltered PNG row");
    assert(decoded.subarray(offset + 1, offset + 1 + WIDTH * 4).equals(expectedPixels.subarray(y * WIDTH * 4, (y + 1) * WIDTH * 4)), `Pixel mismatch in row ${y}`);
  }
  let transparent = 0;
  let translucent = 0;
  for (let offset = 3; offset < expectedPixels.length; offset += 4) {
    const alpha = expectedPixels[offset];
    if (alpha === 0) transparent++;
    else if (alpha < 255) translucent++;
  }
  assert(transparent > WIDTH * HEIGHT * 0.45, "Keep a genuinely transparent viewing area");
  assert(translucent > 0, "Keep translucent UI bands and grid");
  const alphaAt = (x, y) => expectedPixels[(y * WIDTH + x) * 4 + 3];
  assert.equal(alphaAt(501, 701), 0, "The clear center must remain transparent");
  assert(alphaAt(20, 20) > 0, "Outer margin must be marked");
  assert(alphaAt(501, spec.top - 1) > 0, "Top margin reaches the expected boundary");
  assert.equal(alphaAt(501, spec.top + 10), 0, "No top fill inside the reference rectangle");
  assert(alphaAt(WIDTH - spec.right, 701) > 0, "Right margin starts at the expected boundary");
  assert.equal(alphaAt(WIDTH - spec.right - 10, 701), 0, "No right fill inside the reference rectangle");
  assert(alphaAt(501, HEIGHT - spec.bottom) > 0, "Bottom margin starts at the expected boundary");
  assert.equal(alphaAt(501, HEIGHT - spec.bottom - 10), 0, "No bottom fill inside the reference rectangle");
  assert.equal(alphaAt(spec.left + 10, 701), 0, "No left fill inside the reference rectangle");
  if (spec.left) assert(alphaAt(spec.left - 1, 701) > 0, "Left margin reaches the expected boundary");
  return `${(transparent / (WIDTH * HEIGHT) * 100).toFixed(1)}% fully transparent`;
}

function createReadme() {
  const codeFence = String.fromCharCode(96).repeat(3);
  const rows = specs.map((spec) => `| [${spec.label}](github-assets/${spec.file}) | ${spec.top} | ${spec.right} | ${spec.bottom} | ${spec.left} |`).join("\n");
  const rectangles = specs.map((spec) => `| ${spec.label} | ${spec.left} | ${spec.top} | ${WIDTH - spec.left - spec.right} | ${HEIGHT - spec.top - spec.bottom} |`).join("\n");
  const previews = specs.map((spec) => `<td align="center"><a href="github-assets/${spec.file}"><img src="github-assets/${spec.file}" width="216" alt="${spec.label}: transparent 1080 by 1920 PNG reference overlay"></a><br>${spec.label}</td>`).join("\n");
  return `${HEADING}

> **Live Interactive Previewer & AI Storyboard Builder:** 👉 [VelunaKit](https://velunakit.com)

Three full-resolution, transparent PNG overlays for editing 9:16 vertical video. Put an overlay above your footage, move essential captions and subjects away from the marked UI bands, then **hide or remove the overlay before exporting**.

No account, image-generation API, or paid asset download is needed. The included generator runs locally using Node.js built-ins only: no canvas package, native bindings, fonts, or network requests.

## Download the PNGs

- [TikTok 2026 reference overlay — 1080 × 1920](github-assets/tiktok-safe-zone-1080x1920.png)
- [Instagram Reels reference overlay — 1080 × 1920](github-assets/reels-safe-zone-1080x1920.png)
- [Centered 900 × 1400 composition box — on a 1080 × 1920 canvas](github-assets/universal-900x1400-safe-box.png)

Open an image link and use GitHub's **Download raw file** control, or download this repository as a ZIP from **Code → Download ZIP**. Do not save a reduced-size README thumbnail when you need the original pixels.

**All three files are 1080 × 1920 pixels, with square pixels and an 8-bit alpha channel.** The universal filename describes the inner box, not the PNG canvas size. There is no white background, black background, or checkerboard baked into these assets. Colored bands and dashed grid marks are intentionally translucent; labels are visible reference annotations.

## Preview

Click a thumbnail to open the original PNG. A GitHub preview may show transparency against a light or dark background; your footage remains visible beneath it in an editor.

<table>
<tr><th>TikTok</th><th>Instagram Reels</th><th>Centered composition</th></tr>
<tr>
${previews}
</tr>
</table>

## Exact geometry used by these templates

Coordinates start at the **top-left** of the 1080 × 1920 frame: X increases to the right, Y increases downward. All margins below are in source-image pixels, not CSS pixels or phone-screen pixels.

| Reference preset | Top | Right | Bottom | Left |
| --- | ---: | ---: | ---: | ---: |
${rows}

| Clear reference rectangle | X | Y | Width | Height |
| --- | ---: | ---: | ---: | ---: |
${rectangles}

These values mirror the existing presets in VelunaKit's Safe Zone Checker. The grid repeats every **108 px horizontally** and **192 px vertically**, or 10% of the frame. The outline marks the inside edge of each reference rectangle; line thickness is included inside the stated rectangle.

### Important: reference guides, not official guarantees

The name **TikTok 2026** is this project's preset label, not a claim that TikTok publishes or guarantees these exact fixed margins. Actual controls vary with device, region, app version, caption length, post type, shopping controls, and advertising add-ons. For paid placements, use the platform's current official template and placement preview.

The TikTok PNG is the project's standard profile, **not the Shop variant**. The interactive tool has a Shop option with a **484 px bottom margin**; that extra space is not represented in this download.

Despite its filename, the **900 × 1400 universal box is a centered composition aid, not the intersection of every platform's unobstructed area**. It extends into the right and bottom bands of the supplied TikTok and Reels profiles. Check essential text against the relevant platform overlay, even when the subject is inside the universal box. Neither this collection nor the previewer guarantees that a platform will never cover your content.

## Use in your video editor

Start with a **1080 × 1920, 9:16, square-pixel** timeline. Keep the overlay centered, uncropped, and at its original size. Import each PNG as an individual still image, not an image sequence. Extend its duration across the whole edit so later captions, camera moves, and end cards are checked too.

### CapCut

1. Create a 9:16 project and add your main footage.
2. Import the PNG. On desktop, put it on a track above the footage; on mobile, use **Overlay → Add overlay**.
3. Fit the complete PNG to the frame, retaining its aspect ratio. Do not zoom or crop the reference grid independently of the footage.
4. Move captions, product labels, and important facial details away from the colored UI bands. Inspect the opening hook, longest subtitle, and end card.
5. Hide or remove the overlay layer, then export a clean video. Do not burn the grid into the final upload.

### Adobe Premiere Pro

1. Create or open a 1080 × 1920 sequence. Put footage on **V1**.
2. Use **File → Import** for one PNG, with image-sequence import disabled. Put the still on **V2** or another track above all content being checked.
3. Center the PNG. In a matching 1080 × 1920 sequence, use **Scale 100%** and verify that its full frame aligns with the sequence.
4. Extend the still to the end of the sequence. Lock the reference track while you adjust captions and graphics below it.
5. Disable the reference track or remove its clip before export, and review the exported file without the overlay.

### DaVinci Resolve

1. Set the timeline resolution to **1080 × 1920** and put the footage on **Video 1**.
2. Import one PNG into the Media Pool as a still, then place it on **Video 2** above the footage.
3. Keep it centered at **Zoom 1.0** in a matching-resolution timeline. Check that project scaling has not cropped the overlay.
4. Extend the still over the entire edit and lock its track. Move essential text and graphics out of the marked regions.
5. Disable or remove the guide track before rendering on the Deliver page. Confirm the rendered video contains no grid or labels.

Editor labels can change between versions; the same principle applies everywhere: **full-frame transparent still on the highest video track, removed before delivery**.

## Troubleshooting

**The preview has a black or white background. Is the PNG opaque?**

A standalone image viewer may use a solid display background for transparent pixels. Put the PNG above actual footage to check its alpha channel. Do not use chroma key or erase a background; transparency is already present.

**The grid does not line up with the video edges.**

Check timeline resolution, aspect ratio, pixel aspect ratio, position, and scale. A stretched or cropped overlay invalidates its pixel margins. On a 2160 × 3840 timeline, scale the entire PNG uniformly by 200%; all reference margins double too.

**Can I use the universal box as a caption-safe guarantee?**

No. It helps center the composition, but some of it overlaps the platform-specific UI bands. Use the actual destination profile for text placement, and inspect the final post preview.

**Do these include TikTok Shop, every ad placement, or every language layout?**

No. This download contains exactly three reference overlays. For Shop, try the [interactive Safe Zone Checker](https://velunakit.com/safe-zone-checker). For paid placements and right-to-left layouts, consult the platform's current official safe-zone files.

## Rebuild and verify locally

Requires **Node.js 22 or newer**. No package installation is needed. Run from this repository's root:

${codeFence}bash
node github-assets/generate-overlays.mjs
node github-assets/generate-overlays.mjs --check
${codeFence}

The first command regenerates these three PNGs and this README. The check-only command does not rewrite files: it validates PNG chunk checksums, 1080 × 1920 RGBA headers, decoded pixel data, genuine transparency, and README consistency. Given the same Node.js/zlib version, repeated generation produces identical bytes; there are no timestamps or random pixels.

Edit the preset values and README text in **github-assets/generate-overlays.mjs**, then regenerate; manual README edits would be overwritten. This script does not edit or deploy the website.

## Continue the workflow

- [Preview your local image or video with platform masks](https://velunakit.com/safe-zone-checker).
- [Build a character-consistent AI storyboard and timed prompt](https://velunakit.com/).
- [Check voiceover word count and timing](https://velunakit.com/script-timer).
- [Read the PNG overlay workflow guide](https://velunakit.com/guides/export-1080x1920-transparent-png-grid).

## Official references

- [TikTok auction in-feed ad specifications and safe-zone files](https://ads.tiktok.com/resources/help/article/tiktok-auction-in-feed-ads?lang=en): placement and device previews can differ; these community reference pixels are not a substitute for official ad templates.
- [CapCut overlay workflow](https://www.capcut.com/resource/how-to-add-capcut-overlays).
- [Adobe Premiere: import still images and preserve transparency](https://helpx.adobe.com/premiere/desktop/organize-media/import-files/import-still-images.html).
- [Blackmagic Design: DaVinci Resolve training](https://www.blackmagicdesign.com/products/davinciresolve/training).

This independent community collection is not affiliated with or endorsed by TikTok, Meta, Adobe, CapCut, or Blackmagic Design. Platform and editor names identify compatibility; no official UI screenshots, logos, or proprietary template files are redistributed here.
`;
}

const args = process.argv.slice(2);
assert(args.length === 0 || (args.length === 1 && args[0] === "--check"), "Usage: node github-assets/generate-overlays.mjs [--check]");
const checkOnly = args[0] === "--check";
const readme = createReadme();
const readmeUrl = new URL("../README.md", import.meta.url);
if (!checkOnly) {
  // Refuse to replace unrelated documentation; preserve it explicitly before first use.
  const existing = await readFile(readmeUrl, "utf8").catch((error) => {
    if (error.code === "ENOENT") return "";
    throw error;
  });
  assert(!existing || existing.startsWith(HEADING), "README.md contains other documentation; back it up before generating.");
}

for (const spec of specs) {
  const pixels = render(spec);
  const url = new URL(spec.file, import.meta.url);
  if (!checkOnly) await writeFile(url, encodePng(pixels, spec));
  const file = await readFile(url);
  const transparency = verifyPng(file, pixels, spec);
  console.log(`${checkOnly ? "Verified" : "Generated"} ${spec.file}: ${WIDTH}x${HEIGHT}, RGBA, ${file.length} bytes, ${transparency}`);
}
if (!checkOnly) await writeFile(readmeUrl, readme, "utf8");
assert.equal(await readFile(readmeUrl, "utf8"), readme, "README differs from its generator");
console.log(`${checkOnly ? "Verified" : "Generated"} ${fileURLToPath(readmeUrl)}`);
