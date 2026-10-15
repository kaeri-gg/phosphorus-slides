# White Phosphorus: An Explosive Escape: 3-minute pitch (Estonian Game of the Year)

Slides live in `index.html` (7 slides; styles in `src/styles/pitch.css`, behaviour in `src/pitch.js`). Spoken script is ~390 words plus ~40 s of live gameplay narration, about 2:50 total. Advance with the right arrow key. The on-screen timer is set to 3:00.

| # | Slide | Time | Cumulative |
|---|-------|------|------------|
| 1 | Hook | 0:15 | 0:15 |
| 2 | Chemistry you can play | 0:20 | 0:35 |
| 3 | Real chemistry is the rulebook | 0:30 | 1:05 |
| 4 | **Watch a jump (gameplay)** | 0:45 | 1:50 |
| 5 | Learn by escaping | 0:30 | 2:20 |
| 6 | Why it deserves Game of the Year | 0:25 | 2:45 |
| 7 | Play it now | 0:15 | 3:00 |

---

### 1. Hook (0:15)
"Imagine you are a small rock that bursts into flames the moment it touches air. Your only safe place is water, and you are locked inside a factory. This is **White Phosphorus: An Explosive Escape**."

### 2. Chemistry you can play (0:20)
"We made it in Tallinn, for our Learning Game Development course. Our question: how do you make chemistry fun instead of dry? Our answer: make the element the hero. White phosphorus really does ignite in air, which is why real labs store it under water."

### 3. Real chemistry is the rulebook (0:30)
"Here is the clever part: the rules of the game *are* the chemistry. In water, you are safe. In air, you burn and lose one of your seven health points every 1.8 seconds. Glowing blue phosphoric acid heals you. So players never read about it. They *feel* it, and they plan every jump around it."

### 4. Watch a jump: gameplay (0:45)
*Let the clip loop and talk over it. Don't read the slide.*
"Let me show you. I'm sitting safe in this tank. Now I jump... and I'm in the air, so I'm on fire. Seven health points, ticking down. I have to land in the next tank, and I'm quick, because fireworks, bombs and red pipes all want me dead. And look: this tank is empty! So I find the blue valve, open it, the tank fills, and now I can move on. Four hand-drawn levels of this, and the game teaches all of it in three short screens."

### 5. Learn by escaping (0:30)
"Between levels, short comics tell real facts about phosphorus, so learning is the reward and not a lecture. The ending pays it off. In the vacuum oven, our hero becomes **red phosphorus**, the calm, stable form. In its words: 'They can't use me for dangerous explosives anymore.' The player has understood two forms of an element without opening a textbook."

### 6. Why it deserves Game of the Year (0:25)
"Why us? Three reasons. **One idea, finished**: the mechanic and the science are the same thing. **Learning that sticks**: you remember what burned you. And **open to everyone**: it's free and runs in the browser, so a teacher, a kid or a juror can play it in ten seconds. A small Estonian team, one clear idea, polished to the end."

### 7. Play it now (0:15)
"We are Anna, Ai, Qianying and Kathleen. Scan the QR code and try it right now. And please remember to vote for the rock that's trying not to explode. Stay wet! Thank you!"

---

## Record the gameplay clip (needed for slide 4)
1. Play Level 2 in the browser and screen-record 20-30 s: start in the first tank, jump to the second (burn visible), open a valve, land. Include at least one near miss with a firework.
2. Save it as `public/assets/pitch/gameplay.mp4` (muted is fine, it loops silently, keep it under ~15 MB).
3. In `public/pitch.md`, replace the `<image>` in the `gameplay` step with the `<video>` line from the comment above it.
Until then the slide shows the Level 2 screenshot and the narration still works.

## Delivery tips
- Open the deck and let it fully load **before** you go on stage. Use `npm run build` and `npm run preview` for a reliable load.
- Rehearse slide 4 with the clip: the narration should match what is on screen second by second.
- If you're running late, cut the last two sentences of slide 5 and the "teacher, a kid or a juror" line in slide 6.
- Keep the game open in another tab as a live-demo backup.

## Notes on facts
- 7 HP, 1.8 s burn tick, double jump, blue phosphoric acid healing, 4 levels: taken from the game's code and scenes.
- "Stored under water" and "ignites in air" are standard facts about white phosphorus.
- The "can't use me for dangerous explosives" line is quoted from the game's ending comic.
- I did not state the award's judging criteria, player numbers or any other claim we can't verify. Add real numbers (plays, downloads, playtest feedback) to slide 6 if you have them.
