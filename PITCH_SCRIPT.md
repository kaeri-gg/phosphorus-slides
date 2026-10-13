# White Phosphorus: An Explosive Escape: 3-minute pitch

Slides live in `public/pitch.md` (7 slides). Spoken script is ~430 words, about 2:50 at a calm pace.
Advance with the right arrow key. The on-screen timer is set to 3:00.

| # | Slide | Time | Cumulative |
|---|-------|------|------------|
| 1 | Title | 0:15 | 0:15 |
| 2 | Chemistry you can play | 0:25 | 0:40 |
| 3 | Real chemistry is the rulebook | 0:35 | 1:15 |
| 4 | Escape the factory | 0:30 | 1:45 |
| 5 | Learn by escaping | 0:35 | 2:20 |
| 6 | Four students, one web game | 0:15 | 2:35 |
| 7 | Play it in your browser | 0:20 | 2:55 |

---

### 1. Title (0:15)
"Hi everyone! This is **White Phosphorus: An Explosive Escape**, a small platformer where the air is literally trying to kill you."

### 2. Chemistry you can play (0:25)
"We built it for our Learning Game Development course at Tallinn University. Our question was: how do you make chemistry feel fun instead of dry? Our answer was to make the element itself the hero. White phosphorus is a real element that bursts into flames when it touches air. In our story, a piece of phosphorus is stuck in a factory that wants to use it for explosives, and it has to escape."

### 3. Real chemistry is the rulebook (0:35)
"Here's the clever part: the rules of the game *are* the chemistry. In water, phosphorus is stable and safe. That's why real white phosphorus is stored under water. Step out into the air and you ignite, and you lose one of your seven health points every 1.8 seconds. So you can't just run, you have to plan your route from tank to tank. And the glowing blue phosphoric acid heals you. Players don't read about this. They *feel* it."

### 4. Escape the factory (0:30)
"The game is set in a pipe-filled factory. You run and double-jump between water tanks while dodging fireworks, bombs and deadly red pipes. Some tanks are empty, so you find blue valves and open them to fill the tanks before you can move on. There are four hand-drawn levels to get through."

### 5. Learn by escaping (0:35)
"Between levels, short comic scenes tell you real facts about phosphorus, so the learning happens as a reward and not as a lecture. The ending pays it all off. In the vacuum oven, our hero turns into **red phosphorus**, a calm, stable form of the element. In the character's words: 'They can't use me for dangerous explosives anymore.' The player has understood the difference between the two forms without ever opening a textbook."

### 6. Four students, one web game (0:15)
"We are four students: Anna, Ai, Qianying and Kathleen. We split art, level design, code, sound and story between us, and built everything in Godot 4.6."

### 7. Play it in your browser (0:20)
"It runs right in the browser. There's nothing to install, and it's free on itch.io. Scan the QR code and try it now. Just remember: stay wet. Thank you!"

---

## Delivery tips
- Open the deck and let it fully load **before** you go on stage (the first slide appears after the images preload). Use `npm run build` and `npm run preview` for a fast, reliable load instead of the dev server.
- If you're running late, drop the last sentence of slide 4 and the second half of slide 5.
- Have the game open in another tab as a backup, in case someone asks for a live demo.

## Notes on facts
- 7 HP, 1.8 s burn tick, double jump, blue phosphoric acid healing, 4 levels: all taken from the game's code and scenes.
- "Stored under water" and "ignites in air" are standard facts about white phosphorus and match the game's premise.
- The "can't use me for dangerous explosives" line is quoted from the game's ending comic.
