// 57-action template — species-INDEPENDENT.
// tier / frames / fps / loop MUST stay in lockstep with ../../assets/anim/manifest.json
// (that file is the delivery contract; this file adds the per-frame prompt descriptions).
// Placeholders [animal] [ANIMAL] [bowl] [toy] are substituted from the character bible
// by build-prompt.js. Descriptions describe POSE/EXPRESSION/PROPS only — never the
// character's look (that comes from the bible style prefix).
//
// anchor = which of the 6 pose references this action is generated from (see
// reference-binding.json). Kept here too so the action table is self-contained.

module.exports = {
  // ───────────────────────── TIER 1 · 核心养成循环 (22) ─────────────────────────
  "idle": { tier: 1, frames: 6, fps: 4, loop: true, anchor: "sit", cn: "待机呼吸", desc: [
    "standing/sitting calmly facing camera, neutral happy face, chest at rest (lowest point)",
    "chest slightly rising, breathing in, tail relaxed",
    "chest fully up, breathing in, ears settle",
    "chest at top, blinking softly, content",
    "chest lowering, breathing out",
    "back to rest, tiny tail wag"
  ]},
  "blink": { tier: 1, frames: 4, fps: 6, loop: false, anchor: "sit", cn: "眨眼", desc: [
    "eyes fully open, neutral happy face",
    "eyes half closed",
    "eyes fully closed, soft smile",
    "eyes opening again, bright"
  ]},
  "look-around": { tier: 1, frames: 6, fps: 5, loop: false, anchor: "sit", cn: "张望好奇", desc: [
    "facing camera, curious neutral face",
    "head turning to the left, looking",
    "looking far left, ears perked",
    "head returning to center",
    "head turning to the right, looking",
    "back to center, content"
  ]},
  "walk": { tier: 1, frames: 6, fps: 8, loop: true, anchor: "sprawl", cn: "走", desc: [
    "side profile walking, front-left leg forward, contact pose",
    "weight shifting forward, body slightly lifted",
    "mid-stride, opposite legs passing",
    "side profile, other leg forward, contact pose",
    "weight shifting, body slightly lifted",
    "mid-stride passing pose (loops)"
  ]},
  "run": { tier: 1, frames: 6, fps: 12, loop: true, anchor: "sprawl", cn: "跑", desc: [
    "side profile running, legs gathered under body, airborne",
    "front legs extended forward reaching",
    "front paws contact, body stretched",
    "body compressing, back legs swinging forward",
    "back legs push off, fully extended stretch",
    "gathered airborne pose again (loops)"
  ]},
  "drag": { tier: 1, frames: 4, fps: 6, loop: true, anchor: "curl", cn: "被拎起", desc: [
    "being lifted up, limbs dangling limp, surprised face",
    "swaying slightly left, paws hanging",
    "swaying slightly right, paws hanging",
    "limbs dangling, slightly dizzy face (loops)"
  ]},
  "greet": { tier: 1, frames: 6, fps: 7, loop: false, anchor: "wave", cn: "打招呼挥手", desc: [
    "sitting, looking up happily, one front paw lowered",
    "raising one front paw",
    "paw raised high, waving, big smile, mouth open",
    "paw waving across, eyes bright",
    "paw waving back",
    "paw lowering, cheerful settle"
  ]},
  "happy": { tier: 1, frames: 6, fps: 8, loop: false, anchor: "sprawl", cn: "开心蹦跳", desc: [
    "crouching down, big grin, about to jump",
    "pushing off the ground, paws spreading",
    "airborne, all paws off ground, joyful, ears up",
    "peak of jump, sparkle eyes, mouth open happy",
    "coming down, paws reaching",
    "landed, happy wiggle"
  ]},
  "sad": { tier: 1, frames: 5, fps: 4, loop: false, anchor: "curl", cn: "难过", desc: [
    "sitting, ears starting to droop, slight frown",
    "ears drooping more, looking down",
    "head lowered, sad eyes, ears flat",
    "small sigh, shoulders slumped",
    "looking down, single faint tear forming"
  ]},
  "angry": { tier: 1, frames: 6, fps: 7, loop: false, anchor: "sit", cn: "生气", desc: [
    "frowning, brows down, puffed cheeks",
    "stomping one front paw, angry face",
    "huffing, small anger steam puff above head",
    "turning head away in a huff",
    "arms/paws crossed, pouting",
    "still pouting, one eye peeking back"
  ]},
  "love": { tier: 1, frames: 5, fps: 5, loop: false, anchor: "wave", cn: "被宠爱爱心眼", desc: [
    "looking up, soft adoring eyes",
    "tilting head, blush appearing on cheeks",
    "heart-shaped eyes, big blush, floating heart above",
    "happy closed eyes, multiple little hearts",
    "content sigh, one heart drifting up"
  ]},
  "head-pat": { tier: 1, frames: 5, fps: 6, loop: false, anchor: "sit", cn: "摸头眯眼", desc: [
    "looking up expectantly",
    "head slightly pressing up, eyes beginning to close",
    "eyes squinted happily, head tilted into the pat, blush",
    "blissful squint, tiny content smile",
    "settling, satisfied half-closed eyes"
  ]},
  "lick": { tier: 1, frames: 5, fps: 7, loop: false, anchor: "paw-to-mouth", cn: "舔亲亲", desc: [
    "leaning forward, mouth opening",
    "tongue starting to come out",
    "tongue out fully, licking forward, happy eyes",
    "tongue mid-lick, sparkle",
    "tongue back in, satisfied smile"
  ]},
  "belly-rub": { tier: 1, frames: 6, fps: 7, loop: false, anchor: "sprawl", cn: "挠肚子翻身", desc: [
    "starting to roll onto back, playful",
    "halfway rolled, paws up",
    "fully on back, belly up, all four paws in air, blissful",
    "wiggling happily, tongue out",
    "paws kicking gently, eyes closed happy",
    "rolling back upright, content"
  ]},
  "shake-paw": { tier: 1, frames: 5, fps: 6, loop: false, anchor: "wave", cn: "握手抬爪", desc: [
    "sitting, looking up attentive",
    "lifting one front paw forward",
    "paw extended out for a handshake, proud smile",
    "paw shaking up",
    "paw shaking down, paw lowering"
  ]},
  "chase-tail": { tier: 1, frames: 8, fps: 10, loop: false, anchor: "sprawl", cn: "追尾巴转圈", desc: [
    "noticing own tail, head turning back",
    "starting to spin, body curving",
    "spinning, quarter turn, chasing tail",
    "half turn, motion, tail just ahead",
    "three-quarter turn spinning",
    "full spin, almost catching tail",
    "dizzy wobble, spirals slowing",
    "stopped, slightly dizzy, happy panting"
  ]},
  "eat": { tier: 1, frames: 6, fps: 8, loop: true, anchor: "paw-to-mouth", cn: "吃饭", desc: [
    "sitting in front of [bowl], head up, about to eat",
    "lowering head toward the bowl",
    "head down in the bowl, eating, cheeks puffing",
    "chewing with full cheeks, one bite near mouth",
    "head up mid-chew, happy eyes",
    "licking lips, leaning back down (loops)"
  ]},
  "sleep": { tier: 1, frames: 6, fps: 3, loop: true, anchor: "curl", cn: "睡觉", desc: [
    "curled up, eyes closed, settling down",
    "breathing in slowly, small 'z' appearing",
    "deep breath, 'z' floating up",
    "peaceful sleep, two 'z's drifting",
    "tiny snore, nose twitch",
    "breathing out, settling deeper (loops)"
  ]},
  "bath": { tier: 1, frames: 6, fps: 6, loop: true, anchor: "lying-focus", cn: "洗澡泡泡", desc: [
    "sitting in a small tub, fur slightly wet, soap bubbles forming",
    "bubbles rising around, happy face",
    "scrubbing, foam on head, bubbles floating up",
    "more bubbles, eyes closed enjoying",
    "splashing playfully, bubbles everywhere",
    "covered in soft foam, content (loops)"
  ]},
  "hungry": { tier: 1, frames: 5, fps: 4, loop: false, anchor: "sit", cn: "饿了盯肚子", desc: [
    "sitting, looking down at own tummy",
    "tummy rumble, small worried face",
    "paw on belly, pleading hungry eyes",
    "looking up begging, mouth slightly open",
    "drooping, hungry sigh"
  ]},
  "dirty": { tier: 1, frames: 6, fps: 7, loop: true, anchor: "sit", cn: "脏了挠痒", desc: [
    "fur messy with small dirt smudges, uncomfortable face",
    "lifting back leg to scratch",
    "scratching neck vigorously, eyes squinted",
    "scratching, small dust puff",
    "pausing, still itchy, grumpy",
    "scratching again (loops)"
  ]},
  "sick": { tier: 1, frames: 5, fps: 3, loop: true, anchor: "curl", cn: "生病虚弱", desc: [
    "lying down weakly, ice pack or cold towel on head, pale face",
    "weak breathing, droopy eyes",
    "small cough, thermometer hint, sad",
    "shivering slightly, weak",
    "weak sigh, eyes half closed (loops)"
  ]},

  // ───────────────────────── TIER 2 · 经济/养护扩展 (20) ─────────────────────────
  "work-construction": { tier: 2, frames: 6, fps: 7, loop: true, anchor: "lying-focus", cn: "搬砖泥瓦匠", desc: [
    "wearing a tiny yellow hard hat, holding a small brick, determined",
    "lifting the brick up",
    "carrying the brick, one step",
    "placing/stacking the brick down",
    "wiping brow with paw, proud",
    "picking up the next brick (loops)"
  ]},
  "work-cook": { tier: 2, frames: 6, fps: 7, loop: true, anchor: "lying-focus", cn: "厨师颠勺", desc: [
    "wearing a white chef hat, holding a small frying pan, focused",
    "tossing food up in the pan, flame burst",
    "food airborne, watching it",
    "catching the food back in the pan",
    "tasting with a tiny spoon, delighted",
    "flipping again (loops)"
  ]},
  "work-guard": { tier: 2, frames: 5, fps: 5, loop: true, anchor: "wave", cn: "保安警察站岗", desc: [
    "wearing a small security/police cap, standing at attention, serious",
    "saluting with one paw, alert",
    "holding salute, scanning",
    "lowering paw, hands behind back, watchful",
    "small nod, on duty (loops)"
  ]},
  "work-art": { tier: 2, frames: 6, fps: 6, loop: true, anchor: "lying-focus", cn: "画画漫画家", desc: [
    "sitting at a tiny desk with paper, holding a pen, thinking",
    "starting to draw, focused tongue-out concentration",
    "drawing a line, eyes following",
    "pausing, looking at the work, considering",
    "adding detail, happy",
    "holding up the finished tiny drawing, proud (loops)"
  ]},
  "study": { tier: 2, frames: 6, fps: 4, loop: true, anchor: "lying-focus", cn: "学习看书", desc: [
    "sitting with an open book, reading, focused",
    "eyes scanning the page",
    "turning a page with paw",
    "nodding in understanding, small lightbulb",
    "taking a tiny note",
    "back to reading (loops)"
  ]},
  "work-done": { tier: 2, frames: 6, fps: 7, loop: false, anchor: "wave", cn: "下班数钱", desc: [
    "holding a small stack of coins, satisfied",
    "counting the coins, happy",
    "coins sparkle, big grin",
    "tossing a coin up playfully",
    "catching the coin",
    "hugging the coins, content"
  ]},
  "play-ball": { tier: 2, frames: 6, fps: 9, loop: false, anchor: "sprawl", cn: "玩球扑球", desc: [
    "crouching, eyeing a small ball, ready to pounce",
    "pouncing forward toward the ball",
    "airborne over the ball, excited",
    "paws on the ball, caught it",
    "rolling with the ball, playful",
    "sitting up holding the ball, proud"
  ]},
  "play-frisbee": { tier: 2, frames: 6, fps: 10, loop: false, anchor: "sprawl", cn: "接飞盘", desc: [
    "watching an incoming frisbee, eyes up",
    "running/leaping toward it",
    "airborne, stretching up, mouth open",
    "catching the frisbee mid-air, triumphant",
    "landing with frisbee held",
    "trotting back proud with frisbee"
  ]},
  "jump-rope": { tier: 2, frames: 6, fps: 10, loop: true, anchor: "sprawl", cn: "跳绳", desc: [
    "holding a small jump rope, rope behind, ready",
    "swinging the rope overhead",
    "rope coming down in front, beginning to jump",
    "airborne, rope passing under feet",
    "landing, rope going back up",
    "rope overhead again (loops)"
  ]},
  "coin-get": { tier: 2, frames: 5, fps: 7, loop: false, anchor: "wave", cn: "获得金币", desc: [
    "noticing a shiny coin appearing, eyes widening",
    "reaching up for the coin",
    "grabbing the coin, sparkle, big happy eyes",
    "holding coin up triumphantly",
    "hugging the coin, delighted"
  ]},
  "levelup": { tier: 2, frames: 6, fps: 8, loop: false, anchor: "wave", cn: "升级闪光", desc: [
    "standing, looking up as light begins",
    "glow rising from below, surprised happy",
    "burst of sparkles all around, arms/paws up",
    "peak glow, radiant, eyes shining",
    "sparkles settling, confident pose",
    "proud finished pose, small stars around"
  ]},
  "shopping": { tier: 2, frames: 6, fps: 6, loop: false, anchor: "wave", cn: "逛街拎袋", desc: [
    "walking happily holding a small shopping bag",
    "mid-step, bag swinging",
    "looking at the bag contents, delighted",
    "adding another small bag to the other paw",
    "walking with two bags, cheerful",
    "stopping, satisfied with the haul"
  ]},
  "drink": { tier: 2, frames: 5, fps: 6, loop: false, anchor: "paw-to-mouth", cn: "喝水", desc: [
    "sitting near a small water bowl/cup, thirsty",
    "lowering head to drink",
    "drinking, tongue lapping, eyes content",
    "head up, small water drop on chin, refreshed",
    "licking lips, satisfied"
  ]},
  "brush": { tier: 2, frames: 5, fps: 5, loop: false, anchor: "sit", cn: "被梳毛", desc: [
    "sitting, a small brush approaching the fur",
    "being brushed along the back, eyes softening",
    "blissful squint, fur looking fluffier, sparkle",
    "leaning into the brush, content",
    "fur neat and shiny, happy proud"
  ]},
  "wake": { tier: 2, frames: 6, fps: 5, loop: false, anchor: "curl", cn: "起床伸懒腰", desc: [
    "lying curled, eyes just opening, groggy",
    "lifting head, sleepy yawn beginning",
    "front legs stretching forward, big stretch, back arched",
    "full stretch, paws extended, mouth in yawn",
    "relaxing from stretch, blinking awake",
    "sitting up, awake and ready"
  ]},
  "bath-shake": { tier: 2, frames: 6, fps: 10, loop: false, anchor: "lying-focus", cn: "洗完甩水", desc: [
    "wet fur flat, standing, about to shake",
    "starting to shake, head turning, droplets",
    "shaking hard left, water flying off, fur ruffled",
    "shaking hard right, more droplets, blurred motion",
    "shake slowing, fur fluffing up",
    "fur fully fluffy and dry, happy"
  ]},
  "eat-full": { tier: 2, frames: 5, fps: 5, loop: false, anchor: "paw-to-mouth", cn: "吃饱拍肚", desc: [
    "sitting with a slightly round full belly, satisfied",
    "patting own belly with a paw",
    "happy belly pat, content closed eyes",
    "small satisfied burp, blush",
    "leaning back, fully content"
  ]},
  "dizzy": { tier: 2, frames: 5, fps: 5, loop: true, anchor: "sit", cn: "头晕转圈眼", desc: [
    "swaying, spiral eyes starting",
    "wobbling left, stars circling head",
    "spiral eyes, stars orbiting, dazed",
    "wobbling right, more stars",
    "swaying, dizzy (loops)"
  ]},
  "yawn": { tier: 2, frames: 5, fps: 4, loop: false, anchor: "paw-to-mouth", cn: "打哈欠", desc: [
    "sleepy face, mouth beginning to open",
    "mouth opening wider, eyes squinting",
    "big wide yawn, eyes closed, tongue curling",
    "yawn finishing, mouth closing",
    "blinking, drowsy content"
  ]},
  "excited": { tier: 2, frames: 6, fps: 9, loop: false, anchor: "sprawl", cn: "兴奋转圈", desc: [
    "perking up, eyes sparkling, can't contain it",
    "bouncing in place, paws up",
    "spinning with joy, quarter turn",
    "spinning, half turn, motion lines",
    "spinning, three-quarter, big grin",
    "stopping, thrilled, stars around"
  ]},

  // ───────────────────────── TIER 3 · 情感/彩蛋 (15) ─────────────────────────
  "goodbye": { tier: 3, frames: 6, fps: 5, loop: false, anchor: "curl", cn: "依依不舍告别", desc: [
    "looking up, slightly sad smile, raising a paw",
    "waving the paw goodbye",
    "wave with watery eyes, reluctant",
    "paw to chest, missing-you gesture",
    "small wave again, single tear",
    "lowering paw, brave sad smile"
  ]},
  "cry": { tier: 3, frames: 6, fps: 5, loop: true, anchor: "curl", cn: "大哭", desc: [
    "face scrunching, eyes welling up",
    "first big tears forming",
    "wailing, mouth open, twin tear streams",
    "rubbing eyes with paws, sobbing",
    "tears flowing, trembling lip",
    "still crying, hiccup (loops)"
  ]},
  "surprised": { tier: 3, frames: 5, fps: 8, loop: false, anchor: "sit", cn: "惊讶跳起", desc: [
    "neutral, then eyes snapping wide",
    "jolting, jumping up startled, fur on end",
    "airborne shock, exclamation mark above head, mouth open",
    "coming down, hands/paws up in surprise",
    "landed, blinking, recovering"
  ]},
  "shy": { tier: 3, frames: 5, fps: 5, loop: false, anchor: "sit", cn: "害羞捂脸", desc: [
    "looking away, faint blush starting",
    "blush growing, small bashful smile",
    "raising paws toward face, deep blush",
    "covering face with paws, peeking through",
    "peeking shyly between paws, very red"
  ]},
  "bored": { tier: 3, frames: 6, fps: 3, loop: true, anchor: "sit", cn: "无聊发呆", desc: [
    "sitting slumped, half-lidded eyes",
    "resting chin on paw, staring blankly",
    "slow blink, deeper slump",
    "sighing, small puff of breath",
    "looking sideways listlessly",
    "back to blank stare (loops)"
  ]},
  "think": { tier: 3, frames: 5, fps: 4, loop: false, anchor: "sit", cn: "思考歪头", desc: [
    "head tilting, curious thinking face",
    "paw to chin, pondering, question mark forming",
    "looking up thinking, question mark above head",
    "small lightbulb appearing, eyes brightening",
    "got it! happy realization, paw up"
  ]},
  "peek": { tier: 3, frames: 5, fps: 5, loop: false, anchor: "sit", cn: "边缘探头", desc: [
    "half hidden behind an edge, only top of head showing",
    "peeking one eye out, curious",
    "both eyes peeking out from the side",
    "leaning out a bit more, shy curious smile",
    "almost fully out, friendly wave"
  ]},
  "travel": { tier: 3, frames: 6, fps: 6, loop: false, anchor: "wave", cn: "旅游出发", desc: [
    "wearing a tiny sun hat, holding a small suitcase, excited",
    "waving goodbye with suitcase in paw",
    "taking a step forward, ready to go",
    "walking with suitcase, cheerful, small plane/cloud above",
    "looking back with a happy wave",
    "marching forward, adventure ahead"
  ]},
  "celebrate": { tier: 3, frames: 6, fps: 8, loop: false, anchor: "wave", cn: "庆祝撒花", desc: [
    "holding a tiny party popper, excited buildup",
    "popper bursting, confetti shooting out",
    "confetti everywhere, arms/paws thrown up, joy",
    "jumping with confetti raining down",
    "catching confetti, laughing",
    "triumphant pose, confetti settling, party hat"
  ]},
  "recover": { tier: 3, frames: 5, fps: 5, loop: false, anchor: "curl", cn: "病愈", desc: [
    "lying down, removing the ice pack, color returning",
    "sitting up slowly, feeling better",
    "stretching, energy returning, small sparkle",
    "standing up, healthy glow, relieved smile",
    "energetic again, happy fist/paw pump"
  ]},
  "scared": { tier: 3, frames: 5, fps: 6, loop: true, anchor: "curl", cn: "害怕发抖", desc: [
    "shrinking back, wide fearful eyes",
    "trembling, fur standing up, ears back",
    "shaking hard, sweat drop, cowering",
    "covering head with paws, shivering",
    "peeking out scared, still trembling (loops)"
  ]},
  "wink": { tier: 3, frames: 5, fps: 6, loop: false, anchor: "wave", cn: "卖萌比心", desc: [
    "looking at camera, cheerful",
    "one eye starting to close, playful",
    "full wink, tongue out cutely, sparkle",
    "raising paws to make a tiny heart shape",
    "finger-heart/paw-heart gesture, big smile, hearts"
  ]},
  "dance": { tier: 3, frames: 8, fps: 9, loop: true, anchor: "sprawl", cn: "跳舞", desc: [
    "striking a start pose, one paw up, grin",
    "stepping left, hips swaying, music notes",
    "arms/paws out to the left, groove",
    "stepping center, spin start",
    "mid-spin, joyful, notes around",
    "stepping right, hips sway other way",
    "arms/paws out to the right, groove",
    "back to start pose, music notes (loops)"
  ]},
  "beg": { tier: 3, frames: 5, fps: 5, loop: true, anchor: "wave", cn: "坐立讨食", desc: [
    "sitting up on hind legs, front paws together pleading",
    "wiggling paws, big pleading eyes",
    "tilting head, irresistible puppy/kitten eyes, sparkle",
    "paws clasped, hopeful, tail wagging",
    "still begging sweetly (loops)"
  ]},
  "sneeze": { tier: 3, frames: 5, fps: 7, loop: false, anchor: "sit", cn: "打喷嚏", desc: [
    "nose twitching, eyes starting to scrunch",
    "head tilting back, building up, 'ah'",
    "big sneeze, head snapping forward, tiny burst, 'choo'",
    "recovering, sniffling, dazed",
    "rubbing nose with paw, small sniff, okay again"
  ]}
};
