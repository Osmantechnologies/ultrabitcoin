# Third post — quantum, and why uBTC is mined on hashes (2026-10-09)
Honesty line (not in the post): the faucet runs no quantum hardware. The post's claim is that uBTC is built on the
quantum-resistant half of Bitcoin's cryptography (hashes) and keeps the quantum-vulnerable half (the public key) hidden.
Sources checked 2026-10-09:
- Aggarwal et al., "Quantum attacks on Bitcoin, and how to protect against them", arXiv:1710.10377 — PoW relatively resistant
  (ASICs far faster than near-term quantum clock speeds); the elliptic-curve signatures are much more at risk.
- Webber et al., "The impact of hardware specifications on reaching quantum advantage in the fault tolerant regime",
  arXiv:2108.12371 (AVS Quantum Science 2022) — ~317 million physical qubits to break a Bitcoin key in one hour, 13 million in a day.
- Grover: ~(π/4)·√N queries. Share at 20 bits: N = 1,048,576 → ≈ 804. Real block: N ≈ difficulty × 2^32 = 5.7 × 10^23 → ≈ 5.9 × 10^11.
- Vault = P2WSH: on chain only SHA-256(script) until spent; Grover halves a 256-bit preimage to ~128-bit work.
Attach: qa/post2-2-machine.png (the SHA-256 machine) → qa/post2-web-lock.png (the lock)
Long version needs X Premium.

## Long version

**The vault opens in 2326. Quantum computers will get there first.**

Bitcoin rests on two kinds of cryptography. Hashes, SHA-256, do the mining. Signatures, on an elliptic curve, prove who owns a coin. A large quantum computer hits them very differently.

**Signatures break.** Shor's algorithm breaks elliptic-curve keys outright. Webber et al. estimate 13 million physical qubits could break a Bitcoin key in a day, 317 million in an hour. Any coin whose public key sits on chain is exposed.

**Hashes bend.** Grover's algorithm only takes the square root of a search. A uBTC share needs about 1,048,576 classical hashes; Grover would need about 800 quantum queries. A real Bitcoin block needs about 5.7 × 10^23 hashes; Grover, about 6 × 10^11, each one a full double SHA-256 run as a quantum circuit. Aggarwal et al. found Bitcoin's proof-of-work holds, because ASICs run far faster than quantum clocks. The signatures are the weak part.

**So uBTC is mined on the half that bends.** Every part of it is a hash. The agents and your rig mine double SHA-256 on the live Bitcoin tip. The onboard AI's prediction is sealed with SHA-256 before you choose. A vault is an address. Nothing in the faucet needs a signature to mine.

**And the lock hides its key.** The 300-year vault is a pay-to-witness-script-hash address: on chain it is only the SHA-256 of its script. The public key inside stays hidden until block 16,738,498, behind 256 bits of hash that Grover can only halve to 128. A key that never appears gives Shor nothing to break.

**Why this way.** A 300-year promise has to outlast the cryptography it was born with. We built on the half of Bitcoin that quantum computers bend, and kept the half they break out of sight until the day the vault opens.

## Short version (≤280, one post)

> The uBTC vault opens in 2326. Quantum computers get there first. Shor breaks Bitcoin's signatures; Grover only square-roots its hashes: a uBTC share, 1,048,576 hashes, becomes ~800 quantum queries. So uBTC is mined on hashes, and the lock hides its key. ultrabitcoinfaucet.tech

## Sources

- Aggarwal et al., Quantum attacks on Bitcoin, and how to protect against them: https://arxiv.org/abs/1710.10377
- Webber et al., The impact of hardware specifications on reaching quantum advantage in the fault tolerant regime: https://arxiv.org/abs/2108.12371
- CLTV timelocks, BIP65: https://github.com/bitcoin/bips/blob/master/bip-0065.mediawiki
- The faucet: https://ultrabitcoinfaucet.tech · code: https://github.com/Osmantechnologies/ultrabitcoin
