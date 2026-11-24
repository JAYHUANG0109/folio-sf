# Levi's Stadium announcer: recording script

Record each line as its own short clip (phone voice memo is fine) and drop the files in this folder
(`recordings/announcer/`). Name each file after its **clip name**. For several takes of one moment add
`-1`, `-2`, ... (`touchdown-1.m4a`, `touchdown-2.m4a`); the game picks a random take every time.
Any format works: m4a, mp3, wav, aiff.

Then tell Claude "process the announcer recordings" (or run `npm run sf:announcer`): the clips get
trimmed, leveled, and given a stadium PA echo, and the game uses them instead of the robot voice.
Any clip you skip keeps the browser voice as a fallback.

Tips: 20 to 30 cm from the phone, a quiet room, a beat of silence before and after. Go BIG.
Think play-by-play on a national broadcast: rising pitch, stretched words, real excitement.

| Clip name | When it plays | Lines (pick one per take, or make up your own) |
|---|---|---|
| `touchdown` | 49ers score a touchdown (also when *you* push the ball into the end zone) | "TOUCHDOWN 49ERS!!!" / "TOUCH-DOWWWN, SAN FRANCISCO!" / "HE'S IN! TOUCHDOWN NINERS!" |
| `countdown` | Right before a long touchdown run (then `touchdown` plays) | "He's at the 30... the 20... the 10..." / "Nobody's gonna catch him! 40, 30, 20..." |
| `firstdown` | 49ers move the chains | "First down, Forty Niners!" / "And that's a first down!" / "Moves the chains!" |
| `catch` | A big 49ers pass play | "OH, what a CATCH!" / "Leaping grab! Are you kidding me?!" |
| `tackle` | A big 49ers run | "He breaks a tackle! Still going!" / "Spins out of it! Look at him go!" |
| `bighit` | The 49ers defense lays a hit | "BIG hit!" / "OH, he got LIT UP!" |
| `sack` | 49ers sack the Seahawks QB | "SACKED!" / "He's DOWN! What a sack!" |
| `interception` | 49ers intercept a Seahawks pass | "PICKED OFF!" / "INTERCEPTED! Niners ball!" |
| `fumble` | Seahawks fumble, 49ers recover | "FUMBLE! And the Niners have it!" / "It's LOOSE! Recovered, San Francisco!" |
| `fieldgoal` | 49ers field goal is good | "The kick is up... and it's GOOD!" / "Right down the middle! Three points!" |
| `missed` | Seahawks miss a field goal | "NO GOOD! Wide right!" / "Doinked off the upright! NO GOOD!" |
| `thirddown` | Seahawks face third down (the crowd gets loud) | "Third down! Listen to this crowd!" / "Third and long, Levi's is SHAKING!" |
| `stop` | 49ers stop the Seahawks on fourth down | "STOPPED! Turnover on downs!" / "Denied! What a stand by this defense!" |
