---
name: betterrx-design
description: Apply BetterRX's real brand design system to any UI in this project. Use whenever building or restyling a screen, component, chart, or slide for the BetterRX DME bounty — order lists, dashboards, forms, status badges, mobile nurse flows, pitch decks. Also triggers on "make this look like BetterRX", "style this", "brand this", or any request where visual design matters. Tokens are extracted from betterrx.com and from the bounty brief BetterRX authored, not invented.
---

# BetterRX Design System

Judging gives **15% to UX and intuitiveness**. Showing the sponsor their own design language back is close to free points, and it makes the demo read as a BetterRX product rather than a hackathon prototype.

## Provenance

Tokens are measured, not guessed:
- **betterrx.com** (live, computed styles): `--color-brand #ef7869`, `--color-brand-alt #f4916c`, `--color-secondary #425b76`, `--color-off-white #f5f7fa`, Poppins throughout, buttons `border-radius: 3px`, weight 800, uppercase.
- **`docs/bounty/original/dme-hackathon-bounty-brief.html`** — BetterRX authored this for *this exact problem*. Its `:root` is the fuller system and includes the status palette and the risk-state styling. **This is the closest thing we have to "what BetterRX thinks a DME product looks like."**

The two agree on the core: salmon `#EF7869` brand, slate ink `#24333F`, warm off-white paper, Poppins.

## Tokens

Import `tokens.css` from this skill directory, or paste this block.

```css
:root{
  /* Ink and paper */
  --ink:#24333F;          /* primary text, dark surfaces */
  --ink-soft:#55636D;     /* secondary text, captions */
  --paper:#FBFAF8;        /* page background — warm, never pure white */
  --paper-alt:#F7F6F5;    /* alternating sections */
  --surface:#FFFFFF;      /* cards sit white on warm paper */
  --line:#DEE2E5;
  --line-soft:rgba(36,51,63,0.08);

  /* Brand */
  --salmon:#EF7869;       /* primary brand */
  --burnt:#F4916C;        /* accent, active tab, eyebrow text */
  --orange:#F8A76F;
  --burnt-dark:#8F4B22;   /* accessible salmon-family TEXT on light */
  --taupe:#FDEBDA;        /* warm tint fill */
  --secondary:#425B76;    /* slate — secondary buttons, nav */
  --secondary-hover:#374D65;

  /* Status */
  --royal:#528DC1;
  --ocean:#43B3D0;
  --purple:#6956A4;
  --green:#71BA4F;
  --red:#EB7870;
  --red-tint:#FBEAE9;     /* at-risk row background, from the brief */

  --gradient:linear-gradient(120deg, var(--burnt), var(--orange));
  --shadow:0 1px 2px rgba(36,51,63,0.06), 0 8px 24px rgba(36,51,63,0.06);
  --radius-card:10px;
  --radius-quote:8px;
  --radius-btn:3px;
  --radius-badge:10px;
}
```

Fonts, one link:
```html
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
```

**Poppins for headings and numbers. Inter for body, labels, and UI chrome.** Don't mix them up — the brief is strict about this and it's the single fastest tell that you matched their system.

## Accessibility, and one real trap

Salmon `#EF7869` has roughly **2.8:1** contrast against white. That fails AA for body text *and* narrowly fails AA-large. The marketing site gets away with white-on-salmon in a 48px hero; a clinical UI does not.

- Never set body text, small labels, or form text in `--salmon`.
- For salmon-family **text on light**, use `--burnt-dark #8F4B22` (~6.5:1 on white).
- For text **on a salmon fill**, use `--ink`, not white (~4.4:1), unless it's display type above 32px.
- `--ink` on `--paper` is the default pairing for everything readable.

Verify with a contrast checker before shipping; those figures are approximate.

Remember who the user is: high nurse turnover means every user is a first-time user, on a phone, possibly standing in a patient's home. Sponsor's own words — *"your grandmother's least technical friend."* Big targets, obvious labels, no icon-only controls, no hover-dependent affordances.

## Components

### Card — the workhorse
```css
.card{
  background:var(--surface);
  border:1px solid var(--line);
  border-radius:var(--radius-card);
  padding:22px 24px;
  box-shadow:var(--shadow);
}
.card h3{ font-family:Poppins; font-weight:600; font-size:16.5px; margin-bottom:10px; color:var(--ink); }
.card li{ font-size:14.8px; margin-bottom:8px; }
```

### Eyebrow — section label above every heading
```css
.eyebrow{
  font-family:Inter; font-size:12px; font-weight:700;
  letter-spacing:.1em; text-transform:uppercase;
  color:var(--burnt); margin-bottom:10px; display:block;
}
```

### Quote card — left rule in burnt, italic body
```css
.quote-card{
  background:#fff; border:1px solid var(--line);
  border-left:4px solid var(--burnt);
  border-radius:var(--radius-quote); padding:18px 20px; box-shadow:var(--shadow);
}
.quote-card p{ font-size:15px; font-style:italic; color:var(--ink); }
.quote-cite{ font-size:11.5px; font-weight:700; letter-spacing:.05em; text-transform:uppercase; color:var(--ink-soft); }
```
Use this verbatim for the hospice-exec quotes in the pitch. It's their own component.

### Buttons — from the live site
```css
.btn{ font-family:Inter; font-weight:800; font-size:13px; text-transform:uppercase;
      border:0; border-radius:var(--radius-btn); padding:12px 20px; color:#fff; cursor:pointer; }
.btn-primary{ background:var(--salmon); }
.btn-primary:hover{ background:#E86857; }
.btn-secondary{ background:var(--secondary); }
.btn-secondary:hover{ background:var(--secondary-hover); }
.btn-lg{ padding:16px 32px; font-size:16px; }
```
3px radius. Not pills, not 8px. This is distinctive and easy to get wrong.

### Badge
```css
.badge{ display:inline-block; font-size:10.8px; font-weight:700; letter-spacing:.05em;
        text-transform:uppercase; padding:2px 8px; border-radius:var(--radius-badge); }
```

### Rubric-style table — dark ink header
```css
table.data{ width:100%; border-collapse:collapse; background:#fff;
            box-shadow:var(--shadow); border-radius:var(--radius-card); overflow:hidden; }
table.data th{ background:var(--ink); color:#fff; font-size:11px; letter-spacing:.06em;
               text-transform:uppercase; font-weight:700; text-align:left; padding:14px 18px; }
table.data td{ padding:14px 18px; border-bottom:1px solid var(--line-soft); font-size:14.3px; }
table.data tr:last-child td{ border-bottom:none; }
```

## DME status semantics

Map the six lifecycle states (see `wiki/facts/order-lifecycle.md`) onto the palette. The **risk treatment is lifted directly from the brief** — it styles at-risk stages with a `#FBEAE9` fill and `--red` text, so this isn't our invention.

| State | Color | Fill |
|---|---|---|
| Ordered | `--royal` | `#EDF3F9` |
| Dispatched | `--ocean` | `#E7F5F9` |
| In Transit | `--burnt` | `#FDF1E9` |
| **At Risk** | `--red` | `--red-tint #FBEAE9` |
| Delivered | `--green` | `#EEF6E9` |
| Pickup Triggered | `--purple` | `#F1EDF7` |
| **Pickup Delayed** | `--red` | `--red-tint` |

**Never encode risk by color alone.** Every at-risk state carries an icon or a text label too — colorblind users, and the brief explicitly demands explainability: *"why was this order flagged as at-risk?"* should have a legible answer. Put the reason string next to the badge, not behind a tooltip.

## Layout heuristics

- Page background is `--paper`, **never pure white.** White is for cards floating on it. That warmth is the most recognizable thing about their look.
- Max content width `1180px`. Cards in a `grid` with `gap:22px`; collapse to one column on mobile.
- Headings `clamp(24px,3vw,32px)`; hero `clamp(30px,4.2vw,48px)`.
- Sticky tab bar in `--paper` with a `--line` bottom border; active tab is `--burnt` text plus a 3px `--burnt` bottom border. Numbered tabs (`01`, `02`) in `--line` grey are a signature move from the brief.
- One shadow, everywhere: `--shadow`. Don't invent a second elevation.
- Generous vertical rhythm. Their pages breathe; a cramped dense grid reads as someone else's product.

## Mobile first, for real

The case manager orders from a **phone, in a web app, in a patient's home.** The DON reviews on desktop. Build the phone layout first.

- Minimum touch target 44×44px.
- Single column, one primary action per screen.
- The at-risk banner is the first thing above the fold, not buried in a list.
- Test at 375px before you test at 1280px.

## Don'ts

- No pure `#FFF` page background.
- No salmon body text.
- No second font family beyond Poppins + Inter.
- No pill buttons or 8px+ button radii.
- No dark mode. Their product is light-only; inventing a dark theme spends time on something no judge asked for.
- No emoji as status icons in the app UI. This is hospice software; a patient just died in half these flows. Keep the tone plain and calm.

## Tone of voice

Match the sponsor's own register: direct, warm, unsentimental. The site headline is *"A Better Hospice Pharmacy."* Their brief says things like *"None of them need to be polished. They need to be true, specific, and real."*

Write UI copy the same way. "Bed arrives Tue 2:10 PM, 40 min after discharge" beats "Delivery SLA breach detected."
