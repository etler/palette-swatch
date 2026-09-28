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

## Responsive experiment

Swatches use the fewest rows needed to stay at least 100px wide, with the column count spread evenly across those rows. Rows fill left to right; any unused slots at the bottom right merge into one cell with a centered + button that appends a color. This empty cell follows the outline color. Rows share the window height; long palettes scroll once rows reach 128px tall (200px with color info enabled). Keyboard navigation keeps the original palette order across row boundaries.

## Interactions

- Click a hex code to edit. Click a name to rename it. On touchscreens, dragging starts after holding for 350ms or moving 10px, including from either title; a tap opens its editor.
- Hover near either edge of a swatch to reveal an insertion button.
- Insertion blends neighboring colors in sRGB. At the outer edges, it extrapolates one step beyond the last two colors, clipping channels to the valid range. With one swatch, it repeats that color.
- Hover near the top or bottom of a swatch to reveal its delete button. The last swatch is kept. On touchscreens, a single tap on a non-interactive area anywhere toggles the corner and bottom controls after the double-tap window. Double-taps, title taps, scrolling, and dragging do not toggle them; using visible buttons keeps them open. Delete and side add buttons are hidden; a shared Undo / Add swatch / Redo group appears at the bottom center of the swatch area. Add appends to the end of the palette, and unavailable history actions are disabled. Double-tapping a swatch’s color area opens its color picker. Hidden edge buttons do not intercept taps.
- The bottom-left corner cycles edge to edge, a thick outside border, and thinner outlines with equal-width outer edges and column gaps. The bottom-right ink-drop button toggles white/black, revealing the outside border from edge to edge. The ink fill follows the outline color. All four corner controls have Tab stops.
- The top-left info toggle shows selectable metadata above each swatch's titles. Titles keep their normal position until the info needs the space below; metadata scrolls after that space is used. Each readout scrolls independently with faded edges. Tab can focus a readout for native keyboard scrolling; text selection and copying do not edit the palette. Turning info off restores the original title placement. The info toggle is remembered in this browser.
- The top-right hamburger button toggles a persistent sidebar on the right. Its cog tab contains Settings; its eye tab contains Accessibility; its bookmark tab displays saved swatches; its upward-arrow tab exports the palette; on desktop, its keyboard tab lists shortcuts with Mac or Windows/Linux key labels based on the browser’s reported platform. Left/right arrows switch tabs, and switching tabs keeps unsaved settings. The sidebar’s open/closed state and selected tab are remembered in this browser. It reduces the palette area, rewrapping swatches while keeping them usable. Set minimum swatch width (60–1000px), window outline width, and border outline width (1–120px). Zero or blank outline widths use the existing responsive defaults. Save or Enter applies and remembers the values locally without closing the panel; Escape within the panel, the close button, or the menu button closes it and discards unsaved edits. Reset restores the original values when saved.
- Borders animate when changing color, expanding, and shrinking, taking up layout space inside the window; the swatches and their controls resize to fit. Reduced-motion settings skip the animation.
- The outline mode and white/black preference are remembered in this browser using localStorage.
- Drag a swatch to insert it at a new position, shifting the intervening swatches one slot. Wrapped rows use the same left-to-right palette order. Mouse dragging keeps the entire swatch inside the visible palette area, including outline insets and scroll position. Once dragging starts, the swatch follows the finger without constraining the swatch to those bounds. Double-click its color area to open its color picker.
- The picker’s bottom-left control changes the mode for all swatches. A channel’s shades button expands that swatch into 25 choices; Escape cancels.
- While dragging on a touchscreen, a red trash target appears at the top center above the swatches. Release over it to delete the dragged swatch; the last swatch is kept. Deletion is a single undoable action.
- A drag commits on release. A color picker session, including shade exploration, is one undoable edit. The checkmark or clicking outside the picker accepts its current color; X or Escape reverts it.
- Colors and names are stored in the URL as `#ABABAB:Meadow#121212#CDCDCD:Evening`. Names are optional and URL-encoded. Unnamed colors show no title; hovering a swatch or focusing its name control reveals “Add Name.” The name field starts empty and can be cleared to remove a name. Reordering preserves each custom name.

HSB and HSL include a two-dimensional picker. Every mode includes numeric fields and canvas-rendered channel gradients. White markers preserve the opening color. CMYK is an unprofiled screen approximation. LAB uses D50; out-of-sRGB colors clip to the same hex values shown in previews and saved in the URL.

Screen sampling uses the browser EyeDropper API where supported (such as desktop Chrome/Edge); it requires a secure context. Clipboard access also depends on browser permissions. Both controls report unavailable access without losing edits. Text uses CSS `contrast-color()` where supported, with a luminance-based black/white fallback.

## Export

The Export tab copies CSS custom properties, Tailwind CSS v4 theme variables, JSON, CSV, and plain text to the clipboard. PNG, SVG, Adobe ASE, and GIMP GPL download as files. Button icons indicate copy, download, or print. Print / PDF opens the browser print dialog with a separate paginated palette sheet; choose Save as PDF there. Everything runs locally, including from `dist/index.html` with networking disabled.

Exports use the current palette order and original sRGB colors, independent of vision simulation and outline settings. JSON keeps exact names, duplicates, and unnamed entries without internal IDs. Code exports use unique positional identifiers such as `swatch-1-ocean`. CSV quotes names and prefixes formula-like names with an apostrophe for spreadsheet safety; line-based formats flatten whitespace. SVG and PNG wrap after five swatches; very long visual labels are shortened, with full names retained in SVG titles and data exports. PNG uses 2× resolution, capped at 16 million pixels and 8192px per side. Print preserves full names.

The format selection draws on [Coolors](https://coolors-help.zendesk.com/hc/en-us/articles/360010581920-Export-a-palette), [Realtime Colors](https://www.realtimecolors.com/docs/exporting), and [Shademix](https://shademix.app/tools/export). Format references: [Tailwind theme variables](https://tailwindcss.com/docs/theme), [GIMP GPL specification](https://developer.gimp.org/core/standards/gpl/), and [ASE encoder reference](https://github.com/DominikGuzei/node-ase-utils/blob/master/encode.js).

## Color information

Readouts include RGB, HSL, HSB, approximate CMYK, Lab (D50), OKLCH, relative luminance, and contrast against black and white text. Conversions use the existing [Color.js color spaces](https://colorjs.io/docs/spaces); achromatic hue is shown as a dash. CMYK remains an unprofiled screen approximation.

Contrast follows [WCAG 2.2 relative luminance](https://www.w3.org/TR/WCAG22/#dfn-relative-luminance). Ratings use unrounded ratios: [AA](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) requires 4.5:1 for normal text or 3:1 for large text; [AAA](https://www.w3.org/WAI/WCAG22/Understanding/contrast-enhanced.html) requires 7:1 for normal text. Displayed ratios truncate to two decimals so they never round up to a passing threshold. These are text contrast ratings, not claims of overall accessibility conformance.

## Keyboard

| Context | Keys | Action |
| --- | --- | --- |
| Palette without an outline | Tab | Focus the selected swatch itself |
| Palette without an outline | Left / Right | Target the last clicked swatch or title; default to the first swatch |
| Palette without an outline | Up / Down | Up focuses the selected swatch; Down focuses its hex |
| Palette without an outline | Enter / Space | Outline the mouse-selected swatch or title without activating it |
| Palette with an outline | Left / Right | Target the neighboring swatch, wrapping at either end and retaining the same title or swatch target |
| Selected or focused swatch | Shift + = (+) | Insert a color to its right |
| Focused swatch | Enter | Open its color picker |
| Focused hex or name | Space / Enter | Open its popup |
| Palette with an outline | Up / Down | Down cycles swatch → hex → name → swatch; Up reverses the loop |
| Selected or focused swatch | Ctrl/Cmd/Alt + Left / Right | Swap with the neighboring swatch |
| Selected or focused swatch | Delete / Backspace | Remove the swatch; keep the last one |
| Selected swatch | Ctrl/Cmd + C | Copy hex and focus the swatch to show what was copied |
| Palette with an outline | Ctrl/Cmd + V | Insert clipboard hex to the right; accepts optional `#` and three- or six-digit hex |
| Palette | Escape | Clear the target outline |
| Palette | Ctrl/Cmd + Z; Ctrl/Cmd + Shift + Z or Ctrl + Y | Undo / redo; text fields retain native text undo |
| Picker | Up / Down | Step through HEX and each slider; crossing either endpoint opens the opposite end of the mode selector |
| Picker channel | Left / Right; Shift/Ctrl/Cmd + Left / Right; Alt + Left / Right | Focus the slider and adjust by 1, 10, or 0.1 respectively (Alt takes precedence) |
| Picker slider | Type a number; Space | Replace the channel value in its number input; open shades |
| Mode selector | Up / Down; Enter | Navigate modes; crossing either endpoint returns to the opposite end of the picker; Enter selects a mode |
| Shades | Arrows; Home / End | Navigate shades; jump to an endpoint |
| Name or color editor, including shades | Enter / Escape | Accept / discard the edit and return focus |
| Palette or settings | Shift + / | Toggle the settings sidebar |
| App | Alt + Enter; Escape | Toggle fullscreen; exit fullscreen |
| App | Ctrl/Cmd + Space | Cycle outline modes immediately |
| App | Ctrl/Cmd + Shift + Space | Toggle the outline color between white and black |

After the initial Tab focuses the selected swatch, subsequent Tab presses follow native focus navigation, with insertion buttons between neighboring swatches and at both ends. Left/right arrows skip insertion buttons. Shift+Tab and Tab within popups retain native behavior. Mouse clicks clear the keyboard outline. Move and delete shortcuts also work on the selection without an outline and reveal focus on the resulting swatch; palette clipboard shortcuts require visible focus.

## Verify

```sh
npm test
npx playwright install chromium
npm run build
npm run test:e2e
```

Tests cover color conversion, shades, history, names, URL loading, dragging, hover controls, keyboard navigation, clipboard, fullscreen, popup acceptance/cancellation, mobile bounds, and opening the standalone HTML file.

## Accessibility

The eye tab previews protanopia, deuteranopia, tritanopia, or grayscale on the swatches and shades. Simulation is temporary display state: it does not change HEX values, names, the URL, or undo history. Color edits and reordering update the sidebar live. Text contrast uses the original swatch color and its recommended black or white text; AA/AAA ratings use unrounded WCAG ratios for normal text. Displayed sidebar ratios round to one decimal. Adjacent pairs follow palette order across wrapped rows, without pairing the last swatch with the first. Low (<2:1), Fair (2–<3:1), and Good (≥3:1) are pair-contrast hints, not WCAG conformance labels.

Vision previews use the [Machado et al. (2009) simulation matrices](https://www.inf.ufrgs.br/~oliveira/pubs_files/CVD_Simulation/CVD_Simulation.html) at full severity in linear RGB, clipped to sRGB; grayscale uses relative luminance. These are approximations. Text thresholds follow [WCAG 2.2 contrast minimum](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) and [enhanced contrast](https://www.w3.org/WAI/WCAG22/Understanding/contrast-enhanced.html).

## Bookmarks

The bookmark button at the bottom right of the color picker saves the current preview color and its name. A filled icon means the hex is already saved, even if the current swatch has a different name; pressing it again removes the bookmark. The Bookmarks sidebar tab displays saved colors with their hex and title in a scrollable grid. Clicking a saved swatch appends its color and title to the end of the palette, with undo/redo support. Each card has an X button to remove its bookmark, revealed on hover or keyboard focus (always visible on touch devices). Bookmarks persist in localStorage independently of the palette URL and editing history. Accepting a rename updates the saved title for that hex; cancelling a rename leaves it unchanged. Saving a preview remains an explicit bookmark action even if the palette edit is later cancelled.
