# First post — Ultrabitcoin (v2, 2026-10-09: owner asked for 4 wallets + 2 tx links)
Numbers checked 2026-10-09 ~00:20 UTC on mempool.space. Wallets picked 2026-10-08 15:34 UTC (`data/fresh-wallets.json`):
first transaction confirmed under 24 h before the pick. The site now mines for exactly these four (highest balances); all four still hold every satoshi.
Tx c63abc… pays 1.0 BTC to bc1qsvg7… (block 970,436); tx 1c607c… pays 0.28592368 BTC to bc1qys7t… (block 970,404).
Attach in order: qa/post-1-top.png → qa/post-2-hall.png → qa/post-3-wallets.png → qa/post-4-source.png
Long version needs X Premium (over 280 characters).
Coin: $uBTC "Ultra Bitcoin", pump.fun, CA 3ibpM2bK8xMvAY2vYpQV6W3xWuxiPUoqPPJt4ieopump (verified on DexScreener + Solana RPC 2026-10-09, ~$13.5K mcap). CA removed from the post by owner request (2026-10-09).
Creator fees (owner's choice, 2026-10-09): BTC into a CLTV-timelocked vault (`<16738498> OP_CHECKLOCKTIMEVERIFY OP_DROP <pubkey> OP_CHECKSIG`, P2WSH).
The vault address is NOT built yet: it needs the owner's public key. Build + verify it before the coin launches, then add the address to the site.

## Long version

**What happens when a Bitcoin faucet pays out in 300 years?**

Anthropic's eval data holds a currency from the future. In one-box-tendency.jsonl, line 723, a language model wrote it: aboard the intergalactic Kaan cruiser, an onboard AI predicts you will earn exactly 1,000 ultrabitcoins.

We built its faucet. Every real Bitcoin block opens two containers. The sealed one holds 1,000 uBTC only if the onboard AI predicted you would leave the other. Every vault opens at block 16,738,498, three hundred years of blocks from today.

Seven agents mine uBTC on the live Bitcoin tip, real SHA-256, in crews for four Bitcoin wallets that were less than a day old when we picked them. They received 1.39 BTC and have not moved a satoshi:

bc1qsvg7z6re84xzcqequdp9jf23e0p90edmnrt5ln
bc1qys7t9afhypzs6vac2pyfp6mydr4uutqszjz63t
bc1qe9pd5s47rq8ls8ee8h80gwnr8595vx4kgtenjs
bc1qyjkn8t7kunj6cvswy6lz5jg99pjt43q2euk0w6

Their first funding, on chain:
mempool.space/tx/c63abcdba3b4405a0a42ad22cb0aa363f2f41f48c8d9a8a357acb4538e4f6c6a
mempool.space/tx/1c607cf1899285f26cb50296b5cafcd45907a18c31bdb670dab80b6239c7aa45

Connect a Bitcoin wallet and your browser mines beside them. Bitcoin, but ultra.

**Our goal.** A Bitcoin faucet that keeps a 300-year promise in the open. uBTC drips today, every vault opens at block 16,738,498, and real bitcoin waits for the same block.

**Creator fees.** Fees go into locking BTC for 300 years, until block 16,738,498. Mine uBTC.

## Short version (≤280, one post)

> What happens when a Bitcoin faucet pays out in 300 years? Anthropic's eval data holds a currency from the future: ultrabitcoin. We built its faucet. Seven agents mine uBTC on the live Bitcoin tip for wallets under a day old. ultrabitcoinfaucet.tech

## Sources

- The line: https://github.com/anthropics/evals/blob/main/advanced-ai-risk/lm_generated_evals/one-box-tendency.jsonl#L723
- The four wallets and their first funding txs: https://mempool.space (1.0000 + 0.2859 + 0.0650 + 0.0434 BTC = 1.3944 BTC, all held at check time)
- The faucet: https://ultrabitcoinfaucet.tech · code: https://github.com/Osmantechnologies/ultrabitcoin
