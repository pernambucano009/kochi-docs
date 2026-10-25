"""رسومات منتجات بسيطة (SVG) لأغلفة المجالات: من غير صور حقيقية ولا علامات تجارية."""
G = lambda i, a, b: f'<linearGradient id="{i}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{a}"/><stop offset="1" stop-color="{b}"/></linearGradient>'
GH = lambda i, a, b: f'<linearGradient id="{i}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="{a}"/><stop offset="1" stop-color="{b}"/></linearGradient>'
R = lambda i, a, b: f'<radialGradient id="{i}" cx=".4" cy=".35" r=".75"><stop offset="0" stop-color="{a}"/><stop offset="1" stop-color="{b}"/></radialGradient>'

ART = {
# 🍛 طبق مندي: صحن، رز، دجاج، ومكسرات
"mandi": (400, 500, f'''<defs>{R("pl","#FFFFFF","#E4E1DA")}{R("rc","#F7D58A","#E2A947")}{R("ck","#C96A2B","#8A3A12")}</defs>
<ellipse cx="200" cy="330" rx="190" ry="92" fill="url(#pl)"/><ellipse cx="200" cy="322" rx="160" ry="72" fill="#F3F0EA"/>
<path d="M60 318 C80 220 320 220 340 318 C300 360 100 360 60 318Z" fill="url(#rc)"/>
{"".join(f'<ellipse cx="{x}" cy="{y}" rx="7" ry="3.2" fill="#FFF3D0" transform="rotate({r} {x} {y})"/>' for x,y,r in [(110,300,20),(140,286,-30),(170,300,10),(230,296,40),(260,284,-10),(290,304,25),(120,320,-20),(300,322,15),(200,330,-35),(160,326,30),(250,326,-25),(210,282,5)])}
<path d="M140 250 C150 190 250 180 268 240 C280 280 220 300 180 292 C150 286 136 272 140 250Z" fill="url(#ck)"/>
<path d="M235 238 C270 210 310 230 300 262 C292 286 256 284 240 270Z" fill="url(#ck)"/>
<path d="M160 236 C180 214 214 210 236 226" stroke="#E7A06A" stroke-width="7" fill="none" stroke-linecap="round" opacity=".7"/>
{"".join(f'<circle cx="{x}" cy="{y}" r="5" fill="#F1E3B5"/>' for x,y in [(130,290),(286,298),(196,306),(240,304),(150,310)])}
{"".join(f'<circle cx="{x}" cy="{y}" r="4" fill="#3F7D3A"/>' for x,y in [(176,284),(268,290),(214,300)])}'''),
# 🎧 سماعات
"headphones": (400, 500, f'''<defs>{G("hb","#2B2D33","#111214")}{R("cup","#3B3E46","#15161A")}</defs>
<path d="M90 300 C70 120 330 120 310 300" stroke="url(#hb)" stroke-width="26" fill="none" stroke-linecap="round"/>
<rect x="56" y="262" width="88" height="150" rx="40" fill="url(#cup)"/><rect x="256" y="262" width="88" height="150" rx="40" fill="url(#cup)"/>
<rect x="128" y="282" width="24" height="110" rx="12" fill="#E5613E"/><rect x="248" y="282" width="24" height="110" rx="12" fill="#E5613E"/>
<path d="M80 290 C78 270 92 266 100 268" stroke="#fff" stroke-width="6" opacity=".25" fill="none" stroke-linecap="round"/>'''),
# 👟 حذاء رياضي
"sneaker": (400, 400, f'''<defs>{G("sh","#FFFFFF","#E6E6EA")}{GH("st","#E5613E","#F48A62")}</defs>
<path d="M40 250 C40 200 70 170 110 165 L170 150 C200 190 250 205 300 210 C350 216 370 240 368 270 L368 290 L40 290Z" fill="url(#sh)" stroke="#D5D5DB" stroke-width="3"/>
<path d="M40 280 L368 280 L368 306 C368 316 360 320 350 320 L56 320 C46 320 40 314 40 304Z" fill="#2B2D33"/>
<path d="M120 230 C170 250 230 262 300 262" stroke="url(#st)" stroke-width="18" fill="none" stroke-linecap="round"/>
{"".join(f'<line x1="{x}" y1="{y}" x2="{x+22}" y2="{y-10}" stroke="#2B2D33" stroke-width="5" stroke-linecap="round"/>' for x,y in [(150,180),(170,192),(190,203)])}'''),
# ⌚ ساعة ذكية
"watch": (400, 400, f'''<defs>{G("bd","#4A5B8C","#2E3A5E")}{R("sc","#1F2433","#06070A")}</defs>
<rect x="150" y="30" width="100" height="120" rx="30" fill="url(#bd)"/><rect x="150" y="250" width="100" height="120" rx="30" fill="url(#bd)"/>
<rect x="110" y="110" width="180" height="180" rx="50" fill="#C9CCD6"/><rect x="122" y="122" width="156" height="156" rx="40" fill="url(#sc)"/>
<rect x="290" y="170" width="14" height="40" rx="6" fill="#A9ADB8"/>
<circle cx="200" cy="200" r="52" fill="none" stroke="#E5613E" stroke-width="10" stroke-dasharray="230 400" stroke-linecap="round" transform="rotate(-90 200 200)"/>
<circle cx="200" cy="200" r="34" fill="none" stroke="#4FD1A5" stroke-width="10" stroke-dasharray="150 400" stroke-linecap="round" transform="rotate(-90 200 200)"/>'''),
# 👜 شنطة يد
"bag": (400, 400, f'''<defs>{G("bg","#D88A5A","#A85A30")}</defs>
<path d="M140 160 C140 90 260 90 260 160" stroke="#7A3E1E" stroke-width="16" fill="none" stroke-linecap="round"/>
<path d="M90 160 L310 160 L340 340 C342 356 330 368 314 368 L86 368 C70 368 58 356 60 340Z" fill="url(#bg)"/>
<rect x="90" y="160" width="220" height="30" fill="#000" opacity=".1"/><rect x="180" y="200" width="40" height="30" rx="6" fill="#F3D9A8"/>'''),
# 🏢 عمارة سكنية
"building": (400, 500, f'''<defs>{G("bl","#F2E6D6","#D9C6AE")}{G("gl","#9CC9E6","#5C9CC8")}</defs>
<rect x="80" y="60" width="240" height="400" rx="10" fill="url(#bl)"/><rect x="70" y="50" width="260" height="22" rx="6" fill="#B9A386"/>
{"".join(f'<rect x="{x}" y="{y}" width="46" height="52" rx="6" fill="url(#gl)"/>' for y in (96,170,244,318) for x in (106,177,248))}
<rect x="168" y="392" width="64" height="68" rx="8" fill="#6B4B2E"/><rect x="40" y="458" width="320" height="10" rx="5" fill="#9E9E9E"/>
<circle cx="52" cy="420" r="30" fill="#5E9E5A"/><circle cx="352" cy="424" r="26" fill="#5E9E5A"/>'''),
# ❄️ مكيف سبليت
"ac": (400, 500, f'''<defs>{G("ac","#FFFFFF","#E3E6EC")}</defs>
<rect x="40" y="170" width="320" height="130" rx="34" fill="url(#ac)" stroke="#D3D7DF" stroke-width="3"/>
<rect x="66" y="262" width="268" height="12" rx="6" fill="#C5CAD3"/><circle cx="318" cy="205" r="7" fill="#4FD1A5"/>
{"".join(f'<path d="M{x} 320 C{x-10} 350 {x+10} 370 {x} 400" stroke="#8EC9EE" stroke-width="8" fill="none" stroke-linecap="round" opacity=".8"/>' for x in (130,200,270))}'''),
# 🛍️ كيس بقالة
"grocery": (400, 500, f'''<defs>{G("kb","#E9D3A8","#C9A970")}</defs>
<circle cx="150" cy="180" r="46" fill="#E5613E"/><path d="M214 110 C250 140 260 190 236 214 C204 196 196 150 214 110Z" fill="#4E9A4A"/>
<rect x="250" y="120" width="40" height="110" rx="14" fill="#F2C14E"/><circle cx="196" cy="196" r="34" fill="#8BC34A"/>
<path d="M80 210 L320 210 L300 440 C298 452 290 460 278 460 L122 460 C110 460 102 452 100 440Z" fill="url(#kb)"/>
<path d="M80 210 L320 210 L316 240 L84 240Z" fill="#000" opacity=".08"/>'''),
# ☕ كيس قهوة
"coffee": (400, 400, f'''<defs>{G("cf","#6B4A35","#3E2A1D")}</defs>
<path d="M110 60 L290 60 L310 350 C310 362 302 370 290 370 L110 370 C98 370 90 362 90 350Z" fill="url(#cf)"/>
<rect x="110" y="40" width="180" height="30" rx="6" fill="#2B1C13"/><rect x="130" y="170" width="140" height="110" rx="14" fill="#F3E3C8"/>
<path d="M175 195 C160 230 190 250 175 270 M200 195 C185 230 215 250 200 270 M225 195 C210 230 240 250 225 270" stroke="#6B4A35" stroke-width="6" fill="none" stroke-linecap="round"/>'''),
# 🧃 زجاجة عصير
"juice": (400, 400, f'''<defs>{G("jc","#FFB347","#F27B21")}</defs>
<rect x="170" y="30" width="60" height="40" rx="8" fill="#2E7D32"/><path d="M160 70 L240 70 L240 110 C280 130 290 160 290 200 L290 350 C290 362 280 372 268 372 L132 372 C120 372 110 362 110 350 L110 200 C110 160 120 130 160 110Z" fill="url(#jc)"/>
<rect x="120" y="210" width="160" height="90" rx="10" fill="#FFF6E5"/><circle cx="200" cy="255" r="28" fill="#F59E0B"/><path d="M200 227 L200 283 M172 255 L228 255" stroke="#FFF6E5" stroke-width="4"/>
<path d="M130 140 C130 130 140 124 150 124" stroke="#fff" stroke-width="8" opacity=".35" fill="none" stroke-linecap="round"/>'''),
# 🍯 برطمان عسل
"honey": (400, 400, f'''<defs>{G("hn","#F7B733","#D98A0B")}</defs>
<rect x="120" y="60" width="160" height="50" rx="12" fill="#8B5A2B"/><path d="M110 110 L290 110 C310 140 316 180 316 230 C316 320 280 370 200 370 C120 370 84 320 84 230 C84 180 90 140 110 110Z" fill="url(#hn)"/>
<rect x="120" y="190" width="160" height="80" rx="10" fill="#FFF3D6"/><path d="M180 230 L200 214 L220 230 L220 252 L200 266 L180 252Z" fill="#D98A0B"/>
<path d="M110 150 C104 180 104 210 110 240" stroke="#fff" stroke-width="10" opacity=".3" fill="none" stroke-linecap="round"/>'''),
# 💧 سيروم بقطارة
"serum": (400, 500, f'''<defs>{G("sr","#F6D3C9","#E9A89A")}</defs>
<rect x="175" y="40" width="50" height="70" rx="22" fill="#2B2D33"/><rect x="165" y="105" width="70" height="40" rx="8" fill="#C9A26B"/>
<path d="M135 145 L265 145 L265 420 C265 440 250 455 230 455 L170 455 C150 455 135 440 135 420Z" fill="url(#sr)"/>
<rect x="150" y="240" width="100" height="120" rx="10" fill="#FFFFFF" opacity=".9"/><circle cx="200" cy="300" r="22" fill="#E9A89A"/>
<path d="M150 170 L150 400" stroke="#fff" stroke-width="10" opacity=".35" stroke-linecap="round"/>'''),
# 🫙 كريم
"cream": (400, 500, f'''<defs>{G("cr","#FFFFFF","#E8E4F0")}{G("cl","#B79CD9","#8D6CBF")}</defs>
<rect x="80" y="170" width="240" height="70" rx="20" fill="url(#cl)"/>
<path d="M90 236 L310 236 L300 400 C298 416 286 428 270 428 L130 428 C114 428 102 416 100 400Z" fill="url(#cr)" stroke="#DDD6EA" stroke-width="3"/>
<rect x="130" y="290" width="140" height="70" rx="10" fill="#8D6CBF" opacity=".15"/><path d="M180 325 C190 305 210 305 220 325 C210 345 190 345 180 325Z" fill="#8D6CBF"/>'''),
# 🦷 سن لامع
"tooth": (400, 500, f'''<defs>{R("th","#FFFFFF","#DCE6EE")}</defs>
<path d="M120 150 C80 160 76 230 100 290 C116 330 120 400 150 420 C175 436 180 360 200 340 C220 360 225 436 250 420 C280 400 284 330 300 290 C324 230 320 160 280 150 C250 142 230 168 200 168 C170 168 150 142 120 150Z" fill="url(#th)" stroke="#C9D6E1" stroke-width="4"/>
<path d="M300 110 L308 132 L330 140 L308 148 L300 170 L292 148 L270 140 L292 132Z" fill="#4FC3F7"/><path d="M90 110 L95 124 L109 129 L95 134 L90 148 L85 134 L71 129 L85 124Z" fill="#4FC3F7"/>
<path d="M130 190 C122 210 122 230 128 250" stroke="#fff" stroke-width="10" opacity=".8" fill="none" stroke-linecap="round"/>'''),
}
