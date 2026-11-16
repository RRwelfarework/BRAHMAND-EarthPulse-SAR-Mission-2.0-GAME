# BRAHMAND EarthPulse: SAR Mission 2.0 GAME 

An interactive browser game about interpreting simulated SAR radar readings, identifying possible flood sectors, and coordinating rescue operations.

> **Educational simulation only.** Radar readings and disaster scenarios are generated for gameplay. They are not actual NISAR observations or emergency information.

## Run the game

No installation, build step, or server is required. Open `index.html` in a modern web browser.

## How to play

1. Choose a difficulty and disaster scenario.
2. Select a sector on the 6 × 6 observation grid to inspect its simulated VV backscatter.
3. Classify it as **FLOODED** or **SAFE**.
4. Correctly identify a flooded sector to unlock a rescue deployment. Each deployment uses one rescue unit.
5. Classify all 36 sectors before time expires.

Advanced and Expert missions also end after too many incorrect decisions.

## Difficulty

| Level | Time | Flood sectors | Rescue units | Incorrect decisions allowed | Wrong-answer penalty |
| --- | ---: | ---: | ---: | ---: | ---: |
| Beginner | 120 seconds | 8 | 5 | No limit | 20 EIP |
| Advanced | 100 seconds | 11 | 4 | 4 | 50 EIP |
| Expert | 85 seconds | 14 | 3 | 2 | 75 EIP |

## Scoring and features

- Correctly classifying a flooded sector: **+100 EIP**
- Correctly classifying a safe sector: **+25 EIP**
- Incorrect classification: deducts the difficulty penalty; score cannot drop below zero
- Successful rescue deployment: **+150 EIP**
- Achievements and a top-five session leaderboard
- Animated radar grid and mission status
- Optional synthesized game music and spoken cues, controlled by the **SOUND** and **VOICE** buttons

The music is generated with the browser's Web Audio API. Voice cues use the Web Speech API and depend on browser/device speech support. Audio starts when a mission is launched to comply with browser autoplay restrictions. Session scores and achievements are held in memory and reset when the page is reloaded.

## Project files

- `index.html` — game interface
- `style.css` — responsive layout, colors, and animations
- `script.js` — mission logic, scoring, audio, and voice cues
