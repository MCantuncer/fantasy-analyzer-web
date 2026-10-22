# fantasy-analyzer-web

Web client for the ESPN fantasy basketball analyzer. Enter a league ID (or paste your ESPN team page URL), pick your team, and get:

- **Your categories:** how often you win each one in an average week, tagged locked, swing or losing.
- **Trades to offer:** 1-for-1 deals that help you without hurting the other team's build, with your playoff odds before and after, and how the deal reads on paper.
- **Pickups:** free agents with the right drop and their effect on your playoff odds.
- **League builds:** every team's category ranks and likely punts.
- **Season projection:** simulated standings and playoff odds for every team.
- **Keepers:** mark players you won't move and rerun.

The backend lives in [fantasy-analyzer-api](https://github.com/MCantuncer/fantasy-analyzer-api).

## Run locally

Start the backend first (see its README, it listens on port 8000), then:

```sh
npm install
npm run dev
```

Open http://localhost:5173. In development, `/api` is proxied to `http://localhost:8000`. For a deployed backend, build with `VITE_API_URL=https://your-api.example.com npm run build`.

```sh
npm test        # unit tests
npm run lint
npm run build   # type-check and production build
```

## API types

`src/api/schema.d.ts` is generated from the backend's OpenAPI schema. After the API changes, copy its `openapi.json` to `src/api/openapi.json` and run:

```sh
npm run gen:api
```

## Private leagues

When ESPN says a league is private, the app asks for the user's `espn_s2` and `SWID` cookies and explains where to find them.

- They are kept in `sessionStorage` (gone when the tab closes), or in `localStorage` only if the user ticks "Remember on this device". "Forget ESPN cookies" clears both.
- They are sent to the backend in request headers, never in the URL. Shareable links contain only the league and team IDs.
- Production builds ship a strict Content Security Policy with no third-party scripts, to limit the risk of the cookies being read by injected code.
