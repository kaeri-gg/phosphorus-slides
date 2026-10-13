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
<subtitle>An Explosive Escape: a platformer where the air is trying to kill you</subtitle>
</step>

<step id="why" layout="video-expanded">
<title>Chemistry you can play</title>
<subtitle>Tallinn University · Learning Game Development</subtitle>

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

<step id="gameplay" layout="video-expanded">
<title>Escape the factory</title>
<subtitle>Hop between water tanks · dodge fireworks, bombs and red pipes · open valves to fill the tanks</subtitle>

<image src="assets/pitch/level.png" name="Level 2" window="true"></image>
</step>

<step id="learning" layout="video-expanded">
<title>Learn by escaping</title>
<subtitle>Four levels, with real phosphorus facts told as comics in between. The finale: you become safe red phosphorus.</subtitle>

<image src="assets/pitch/comic-oven.png" name="Red phosphorus, in the vacuum oven" window="true" fit="contain"></image>
</step>

<step id="team" layout="center">
<title>Four students, one web game</title>
<subtitle>Anna Arsenina · Ai Dinh · Liu Qianying · Kathleen Povadora. Art, levels, code, sound and story, built in Godot 4.6.</subtitle>
</step>

<step id="play" layout="video-expanded">
<title>Play it in your browser</title>

<qrcode src="assets/pitch/qr-itch.png" title="Play on itch.io" url="https://kaeri-gg.itch.io/white-phosphorus-an-explosive-escape" desc="Free, no install. Godot 4.6, web build."></qrcode>

<image src="assets/pitch/burning.png" name="Stay wet!" window="false" fit="contain"></image>
</step>
