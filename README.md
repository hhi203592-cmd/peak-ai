# PEAK AI v0.2 — Gemini backend

PEAK is a small chat website connected to Google's Gemini Interactions API. The browser talks only to `/api/chat`; the Gemini API key stays on the server.

## Requirements
- Node.js 20 or newer
- A Gemini API key from Google AI Studio

## Run locally
1. Copy `.env.example` to `.env`.
2. Put your key in `GEMINI_API_KEY` in `.env`.
3. Run `npm install`.
4. Run `npm start`.
5. Open `http://localhost:3000`.

Never commit `.env` or put the key in `public/index.html`.

## Configuration
- `GEMINI_API_KEY`: required secret.
- `GEMINI_MODEL`: optional; defaults to `gemini-3.8-flash`.
- `PORT`: optional; defaults to `3000`.

The app uses the Gemini Interactions API. It saves the returned interaction ID with each chat in the browser and sends it back to continue the conversation. Starting a new PEAK chat starts a new Gemini conversation.

## Deployment
This project needs a Node.js host. GitHub Pages can host static files only and cannot run `server.js`. On a Node.js hosting provider, deploy this folder, set the start command to `npm start`, and add `GEMINI_API_KEY` as a server-side environment variable in the host's dashboard. Do not upload `.env`.

The API endpoint has a basic per-IP request limit. For a public launch, add user authentication, stronger abuse protection, usage monitoring, and spending/quota alerts.
