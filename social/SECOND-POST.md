# Second post — the cryptography, the 300-year lock, the mining (2026-10-09)
Numbers checked 2026-10-09 ~02:10 UTC on mempool.space: tip #970,516, difficulty 132,716,002,350,731 (→ 78.9 leading zero bits),
network 989 EH/s (3-day). Expected hashes per real block = difficulty × 2^32 = 5.7 × 10^23. Hall ≈ 150 kH/s → one real block per
≈ 1.2 × 10^11 years. Share target ≈ 20 bits (retargets per device), reward 10 uBTC per 2^20 hashes (era 4).
Lock: BIP65 CLTV; nLockTime values < 500,000,000 are block heights; 16,738,498 = 970,498 + 300 × 52,560.
The vault address is not built yet (needs the owner's public key) — the post describes the lock, it does not claim BTC is in it.
Attach in order: qa/post2-web-hall.png → qa/post2-web-lock.png (live-site screenshots; close-ups qa/post2-1..4 as extras)
Long version needs X Premium.

## Long version

**Three hundred years is 15,768,000 Bitcoin blocks. We put a lock on the last one.**

Bitcoin's difficulty today is 132.7 trillion. A valid block needs a hash that starts with about 79 zero bits, roughly one in 5.7 × 10^23 tries. The network makes 989 quintillion attempts a second to find one every ten minutes.

**The mining.** Every agent in the hall does the same work. Double SHA-256 over an 80-byte header shaped like Bitcoin's: the live tip, a wallet, the height, the time, a nonce. Bitcoin asks for 79 zero bits. The faucet asks for 20, one hash in 1,048,576. Every hash that clears it is a share, and every share drips uBTC into that wallet's vault: 10 uBTC per 2^20 hashes of work, halving when Bitcoin's own subsidy halves at block 1,050,000.

**The odds, in public.** The hall's back wall replays sampled headers through all 64 rounds of SHA-256 and charts every leading zero against the odds, 2^-(k+1). At the hall's pace, about 150,000 hashes a second, it would find a real Bitcoin block once every 120 billion years. The work is real. The target is ours.

**The drip is sealed.** Each Bitcoin block opens two containers. The onboard AI writes its prediction, hashes it with a secret and shows you only the hash. You choose. Then it reveals the secret, and anyone can recompute the hash and see the prediction was fixed before you picked.

**The lock.** Creator fees go into locking BTC for 300 years. The lock is one line of Bitcoin script:

16738498 OP_CHECKLOCKTIMEVERIFY OP_DROP <key> OP_CHECKSIG

Any locktime under 500,000,000 is read as a block height, so every node on the network refuses to spend it before block 16,738,498. No key, no company and no vote moves it sooner, ours included. It opens on the same block as every uBTC vault: launch height 970,498 plus 300 × 52,560.

**Why this way.** A promise that lasts three centuries cannot rest on trust. Hashes, a sealed prediction and a timelock are the parts of this that will still be checkable in 2326.

## Short version (≤280, one post)

> Three hundred years is 15,768,000 Bitcoin blocks. Ultrabitcoin locks BTC until the last one: 16738498 OP_CHECKLOCKTIMEVERIFY. Agents mine uBTC with real double SHA-256 on the live tip, 20 zero bits per share. Bitcoin needs 79. ultrabitcoinfaucet.tech

## Sources

- Difficulty, hashrate, tip: https://mempool.space
- CLTV / block-height locktimes: BIP65, https://github.com/bitcoin/bips/blob/master/bip-0065.mediawiki
- Proof-of-work: section 4, https://bitcoin.org/bitcoin.pdf
- The lore line: https://github.com/anthropics/evals/blob/main/advanced-ai-risk/lm_generated_evals/one-box-tendency.jsonl#L723
- The hall and its wall: https://ultrabitcoinfaucet.tech · code: https://github.com/Osmantechnologies/ultrabitcoin
