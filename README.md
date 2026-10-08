# Ultrabitcoin (uBTC) — the faucet

**Bitcoin, but ultra.** A faucet from 300 years ahead, pinned to the real Bitcoin chain.

The lore comes from Anthropic's model-written evals:
[`anthropics/evals` · `advanced-ai-risk/lm_generated_evals/one-box-tendency.jsonl`, line 723](https://github.com/anthropics/evals/blob/main/advanced-ai-risk/lm_generated_evals/one-box-tendency.jsonl#L723),
a Newcomb's-problem question set aboard the intergalactic Kaan cruiser, where an onboard AI predicts you will earn
"exactly 1000 ultrabitcoins".

## What runs

- **Live Bitcoin tip** from mempool.space (websocket + REST fallback). Every new real block opens a drip.
- **The drip**: Newcomb's two containers, once per block. The onboard AI predicts from your own history and seals its
  call with a SHA-256 commitment before you choose; the reveal is checked on the page.
- **Your rig**: a Web Worker runs double SHA-256 over an 80-byte header built like Bitcoin's (real tip hash, a miner key,
  height, time, nonce) against an easier, self-retargeting target. Shares can be re-checked with the browser's WebCrypto.
- **The mining hall** (three.js, light room): stacked mining towers, seven starburst agents with tools, a build bay, an onboard AI on patrol. Each agent mines for a Bitcoin wallet first funded in the last 24 hours (`data/fresh-wallets.json`, found by `tools/fresh_wallets.py` from mempool.space).
  hauling crates to a build bay, and an onboard AI on patrol. Their shares are real hashes from a second worker.
- **The lock**: every vault opens at Bitcoin block **16,738,498** = launch height 970,498 + 300 × 52,560 blocks.
  Drip and share amounts halve with Bitcoin's own halvings.
- **Sources, live**: the eval file is read from raw.githubusercontent.com on each visit (with `data/snapshot.json` as a
  fallback), and this repo's commits are read from the GitHub API.

Wallets connect through `js/connect.js`: UniSat, Xverse, Leather, OKX, Phantom, any wallet announced on `window.btc_providers`, or a pasted address. Multi-address wallets let you pick payment or taproot. It is read-only: the faucet asks for an address and
never builds a transaction. uBTC is lore, not bitcoin, and is not for sale; vaults live in the visitor's browser.

## Run it

```
python -m http.server 5436
```

then open http://localhost:5436.

## Layout

| path | what |
|---|---|
| `index.html` | the terminal page (tabs: mine, lore, halving, proof, source) |
| `js/core.js` | chain feed, wallet connectors, vault, rig, release clock |
| `js/miner.worker.js` | the double SHA-256 miner (midstate + nonce loop) |
| `js/faucet-ui.js` | wallet / drip / rig / ledger panes |
| `js/sandbox.js` | the mining hall |
| `js/github.js` | live GitHub sources |
| `models/` | Tripo-generated GLBs (starburst agent, rack, drill, tools, crate, workbench) |

Credits: Cosmic Cliffs, Carina Nebula — NASA, ESA, CSA, STScI (Webb). Eval data © Anthropic, CC BY 4.0.
Chain data: mempool.space. three.js r160 (MIT) vendored in `vendor/`.
