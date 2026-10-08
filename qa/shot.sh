#!/usr/bin/env bash
# usage: bash qa/shot.sh <WxH> <out.jpg> [hash] [scrollY]   — fresh load (cache-busted), wait for the deck, capture viewport
G="$HOME/.claude/skills/gstack"; B="$G/browse/dist/browse.exe"; OUT="$(pwd)/$2"; cd "$G" || exit 1
$B viewport "$1" >/dev/null
$B goto "http://127.0.0.1:5436/?v=$RANDOM${3:+#$3}" >/dev/null
$B js "Promise.all([...document.scripts].map(s=>s.src).concat(['js/core.js','js/faucet-ui.js','js/sandbox.js','js/app.js','js/github.js','js/miner.worker.js','css/ultra.css']).filter(Boolean).map(u=>fetch(u,{cache:'reload'}))).then(r=>r.length)" >/dev/null
$B goto "http://127.0.0.1:5436/?v=$RANDOM${3:+#$3}" >/dev/null
sleep 12
[ -n "$4" ] && { $B js "window.scrollTo(0,$4)" >/dev/null; sleep 1.5; }
$B screenshot --viewport >/dev/null; cp "$TEMP/browse-screenshot.png" "${OUT%.jpg}.png"
