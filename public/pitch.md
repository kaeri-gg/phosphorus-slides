<!-- 3-minute pitch: White Phosphorus: An Explosive Escape. The Three.js deck is kept in conference.md (open with ?file=conference.md). -->

<setting name="resolution" width="1500" height="1024"></setting>
<setting name="transition" value="0.9s"></setting>
<setting name="node-animation" value="0.55s"></setting>
<setting name="node-stagger" value="70ms"></setting>
<setting name="edge-animation" value="1.00s"></setting>
<setting name="edge-delay" value="0.38s"></setting>
<setting name="pulse-speed" value="2200ms"></setting>
<setting name="timer" value="3m"></setting>

<step id="hook" layout="center">
<title>White Phosphorus</title>
<subtitle>An Explosive Escape: you are a rock that bursts into flames when it touches air. Stay wet.</subtitle>
</step>

<step id="why" layout="video-expanded">
<title>Chemistry you can play</title>
<subtitle>Made in Tallinn · Tallinn University · Learning Game Development</subtitle>

<image src="assets/pitch/comic-water.png" name="Phosphorus ignites in air" window="false" fit="contain"></image>
</step>

<step id="mechanic" layout="nodes">
<title>Real chemistry is the rulebook</title>
<subtitle>Every mechanic comes from a real property of white phosphorus</subtitle>

<node id="n-water" name="Water" description="Stable and safe" icon="fa-droplet" x="50" y="22" color="#38bdf8" highlight="true"></node>
<node id="n-air" name="Air" description="Ignites: -1 HP every 1.8 s" icon="fa-fire" x="22" y="74" color="#f97316"></node>
<node id="n-acid" name="Phosphoric acid" description="Glowing blue: heals you" icon="fa-flask" x="78" y="74" color="#34d399"></node>

<edge from="n-water" to="n-air" from-port="bottom" to-port="top" label="Leave water"></edge>
<edge from="n-acid" to="n-water" from-port="top" to-port="bottom" label="Recover"></edge>
</step>

<!-- GAMEPLAY: ~45 s of live narration over a looping clip.
     1. Record 20-30 s of Level 2 (tank -> jump -> burn -> next tank -> valve) and save it as public/assets/pitch/gameplay.mp4
     2. Replace the <image> below with:
        <video src="assets/pitch/gameplay.mp4" name="Level 2, live" window="true" fit="contain"></video> -->
<step id="gameplay" layout="video-expanded">
<title>Watch a jump</title>
<subtitle>Safe in the tank · leap into the air · burning, 7 HP ticking down · land in the next tank · open the valve</subtitle>

<image src="assets/pitch/level.png" name="Level 2: fireworks, bombs, red pipes, valves" window="true"></image>
</step>

<step id="learning" layout="video-expanded">
<title>Learn by escaping</title>
<subtitle>Four levels, with real phosphorus facts told as comics in between. The finale: you become safe red phosphorus.</subtitle>

<image src="assets/pitch/comic-oven.png" name="Red phosphorus, in the vacuum oven" window="true" fit="contain"></image>
</step>

<step id="award" layout="nodes">
<title>Why it deserves Game of the Year</title>
<subtitle>A small Estonian-made game with one clear idea, finished</subtitle>

<node id="n-idea" name="One idea" description="The rulebook is the chemistry" icon="fa-lightbulb" x="50" y="22" color="#facc15" highlight="true"></node>
<node id="n-learn" name="Learning that sticks" description="Felt in play, not read" icon="fa-graduation-cap" x="22" y="74" color="#38bdf8"></node>
<node id="n-open" name="Open to everyone" description="Free, in the browser, no install" icon="fa-globe" x="78" y="74" color="#34d399"></node>

<edge from="n-idea" to="n-learn" from-port="bottom" to-port="top" label="Teaches"></edge>
<edge from="n-idea" to="n-open" from-port="bottom" to-port="top" label="Reaches"></edge>
</step>

<step id="play" layout="video-expanded">
<title>Play it now, in your browser</title>
<subtitle>Anna Arsenina · Ai Dinh · Liu Qianying · Kathleen Povadora. Built in Godot 4.6.</subtitle>

<qrcode src="assets/pitch/qr-itch.png" title="Play on itch.io" url="https://kaeri-gg.itch.io/white-phosphorus-an-explosive-escape" desc="Free, no install. Godot 4.6, web build."></qrcode>

<image src="assets/pitch/burning.png" name="Stay wet!" window="false" fit="contain"></image>
</step>
