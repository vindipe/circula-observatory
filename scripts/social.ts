import { writeFile } from 'node:fs/promises'
import { Resvg } from '@resvg/resvg-js'
import { illustration, mark } from '../src/ui/art'

const art = illustration('accumulate').replace('<svg ', '<svg x="630" y="74" width="530" height="465" ')
const brand = mark.replace('<svg ', '<svg x="77" y="140" width="51" height="51" color="#bef493" ')
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <radialGradient id="backdrop"><stop stop-color="#244237"/><stop offset="1" stop-color="#0b1013"/></radialGradient>
    <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0H0v40" fill="none" stroke="#2d4940" stroke-opacity=".35"/></pattern>
  </defs>
  <style>
    .orbit{stroke:#56746a;stroke-opacity:.55;stroke-dasharray:2 7;fill:none}
    .platform{fill:#142822;stroke:#5c8771}
    .platform-edge{fill:#0d1c18;stroke:#29403c}
    .lattice{fill:none;stroke:#477264;stroke-opacity:.6}
    .cube{stroke:#708f8a;stroke-width:1}
    .face-top{fill:#405d5f}.face-left{fill:#253a43}.face-right{fill:#1b2c33}
    .quiet .face-top{fill:#273c3f}.quiet .face-left{fill:#152c32}.quiet .face-right{fill:#17232a}
    .green .face-top{fill:#8cce84}.green .face-left{fill:#3f886e}.green .face-right{fill:#25564c}
    .bright .face-top{fill:#d9ffad}.bright .face-left{fill:#7db976}.bright .face-right{fill:#376758}
    .traces{stroke:#bef493;fill:#bef493}.tracer{fill:none;stroke-dasharray:4 5}.art-cross{fill:none;stroke:#5c8771}
  </style>
  <rect width="1200" height="630" fill="#0b1013"/>
  <ellipse cx="884" cy="313" rx="430" ry="360" fill="url(#backdrop)"/>
  <rect x="628" y="55" width="535" height="519" fill="url(#grid)"/>
  <path d="M77 480H1124" stroke="#31433d"/>
  ${brand}
  <text x="138" y="173" fill="#bef493" font-family="monospace" font-size="22" letter-spacing="4">CIRCULA</text>
  <text x="77" y="297" fill="#edf3ed" font-family="sans-serif" font-weight="700" font-size="88" letter-spacing="-5">Observatory<tspan fill="#bef493">.</tspan></text>
  <text x="82" y="366" fill="#bdcac9" font-family="sans-serif" font-size="25">Explore how digital resources accumulate,</text>
  <text x="82" y="401" fill="#bdcac9" font-family="sans-serif" font-size="25">persist, circulate and expire.</text>
  ${art}
</svg>`
await writeFile('public/og-image.png', new Resvg(svg).render().asPng())
