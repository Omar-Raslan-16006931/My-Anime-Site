<div align="center">

<img src="https://capsule-render.vercel.app/api?type=waving&color=gradient&customColorList=26&height=200&section=header&text=AniWave&fontSize=56&fontColor=ffffff&fontAlignY=36&desc=Stream%20anime%2C%20TV%20and%20movies%20with%20progress%20sync%20and%20an%20iOS%20app&descSize=16&descAlignY=58&animation=fadeIn" width="100%" alt="AniWave"/>

<img src="https://img.shields.io/github/last-commit/Omar-Raslan-16006931/My-Anime-Site?style=for-the-badge&color=6366f1" alt="Last commit"/>
<img src="https://img.shields.io/github/languages/top/Omar-Raslan-16006931/My-Anime-Site?style=for-the-badge&color=0ea5e9" alt="Top language"/>

<br/><br/>

<img src="https://skillicons.dev/icons?i=react,js,vite,supabase,vercel,githubactions&theme=dark" alt="Tech stack"/>

</div>

---

## ✨ Features

- 🎬 **Browse anime, TV shows and movies:** trending, search and detail pages using TMDB, AniList and Jikan data
- ▶️ **Custom video player:** HLS playback, quality selection, multiple sources, next/previous episode and English subtitles
- 📺 **Continue watching:** per-episode progress saved to Supabase
- ⭐ **Watchlist and profile** with Supabase Auth and passkey login
- ⬇️ **Downloads page** for offline viewing in the iOS app
- 📱 **iOS app** via Capacitor, built as an unsigned IPA by GitHub Actions
- 🧩 **Serverless API** (Vercel functions) for source resolving and subtitles, so API keys stay on the server

## 🛠️ Tech Stack

| Layer | Tech |
| --- | --- |
| Frontend | React, Vite, React Router, hls.js |
| Backend | Vercel serverless functions (Node.js) |
| Data / Auth | Supabase (Postgres, Auth, passkeys) |
| APIs | TMDB, AniList GraphQL, Jikan |
| Mobile | Capacitor (iOS), GitHub Actions |

## 🚀 Getting Started

```bash
npm install
cp .env.example .env   # Supabase URL/key + TMDB key
npm run dev
```

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_KEY=your_supabase_anon_key
VITE_TMDB_API_KEY=your_tmdb_api_key
```

---

<div align="center">

**Made with ❤️ by [Omar Raslan](https://github.com/Omar-Raslan-16006931)**

<img src="https://capsule-render.vercel.app/api?type=waving&color=gradient&customColorList=26&height=100&section=footer" width="100%"/>

</div>
