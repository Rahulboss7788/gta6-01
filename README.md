# gta6-01

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/Rahulboss7788/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/Rahulboss7788/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

Solmar Bay — an original open-world crime game. You are Dario Cruz, a driver with $250 and a debt, in a sun-soaked coastal city of your own: a grid of avenues and towers, a beach and boardwalk, docks, a park and a lighthouse. Explore on foot or steal any car and drive it; traffic fills the streets and pedestrians fill the sidewalks. Run five story missions for Mara Solis — from your first stolen car to a harbor heist and a sunset showdown at the lighthouse — take taxi fares, hunt 23 golden sun coins, fight harbor guards, and lose the Solmar Bay PD when the wanted stars come out. Wanted level 0–5 with chasing patrol cars, busted and wasted screens, a HUD with a live minimap, health and cash, golden-hour light, synthesised engine hum, sirens and music, and a save that continues your story.

No build step, no network requests: static files under game/ that open in desktop Chrome and play. Three.js is vendored as game/vendor/three.min.js; every building face, road, sign and character is drawn in code, and every sound is synthesised live with the Web Audio API.

## Run it

```sh
python3 -m http.server -d game
```

Then open http://localhost:8000 and press New Game. Or `node serve.ts` and open http://localhost:8080.

## Controls

WASD move / drive · mouse drag to look · click to shoot · E steal / enter / exit a car · F punch · T take a taxi fare · Shift run · Space jump / handbrake · P pause · M sound

---

<sub>Entered on [make.fun](https://make.fun/?ref=xt0p49wj&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
