# Palette

An edge-to-edge color explorer with custom names, animated reordering, five editing modes, and 25-step channel shades.

## Run

```sh
npm install
npm run dev
```

`npm run build` creates a self-contained `dist/index.html`. Open that file directly or host it on a static web server. No backend or external assets are required.

## Hosted app

[Open Palette](https://etler.github.io/palette-swatch/). Every push to `main` runs the unit tests, builds the app, and deploys `dist` to GitHub Pages through `.github/workflows/pages.yml`. The workflow can also be run manually from GitHub Actions.

## Interactions

- Click a hex code to edit. Click a name to rename it.
- Hover near either edge of a swatch to reveal an insertion button.
- Insertion blends neighboring colors in sRGB. At the outer edges, it extrapolates one step beyond the last two colors, clipping channels to the valid range. With one swatch, it repeats that color.
- Hover near the top or bottom of a swatch to reveal its delete button. The last swatch is kept.
- Hover in either left window corner for the outline mode button. Each click immediately cycles edge to edge, a thick outside border, and thinner outlines with equal-width outer edges and column gaps. The right corners have ink-drop buttons that toggle white/black, revealing the outside border from edge to edge. The ink fill follows the outline color. Each top corner has a Tab stop; the bottom controls are mouse-only duplicates.
- Borders animate when changing color, expanding, and shrinking, taking up layout space inside the window; the swatches and their controls resize to fit. Reduced-motion settings skip the animation.
- Drag a swatch over another to swap their positions. Double-click its color area to insert a new color to its right using the same blend/extrapolation rules as +.
- The picker’s bottom-left control changes the mode for all swatches. A channel’s shades button expands that swatch into 25 choices; Escape cancels.
- A drag commits on release. A color picker session, including shade exploration, is one undoable edit. Clicking outside the picker accepts its current color.
- Colors and names are stored in the URL as `#ABABAB:Meadow#121212#CDCDCD:Evening`. Names are optional and URL-encoded. A missing name defaults to `Color 1`, `Color 2`, etc. Reordering preserves each swatch’s name.

HSB and HSL include a two-dimensional picker. Every mode includes numeric fields and canvas-rendered channel gradients. White markers preserve the opening color. CMYK is an unprofiled screen approximation. LAB uses D50; out-of-sRGB colors clip to the same hex values shown in previews and saved in the URL.

Screen sampling uses the browser EyeDropper API where supported (such as desktop Chrome/Edge); it requires a secure context. Clipboard access also depends on browser permissions. Both controls report unavailable access without losing edits. Text uses CSS `contrast-color()` where supported, with a luminance-based black/white fallback.

## Keyboard

| Context | Keys | Action |
| --- | --- | --- |
| Palette without an outline | Tab | Focus the selected swatch itself |
| Palette without an outline | Left / Right | Target the last clicked swatch or title; default to the first swatch |
| Palette without an outline | Up / Down | Up focuses the selected swatch; Down focuses its hex |
| Palette without an outline | Enter / Space | Outline the mouse-selected swatch or title without activating it |
| Palette with an outline | Left / Right | Target the neighboring swatch, wrapping at either end and retaining the same title or swatch target |
| Selected or focused swatch | Space twice within 350 ms | Insert a color to its right; a single press only reveals or retains focus |
| Focused swatch | Enter | Open its color picker |
| Focused hex or name | Space / Enter | Open its popup |
| Palette with an outline | Up / Down | Down cycles swatch → hex → name → swatch; Up reverses the loop |
| Selected or focused swatch | Ctrl/Cmd/Alt + Left / Right | Swap with the neighboring swatch |
| Selected or focused swatch | Delete / Backspace | Remove the swatch; keep the last one |
| Palette with an outline | Ctrl/Cmd + C / V | Copy hex / insert clipboard hex to the right; accepts optional `#` and three- or six-digit hex |
| Palette | Escape | Clear the target outline |
| Palette | Ctrl/Cmd + Z; Ctrl/Cmd + Shift + Z or Ctrl + Y | Undo / redo; text fields retain native text undo |
| Picker | Up / Down | Step through HEX and each slider; crossing either endpoint opens the opposite end of the mode selector |
| Picker channel | Left / Right; Shift/Ctrl/Cmd + Left / Right; Alt + Left / Right | Focus the slider and adjust by 1, 10, or 0.1 respectively (Alt takes precedence) |
| Picker slider | Type a number; Space | Replace the channel value in its number input; open shades |
| Mode selector | Up / Down; Enter | Navigate modes; crossing either endpoint returns to the opposite end of the picker; Enter selects a mode |
| Shades | Arrows; Home / End | Navigate shades; jump to an endpoint |
| Name or color editor, including shades | Enter / Escape | Accept / discard the edit and return focus |
| App | Alt + Enter; Escape | Toggle fullscreen; exit fullscreen |
| App | Ctrl/Cmd + Space | Cycle outline modes immediately |
| App | Ctrl/Cmd + Shift + Space | Toggle the outline color between white and black |

After the initial Tab focuses the selected swatch, subsequent Tab presses follow native focus navigation, with insertion buttons between neighboring swatches and at both ends. Left/right arrows skip insertion buttons. Shift+Tab and Tab within popups retain native behavior. Mouse clicks clear the keyboard outline. Move and delete shortcuts also work on the selection without an outline; palette clipboard shortcuts require visible focus.

## Verify

```sh
npm test
npx playwright install chromium
npm run build
npm run test:e2e
```

Tests cover color conversion, shades, history, names, URL loading, dragging, hover controls, keyboard navigation, clipboard, fullscreen, popup acceptance/cancellation, mobile bounds, and opening the standalone HTML file.
