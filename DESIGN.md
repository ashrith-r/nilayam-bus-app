---
name: NILAYA Modern Dark
description: A precise, restrained interface for the local Warangal transport simulation.
colors:
  ground: "#050505"
  panel: "#0e0e0e"
  field: "#090909"
  control: "#141414"
  active: "#191919"
  hairline: "#222222"
  hairline-strong: "#303030"
  bright: "#f2f2f2"
  read: "#a6a9ad"
  meta: "#8a8d91"
  live: "#3fd6c6"
  inverse-ink: "#0a0a0a"
  primary-hover: "#dcdcdc"
typography:
  headline:
    fontFamily: 'Geist, "Helvetica Neue", Arial, sans-serif'
    fontSize: "clamp(34px, 3.5vw, 48px)"
    fontWeight: 400
    lineHeight: 1.08
    letterSpacing: "-0.035em"
  title:
    fontFamily: 'Geist, "Helvetica Neue", Arial, sans-serif'
    fontSize: "15px"
    fontWeight: 500
    letterSpacing: "-0.01em"
  body:
    fontFamily: 'Geist, "Helvetica Neue", Arial, sans-serif'
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: 'Geist, "Helvetica Neue", Arial, sans-serif'
    fontSize: "12px"
    fontWeight: 450
  time:
    fontFamily: '"Geist Mono", "SFMono-Regular", Menlo, monospace'
    fontSize: "13px"
    fontWeight: 400
    letterSpacing: "-0.02em"
rounded:
  panel: "6px"
  pill: "999px"
spacing:
  gutter: "48px"
  gap: "24px"
  compact-gap: "20px"
  surface: "24px"
  field: "10px 12px"
  button: "9px 14px"
components:
  button-primary:
    backgroundColor: "{colors.bright}"
    textColor: "{colors.inverse-ink}"
    rounded: "{rounded.pill}"
    padding: "{spacing.button}"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
    textColor: "{colors.ground}"
  button-secondary:
    backgroundColor: "{colors.control}"
    textColor: "{colors.bright}"
    rounded: "{rounded.pill}"
    padding: "{spacing.button}"
  button-quiet:
    backgroundColor: "transparent"
    textColor: "{colors.read}"
    rounded: "{rounded.pill}"
    padding: "{spacing.button}"
  input:
    backgroundColor: "{colors.field}"
    textColor: "{colors.bright}"
    rounded: "{rounded.panel}"
    padding: "{spacing.field}"
  card:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.bright}"
    rounded: "{rounded.panel}"
    padding: "{spacing.surface}"
  navigation-active:
    backgroundColor: "{colors.active}"
    textColor: "{colors.bright}"
    rounded: "{rounded.panel}"
    padding: "10px 12px"
  status-chip:
    backgroundColor: "{colors.control}"
    textColor: "#c8c8c8"
    rounded: "{rounded.pill}"
    padding: "4px 8px"
---

# Design System: NILAYA Modern Dark

## Overview

**Creative North Star: "Operate UI"**

NILAYA uses the approved Modern Dark direction: a near-black workspace, opaque graphite surfaces, precise type, and restrained state signals. Its atmosphere is calm and operational. Journeys, departure times, queue state, and staff actions carry the hierarchy; visual treatment supports those tasks.

The same system spans Passenger, Operator, Admin, Stop Display, and Demo Controller. Information density changes with the role while typography, controls, and state treatments remain consistent. The implementation authority is `web/app.css`, including its final Modern Dark overrides, with the passenger composition extended by `web/journey.css`. Legacy variable names such as orange and cyan do not imply colored actions.

**Key Characteristics:**
- Opaque, flat graphite surfaces separated by fine borders.
- White primary actions and quiet secondary controls.
- Geist for interface text; Geist Mono for time and numeric readouts.
- Small mint state indicators and clear keyboard focus.
- Compact controls within generous page and section spacing.

## Colors

The palette is nearly monochrome, with mint reserved for compact state and focus signals. Frontmatter values are normative.

### Primary

- **Bright White** (`bright`): primary action fill, headings, important text, and route times.
- **Inverse Ink** (`inverse-ink`): text on the primary action.
- **Soft White Hover** (`primary-hover`): primary action hover feedback.

### Secondary

- **Live Mint** (`live`): status dots, active navigation icons, evidence dots, selected route and stop marks, and keyboard focus. A live-looking indicator accompanies simulation labels; it does not establish a real transport feed.

### Neutral

- **Near-black Ground** (`ground`): page canvas and top bar.
- **Graphite Panel** (`panel`): content containers.
- **Recessed Field** (`field`): inputs and selects.
- **Control Graphite** (`control`): secondary controls and compact status surfaces.
- **Active Graphite** (`active`): selected navigation.
- **Fine Hairline** (`hairline`) and **Structural Hairline** (`hairline-strong`): quiet dividers and stronger control boundaries.
- **Reading Gray** (`read`): explanatory text and secondary labels.
- **Metadata Gray** (`meta`): smaller context and supporting annotations.

**The State Signal Rule.** Use mint for compact state marks and focus, keeping large actions and surfaces neutral.

## Typography

**Display and Body Font:** Geist, with Helvetica Neue, Arial, and sans-serif fallbacks.

**Label/Mono Font:** Geist Mono, with SFMono-Regular, Menlo, and monospace fallbacks, for time and numeric readouts. Both families are bundled locally with their licenses.

**Character:** Light page headings provide breathing room above compact, legible operational information. Monospaced numerals make changing times and counts easy to compare.

### Hierarchy

- **Headline:** standard role page title, regular weight, tight tracking and line height; the exact desktop scale is in frontmatter. It becomes 40px below 900px and 34px below 560px. The passenger workspace uses a compact task heading, documented with its readout dimensions in `.impeccable/surfaces/journey.md`.
- **Title:** medium section titles; common surfaces use the frontmatter title role, with some subsection headings at 16px.
- **Body:** regular interface copy with comfortable leading; page descriptions use 1.6 leading and a maximum width of 70ch.
- **Label:** compact field labels; supporting copy generally uses 10–12px.
- **Time:** monospaced journey times. The same family also serves board clocks, first-column departure times, queue codes, statistics, and coordinates at role-specific sizes.

**The Readout Rule.** Use Geist Mono for changing times and numerical readouts; keep prose and navigation in Geist.

## Layout

Desktop shares a sticky top bar (66px) and a fluid main region capped at 1360px. Passenger uses the full content width, with Explore, Saved, and Queue in the top bar; a utility menu retains Places, Sources, and links to the staff apps. The journey planner leads the screen. A selected service occupies the left column, while the map and queue summary occupy the right; destination shortcuts and an all-places disclosure follow. Staff screens retain the left navigation rail (220px), forms, aligned records, and supporting panels. Main content uses the frontmatter gutter and gap tokens; standard content panels have 24px padding.

At 1180px the passenger workspace retains two columns with tighter spacing and 28px horizontal main padding; ordinary role content uses 24px. At 900px navigation becomes a fixed bottom bar, the journey workspace and ordinary split layouts stack, and the passenger search action spans the planner width. Bottom content padding reserves navigation clearance. At 620px the shared top bar becomes 58px and several dense lists simplify. At 560px main horizontal padding is 16px, passenger card padding is 20px, and journey fields form two stacked selections with a shared swap control and full-width action. Destination shortcuts change from four columns to two below 900px. The interface has a 320px minimum width.

Stop Display hides the navigation rail, uses a dedicated board container capped at 1420px, and preserves clear time, route, destination, and status columns. Its layout stacks on smaller screens. Preserve the role-specific workflows when extending layouts.

## Elevation & Depth

Depth comes from opaque tonal layers, whitespace, and thin borders. Persistent panels and navigation remain flat. Toasts, the passenger utility menu, and destination suggestions use compact shadows to separate transient content. The expanded map uses a dark native-dialog backdrop. No backdrop blur is used in the implemented navigation.

**The Flat Surface Rule.** Use tonal layers and hairlines for persistent surfaces; reserve shadow for transient feedback and popup content.

Motion is short and functional. Buttons use 120ms ease-out background and border transitions, navigation uses 160ms state transitions, and toasts use 180ms opacity and translation. Reduced-motion preferences collapse transitions and animations.

## Shapes

Panels, fields, notices, map tools, and navigation use small, precise corners through the panel radius token. Actions and status chips use the pill token. Borders are generally 1px. The map canvas remains rectangular within its clipped panel; compact outline SVG icons use consistent thin strokes. Passenger badges, segmented controls, and diagram annotations use scoped micro corners; those observed exceptions remain in the journey surface brief rather than expanding the global radius scale.

## Components

### Buttons

Confident, compact pill actions. Primary uses Bright White with Inverse Ink; hover softens the fill. Secondary uses Control Graphite with a structural border; hover raises its tone and border contrast. Quiet actions are transparent with secondary text. Standard buttons have a 39px minimum height and the frontmatter padding; small variants use 31px minimum height and 6px 10px padding. Active press shifts by 1px; disabled controls reduce opacity and suppress the press transform. Keyboard focus uses a 2px mint outline with a 4px offset.

### Chips

Compact outlined pills distinguish Simulation, Operator-entered, and queue states in text. Common status chips include a small mint dot; labels provide the meaning. Simulation and demo labels stay visible where the underlying data requires them.

### Cards / Containers

Flat graphite panels with fine hairline borders, small corners, and the frontmatter surface padding. Lists within panels use dividers instead of a separate card for every record. Queue tickets, staff control groups, and data banners share the surface language.

### Inputs / Fields

Recessed dark fields with structural hairline borders, small corners, a 42px minimum height, and frontmatter field padding. Placeholders use Reading Gray. Focus adds a 2px mint outline at 2px offset and a lighter border, with no glow. Textareas have a 92px minimum height and resize vertically. Keep labels explicit and adjacent to their fields.

The passenger planner groups its controls into taller field containers. Boarding uses a native select; destination uses a keyboard-operable combobox with a suggestion list. Search matches place names, aliases, areas, and SIM service numbers. The microphone is an explicit user action with typed-search fallback.

### Navigation

The staff desktop rail uses muted labels and outline icons. Selected navigation uses Active Graphite, a structural border, bright text, and a mint icon. Passenger desktop navigation instead uses a bright bottom rule and a mint outline icon for its active top-bar destination. The passenger utility menu is a native disclosure; Escape closes it and returns focus to its summary. Hover stays neutral. At 900px and below, the existing navigation becomes a bottom bar with stacked icon and label. Stop Display suppresses it entirely.

### Journey and departure records

Route and destination lead each record; monospaced time sits opposite on wide screens. Supporting duration and provenance sit below, separated from the next record by a fine divider. At narrow widths the route and time stack. Public board rows keep their numerical alignment and readable status labels. Refreshes must not displace a user's active controls.

The selected passenger service gives the arrival range and IST boarding window distinct monospaced readouts, followed by ride time, headway, and an ordered stop timeline. Later services use a disclosure and an explicit selected state. Save and read-aloud actions remain adjacent to the selected journey. Surface-specific sizes are recorded in the journey brief and sidecar previews.

### Passenger route map and queue summary

The map is an illustrative street schematic with neutral roads and blocks, a thin mint selected route, labeled stop markers, and a simulated bus marker. Map and Stops are alternate views of the same ordered journey. A selected stop exposes start/destination actions. Pan, zoom, fit, marker selection, and the expanded native dialog retain keyboard access; closing the dialog restores focus to its expand control.

The adjacent queue summary shows the token's actual station when a saved token exists and opens management for that station. Without a token, it describes the demonstration queue associated with the selected origin. Queue codes and the protected-break countdown use the mono family. These controls continue to use shared queue records rather than a separate passenger-only queue.

## Do's and Don'ts

### Do:

- **Do** use the final Modern Dark CSS overrides and scoped passenger stylesheet as the implementation authority.
- **Do** keep large actions neutral and reserve mint for compact state and focus signals.
- **Do** use Geist Mono for changing times, queue codes, and numeric readouts.
- **Do** preserve visible simulation provenance and the distinction between operator entries and generated services.
- **Do** preserve keyboard focus, responsive navigation clearance, and role-specific workflows.

### Don't:

- **Don't** restore the obsolete orange/cyan action palette or Inter typography.
- **Don't** use gradients, decorative glow, or translucent panels in this opaque graphite system.
- **Don't** replace labeled status with color alone.
- **Don't** promote simulated times or approximate map geometry into verified transport guidance.
- **Don't** let a passenger's private journey selection reconfigure the public Stop Display.

