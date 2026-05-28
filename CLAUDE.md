# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Speed Master Móstoles** is a repair shop management SPA for an electric scooter repair shop in Madrid. It is built with **vanilla HTML/CSS/JS** — no framework, no build step, no package manager.

- Manages repair orders through a status lifecycle: RECIBIDO → PENDIENTE → REPARANDO → FINALIZADO → PAGADO
- Stores orders in `localStorage`; syncs customer profiles to **Firebase Firestore**
- Authenticates users via **Firebase Auth**
- Prints dual-copy thermal tickets (72mm/80mm printers) using browser `window.print()`
- Sends WhatsApp notifications via `wa.me` deep links

## Running the App

1. Copy `firebase-config.example.js` → `firebase-config.js` and fill in real Firebase credentials.
2. Open `index.html` directly in a browser, or serve with any static HTTP server:
   ```
   npx serve .
   # or
   python -m http.server 8080
   ```
3. Unauthenticated users are redirected to `login.html` by `auth.onAuthStateChanged()`.

There are no build, test, or lint scripts.

## Architecture

All logic lives in two files:

| File | Role |
|------|------|
| `index.html` | App shell: tab pages, forms, tables, modals, hidden `#print-area` |
| `login.html` | Auth page |
| `scripts.js` | All application logic (~44 KB) |
| `styles.css` | All styling (~29 KB) |
| `firebase-config.js` | Firebase credentials (gitignored; create from example) |

### `scripts.js` Structure

The file is organized around a single in-memory `state` object and key subsystems:

- **AVERIA_PRICES / STATUS_CONFIG** — lookup tables for repair types and order statuses
- **localStorage helpers** — `getLocalOrders()` / `saveLocalOrders()` persist orders under the key `repara_shisha_orders`
- **Firestore sync** — `syncClientToFirestore()` and `lookupClientByPhone()` manage the `clientes` collection (keyed by phone number)
- **OTP/WhatsApp** — `generateAndSendSMS()` / `verifyOTP()` open `wa.me` deep links for manual OTP confirmation
- **Rendering** — `renderOrders()`, `renderRecibidos()`, `renderActions()` rebuild DOM sections from state
- **Printing** — `fillPrintArea()` populates the hidden `#print-area`; `executeSplitPrint()` triggers two sequential `window.print()` calls for client and shop copies
- **Order creation** — `saveOrder()` handles the repair ticket flow; `saveAndPrintSale()` handles the payment/sales ticket flow

### Page Tabs

| Element ID | Purpose |
|------------|---------|
| `pageOrden` | Order creation form (default tab) |
| `pageClientes` | Statistics dashboard + full order history table |

### Key Identifiers

- `#orderForm` — 2-column repair order form
- `#averiaBtnGrid` — dynamically generated repair-type buttons with prices
- `#recibidosBody` — "EQUIPOS RECIBIDOS" live table (right column, active orders only)
- `#historialBody` — full order history (CLIENTES tab)
- `#print-area` — hidden section rendered before each print

### Data Flow

```
User fills form
  → saveOrder() / saveAndPrintSale()
  → saveLocalOrders() [localStorage]
  → syncClientToFirestore() [Firestore: clientes collection]
  → fillPrintArea() → executeSplitPrint() [window.print()]
  → renderOrders() + renderRecibidos() [DOM refresh]
```

## Firebase

- **Auth** (compat SDK v10.12.5) — login/logout, route protection
- **Firestore** — `clientes` collection, one doc per unique phone number
  - Fields: `nombre`, `dni`, `direccion`, `telefono`, `lastUpdated`
- Remote Config is loaded but not actively used

## CSS Design Tokens

```css
--brand-dark:  #1A1A1D  /* nav/header background */
--brand-slate: #2C3E50  /* card backgrounds */
--brand-red:   #922B21  /* danger / logout */
--brand-gold:  #D4541A  /* primary CTA buttons */
--brand-navy:  #1A5276  /* info / success */
--brand-green: #1E8449  /* WhatsApp / verify */
```

## Business Context

- Company: Speed Master Madrid (Móstoles), CIF X4176357V
- Thermal tickets include: customer copy + shop copy, pricing, advance paid, balance due, and a 14-day returns policy footer
- Financial fields: **Precio Estimado** (auto or manual), **Adelanto** (advance), **Restante** (auto-calculated)
