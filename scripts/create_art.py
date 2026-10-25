"""Rebuild the original, deterministic vector landscape. No dependencies."""
from pathlib import Path
import random
import math

random.seed(49)
out = ['''<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="650" viewBox="0 0 1400 650">
<defs>
 <linearGradient id="sky" x2="0" y2="1"><stop stop-color="#253f3b"/><stop offset=".48" stop-color="#6b8170"/><stop offset="1" stop-color="#253d30"/></linearGradient>
 <radialGradient id="glow"><stop stop-color="#d8dab0" stop-opacity=".6"/><stop offset=".4" stop-color="#bed1ac" stop-opacity=".19"/><stop offset="1" stop-color="#8fa78a" stop-opacity="0"/></radialGradient>
 <linearGradient id="water" x2="0" y2="1"><stop stop-color="#759586"/><stop offset="1" stop-color="#344e3c"/></linearGradient>
 <linearGradient id="path" x1=".6" y1="0" x2=".3" y2="1"><stop stop-color="#c2c69a"/><stop offset=".55" stop-color="#8a9a71"/><stop offset="1" stop-color="#6a7650"/></linearGradient>
 <linearGradient id="trunk"><stop stop-color="#132c24"/><stop offset=".7" stop-color="#203a2c"/><stop offset="1" stop-color="#3b5035"/></linearGradient>
 <linearGradient id="portal" x2="0" y2="1"><stop stop-color="#dddaa5"/><stop offset=".4" stop-color="#ecdda0"/><stop offset="1" stop-color="#8d9e69"/></linearGradient>
 <radialGradient id="warm"><stop stop-color="#ffe39b" stop-opacity=".65"/><stop offset=".25" stop-color="#efca7d" stop-opacity=".17"/><stop offset="1" stop-color="#e1c980" stop-opacity="0"/></radialGradient>
 <filter id="blur"><feGaussianBlur stdDeviation="18"/></filter>
 <filter id="soft"><feGaussianBlur stdDeviation="4"/></filter>
 <filter id="texture"><feTurbulence type="fractalNoise" baseFrequency=".65" numOctaves="3" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncA type="linear" slope=".075"/></feComponentTransfer><feBlend in="SourceGraphic" mode="soft-light"/></filter>
 <filter id="foliage"><feTurbulence type="fractalNoise" baseFrequency=".055" numOctaves="3" result="noise"/><feDisplacementMap in="SourceGraphic" in2="noise" scale="14"/></filter>
</defs>
<g filter="url(#texture)"><path fill="url(#sky)" d="M0 0h1400v650H0Z"/>
<ellipse cx="790" cy="185" rx="450" ry="360" fill="url(#glow)"/>
<circle cx="799" cy="113" r="30" fill="#d7dec0" opacity=".55"/><circle cx="799" cy="113" r="48" fill="#d7dec0" opacity=".035"/>
<path d="m695 10 64 0-100 434-126 66ZM837 0h35l81 488-78-69Z" fill="#dbe4bb" opacity=".06"/>
<path d="M0 241 120 199l65 25 108-52 146 69 158-95 106 55 120-40 177 83 130-51 137 41 133-82v498H0Z" fill="#537568" opacity=".45"/>
''']

def pine(x, base, height, color, opacity=1):
    width = height * random.uniform(.15, .25)
    points = [(x, base-height)]
    for i in range(1, 9):
        y = base-height+height*i/10
        extent = width*i/8
        points.extend([(x-extent*.4, y-height*.04), (x-extent, y+height*.055)])
    points.append((x, base))
    for i in range(8, 0, -1):
        y = base-height+height*i/10
        extent = width*i/8
        points.extend([(x+extent, y+height*.055), (x+extent*.4, y-height*.04)])
    d = ' '.join(f'{px:.1f},{py:.1f}' for px, py in points)
    out.append(f'<g fill="{color}" opacity="{opacity}"><path d="M{x-1:.1f} {base}v{-height*.95:.1f}h2V{base}Z"/><polygon points="{d}"/></g>')

for depth, color, base, low, high in [(0, '#58776a', 370, 110, 230), (1, '#416858', 399, 150, 290), (2, '#305345', 447, 175, 325)]:
    for x in range(-30, 1460, 22 + depth*4):
        if depth == 2 and 570 < x < 940:
            continue
        pine(x+random.randint(-12, 12), base+random.randint(-25, 25), random.randint(low, high), color, .65 if depth == 0 else .9)
    out.append(f'<path d="M-60 {base-14}Q350 {base-84} 790 {base-15}T1450 {base-20}" fill="none" stroke="#9eb49b" opacity=".14" stroke-width="26" filter="url(#blur)"/>')

out.append('''<path d="M0 404Q242 330 478 392T879 390Q1190 292 1400 367V650H0Z" fill="#244838"/>
<path d="M0 457Q275 352 515 428T824 416Q1108 326 1400 439V650H0Z" fill="#36523a"/>
<path d="M1015 373Q862 427 918 451T834 513Q677 527 730 575L548 650H1118Q883 574 938 554T1045 458Q940 425 1100 391Z" fill="url(#water)" opacity=".65"/>
<path d="M788 362Q708 388 775 408T678 461Q543 481 569 534T405 650H676Q748 574 662 526T791 465Q910 422 822 398T814 363Z" fill="url(#path)"/>
<path d="M792 368Q733 391 785 409T727 452Q639 474 621 487" fill="none" stroke="#d6d3a1" stroke-width="3" opacity=".3"/>
<path d="M0 521Q250 463 511 527L419 650H0ZM1400 471Q1118 483 955 580L966 650h434Z" fill="#203c2b"/>
<!-- The forgotten sanctuary. -->
<path d="m695 374 6-7h187l9 7Zm14-10 5-7h166l7 7Zm10-10 4-7h147l7 7Z" fill="#859170"/>
<path d="M736 345V264q60-91 120 0v81h-20v-78q-40-55-79 0v78Z" fill="#344c38"/>
<path d="M744 344v-78q50-76 104 0v78h-12v-77q-40-55-79 0v78Z" fill="#728162"/>
<path d="M767 347v-71q30-48 59 0v71Z" fill="#d6d6a0" opacity=".15"/>
<path d="M775 347v-67q22-37 43 0v67Z" fill="url(#portal)"/>
<path d="M725 344v-68h-8v-13h12l2-22h13v103Zm138 0v-98h12l1 20h10v12h-9v66Z" fill="#4b6146"/>
<path d="m746 264 11-2m-9 22h10m-11 19h11m80-39h11m-12 23h11m-11 19h11M771 235l4 9m21-18v11m21-4-4 10" stroke="#223e2c" stroke-width="2" opacity=".8"/>
<path d="M729 346q-8-48 2-85 17-22 34-34m85 116q17-82-7-94" fill="none" stroke="#415c35" stroke-width="6"/>
<ellipse cx="798" cy="307" rx="100" ry="108" fill="url(#warm)"/>
<path d="M540 394q252-23 462 15t421-31" stroke="#d5dab3" stroke-width="11" opacity=".19" fill="none" filter="url(#blur)"/>
''')

for i in range(125):
    x, y = random.randint(0, 1400), random.randint(410, 650)
    if 550 < x < 850 or 750 < x < 1050:
        continue
    width = random.randint(9, 35)
    out.append(f'<ellipse cx="{x}" cy="{y}" rx="{width}" ry="{width*.34}" fill="{random.choice(["#45633e", "#3b5837", "#4c6741", "#263f2b"])}" opacity=".6"/>')

out.append('''<!-- Ancient framing trees. -->
<path d="M71 657Q111 471 104 320T148-36h75q-72 223-54 345T165 650Z" fill="url(#trunk)"/>
<path d="M137 334Q118 200 8 174L-20 140Q103 151 153 222M156 284Q248 192 360 163L424 111Q335 192 194 318M168 178Q279 134 317 38L338-13M160 129Q114 83 47 47L22-19" fill="none" stroke="#1c3629" stroke-width="25"/>
<path d="M124 653Q160 465 143 365T184 31M161 293q81-75 175-98M145 231q-38-43-80-52" stroke="#67704a" stroke-width="3" opacity=".35" fill="none"/>
<path d="M106 513q-57 78-96 92m142-89q22 77 81 124m-110-44q-39 28-78 33" fill="none" stroke="#213c2a" stroke-width="15"/>
<path d="M1241 657Q1277 395 1207 230T1182-29h77q-24 166 16 267t31 417Z" fill="url(#trunk)"/>
<path d="M1244 383q-113-67-157-177l-42-80m184 155q-43-53-161-63l-85-43m252 45q81-54 144-55l50-20m-210-8q-72-69-88-158" fill="none" stroke="#1b3527" stroke-width="25"/>
<path d="M1288 655q-21-232-47-321t-25-248m31 282q-127-88-140-145" stroke="#5c6b46" stroke-width="4" fill="none" opacity=".35"/>
<path d="M1266 518q-21 99-78 123m97-60q55 34 115 35" stroke="#1c3727" stroke-width="19" fill="none"/>
''')

# Irregular masses of foliage keep the forest organic, with a light opening.
for side in ['left', 'right', 'top']:
    for i in range(65 if side != 'top' else 30):
        x = random.randint(-90, 420) if side == 'left' else random.randint(1040, 1480) if side == 'right' else random.randint(250, 1130)
        y = random.randint(-60, 185) if side != 'top' else random.randint(-75, 10)
        rx = random.randint(25, 90)
        color = random.choice(['#172f24', '#1c3828', '#23412d', '#2c4931', '#324d33'])
        out.append(f'<ellipse cx="{x}" cy="{y}" rx="{rx}" ry="{random.randint(17, 39)}" fill="{color}" filter="url(#foliage)"/>')

for i in range(100):
    x = random.choice([random.randint(0, 340), random.randint(1100, 1400)])
    y = random.randint(410, 645)
    height = random.randint(9, 40)
    out.append(f'<path d="M{x} {y}q-10 {-height} -23 {-height}m23 {height}q3 {-height} 15 {-height-9}m-15 {height+9}v{-height-11}" stroke="{random.choice(["#426443", "#527249", "#304c33"])}" stroke-width="1.5" fill="none" opacity=".7"/>')

# A lantern gives the player a warm focal point on the path.
out.append('''<path d="M470 460q12-61 4-115m1 19q20-12 34 2" stroke="#253f2a" stroke-width="5" fill="none"/>
<path d="M505 365v15m-9 0h19l-3 25h-13Zm-2-2h22m-18 30h15" fill="#dac383" stroke="#43533b" stroke-width="2"/>
<path d="M502 382h8v18h-8Z" fill="#f6dfa0"/>
<ellipse cx="506" cy="393" rx="66" ry="76" fill="url(#warm)"/>
<path d="M168 481Q450 436 658 470T1190 450" fill="none" stroke="#bfd0ae" stroke-width="15" opacity=".1" filter="url(#blur)"/>
''')
for i in range(39):
    x, y = random.randint(310, 1140), random.randint(160, 517)
    out.append(f'<circle cx="{x}" cy="{y}" r="{random.uniform(.5, 1.6):.1f}" fill="#e9d6a0" opacity="{random.uniform(.2,.75):.2f}"/>')
out.append('</g></svg>')
target = Path(__file__).resolve().parent.parent / 'assets' / 'forest.svg'
target.write_text('\n'.join(out), encoding='utf-8')
print(f'Illustration créée : {target} ({target.stat().st_size:,} octets)')
