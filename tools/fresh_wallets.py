# fresh_wallets.py — find bitcoin addresses FIRST FUNDED in the last 24 hours (mempool.space public API, no key).
# Samples outputs from blocks across the last ~144 blocks, keeps addresses with a meaningful amount, then confirms
# the address's very first transaction landed < 24 h ago. Writes data/fresh-wallets.json.
# Run:  python tools/fresh_wallets.py [want=7]
import json, sys, time, urllib.request, datetime, os, random
API = 'https://mempool.space/api'
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WANT = int(sys.argv[1]) if len(sys.argv) > 1 else 7
MIN_SATS = 2_000_000          # 0.02 BTC: skip dust and change-sized outputs
NOW = time.time(); DAY = 86400

def get(path, tries=4):
    for i in range(tries):
        try:
            req = urllib.request.Request(API + path, headers={'User-Agent': 'ultrabitcoin-fresh-wallets'})
            with urllib.request.urlopen(req, timeout=20) as r:
                b = r.read(); return json.loads(b) if b[:1] in (b'{', b'[') else b.decode()
        except Exception as e:
            if '429' in str(e): time.sleep(3 + i * 3)
            else: time.sleep(1)
    return None

tip = int(get('/blocks/tip/height'))
heights = sorted(random.Random(tip).sample(range(tip - 140, tip + 1), 24))   # 24 blocks spread over the last ~day
seen, cands = set(), []
for h in heights:
    bh = get(f'/block-height/{h}'); time.sleep(0.15)
    for start in (0, 25, 50):
        txs = get(f'/block/{bh}/txs/{start}') or []; time.sleep(0.15)
        for tx in txs:
            if tx['vin'] and tx['vin'][0].get('is_coinbase'): continue
            for o in tx['vout']:
                a = o.get('scriptpubkey_address'); t = o.get('scriptpubkey_type')
                if not a or a in seen or t not in ('v0_p2wpkh', 'v1_p2tr', 'p2pkh', 'p2sh'): continue
                if o['value'] < MIN_SATS: continue
                seen.add(a); cands.append((a, h, o['value'], tx['txid']))
    print(f'block {h}: {len(cands)} candidates', flush=True)

random.Random(tip).shuffle(cands)
fresh = []
for a, h, v, txid in cands:
    if len(fresh) >= WANT * 3: break
    st = get(f'/address/{a}'); time.sleep(0.2)
    if not st: continue
    cs = st['chain_stats']; n = cs['tx_count']
    if n == 0 or n > 8: continue                    # fresh wallets have a handful of txs, not exchange hot wallets
    txs = get(f'/address/{a}/txs'); time.sleep(0.2)
    if not txs: continue
    times = [t['status'].get('block_time') for t in txs if t['status'].get('confirmed')]
    if not times: continue
    first = min(times)
    if NOW - first > DAY: continue
    bal = cs['funded_txo_sum'] - cs['spent_txo_sum']
    fresh.append({'address': a, 'first_funded': datetime.datetime.fromtimestamp(first, datetime.UTC).strftime('%Y-%m-%dT%H:%M:%SZ'),
                  'first_txid': [t['txid'] for t in txs if t['status'].get('block_time') == first][0],
                  'funded_btc': cs['funded_txo_sum'] / 1e8, 'balance_btc': bal / 1e8, 'tx_count': n})
    print(f'  fresh {a[:14]}… first {fresh[-1]["first_funded"]} funded {cs["funded_txo_sum"]/1e8:.4f} bal {bal/1e8:.4f} txs {n}', flush=True)

# prefer wallets still holding coins, then the biggest first funding
fresh.sort(key=lambda w: (w['balance_btc'] > 0, w['funded_btc']), reverse=True)
out = {'fetched_at': datetime.datetime.now(datetime.UTC).strftime('%Y-%m-%dT%H:%M:%SZ'), 'tip': tip,
       'rule': 'first transaction confirmed < 24h before fetched_at; >= 0.02 BTC received; <= 8 txs', 'source': 'mempool.space',
       'wallets': fresh[:WANT], 'reserve': fresh[WANT:]}
json.dump(out, open(os.path.join(HERE, 'data', 'fresh-wallets.json'), 'w'), indent=1)
print(f'\n{len(fresh)} fresh wallets found, {min(WANT, len(fresh))} written')
