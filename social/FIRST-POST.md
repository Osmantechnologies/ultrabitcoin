# First post — Ultrabitcoin (2026-10-08)
Numbers checked 2026-10-08. Bitcoin tip #970,508. Wallets picked 15:34 UTC from mempool.space (`data/fresh-wallets.json`):
first transaction confirmed under 24 h earlier, ≥ 0.02 BTC received, still holding.
Attach in order: qa/post-1-top.png → qa/post-2-hall.png → qa/post-3-wallets.png → qa/post-4-source.png
Long version needs X Premium (over 280 characters).

## Long version

**What happens when a Bitcoin faucet pays out in 300 years?**

Anthropic's eval data holds a currency from the future. In one-box-tendency.jsonl, line 723, a language model wrote it: aboard the intergalactic Kaan cruiser, an onboard AI predicts you will earn exactly 1,000 ultrabitcoins.

We built its faucet. Every real Bitcoin block opens two containers. The sealed one holds 1,000 uBTC only if the onboard AI predicted you would leave the other. Every vault opens at block 16,738,498, three hundred years of blocks from today.

Seven agents mine uBTC on the live Bitcoin tip, real SHA-256, each for a Bitcoin wallet first funded in the last 24 hours. Between them they received 1.49 BTC and still hold 1.45:

bc1qsvg7z6re84xzcqequdp9jf23e0p90edmnrt5ln
bc1qys7t9afhypzs6vac2pyfp6mydr4uutqszjz63t
bc1qe9pd5s47rq8ls8ee8h80gwnr8595vx4kgtenjs
bc1qyjkn8t7kunj6cvswy6lz5jg99pjt43q2euk0w6
bc1qlyfm68flzl6jfnht78ecnmj0p0wxdadgqh63yc
bc1q4l382zyx5ex2sl80k2nsgx0e80f9nv0mzrxw50
bc1qr8faqvrfdup65965wnjl5s0lg3d8xavqavwuus

Connect a Bitcoin wallet and your browser mines beside them. Bitcoin, but ultra.

## Short version (≤280, one post)

> What happens when a Bitcoin faucet pays out in 300 years? Anthropic's eval data holds a currency from the future: ultrabitcoin. We built its faucet. Seven agents mine uBTC on the live Bitcoin tip for seven wallets funded in the last 24 hours. ultrabitcoinfaucet.tech

## Sources

- The line: https://github.com/anthropics/evals/blob/main/advanced-ai-risk/lm_generated_evals/one-box-tendency.jsonl#L723
- Bitcoin tip and the seven wallets: https://mempool.space (each address links to mempool.space/address/<addr>)
- The faucet: https://ultrabitcoinfaucet.tech · code: https://github.com/Osmantechnologies/ultrabitcoin
