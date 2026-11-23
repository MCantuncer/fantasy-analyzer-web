"""Build src/styles/fonts/mona-sans-numbers.woff2: Mona Sans (latin, wdth axis) with a plain tabular zero.

Mona Sans's tabular zero (zero.tf, reached through the `tnum` feature every number on the site
uses) is the slashed design: 3 contours, which reads as "00:18" in a code font. This copies the
plain zero's outline into zero.tf, centred in its 600-unit tabular cell, on every wdth/wght
master. Tabular figures stay on: zero.tf keeps its own advance and phantom points, so its cell
grows exactly like one.tf ... nine.tf on every axis.

Licence: Mona Sans is under the SIL Open Font License 1.1 with Reserved Font Name "Mona"
(see src/styles/fonts/OFL.txt). A Modified Version may not use the Reserved Font Name, so the
output's font names are changed to "Court Numbers". The copyright notice and the licence URL
in the name table are kept as they are.

Re-run this whenever @fontsource-variable/mona-sans is upgraded, from the repo root:

    pip install fonttools brotli
    python scripts/plain-tabular-zero.py \
        node_modules/@fontsource-variable/mona-sans/files/mona-sans-latin-wdth-normal.woff2 \
        src/styles/fonts/mona-sans-numbers.woff2

The output is deterministic (the source's timestamps are kept), so re-running it on the same
source gives the same bytes.
"""
import sys
from fontTools.ttLib import TTFont
from fontTools.ttLib.tables.TupleVariation import TupleVariation

src, out = sys.argv[1], sys.argv[2]
f = TTFont(src, recalcTimestamp=False)
glyf, gvar, hmtx = f['glyf'], f['gvar'].variations, f['hmtx']
# Read both glyphs' variations first (gvar decodes lazily against the current point count).
zero_vars = list(gvar['zero'])
tf_vars = list(gvar['zero.tf'])

zero = glyf['zero']
coords, end_pts, _ = zero.getCoordinates(glyf)
n = len(coords)
adv0, lsb0 = hmtx['zero']
advtf, _ = hmtx['zero.tf']
shift0 = round((advtf - adv0) / 2)          # 600 vs 612 -> -6

# Outline: copy the plain zero and move it to the centre of the tabular cell.
new = glyf['zero'].__class__()
new.__dict__.update({k: v for k, v in zero.__dict__.items()})
new.coordinates = coords.copy()
new.coordinates.translate((shift0, 0))
new.recalcBounds(glyf)
glyf['zero.tf'] = new
hmtx['zero.tf'] = (advtf, lsb0 + shift0)

# Variations: zero's outline deltas, plus half the difference in advance growth per master,
# and zero.tf's own phantom points so the cell width (tabular) is unchanged.
orig = [p for p in coords] + [(0, 0)] * 4
tf_by_axes = {tuple(sorted(tv.axes.items())): tv for tv in tf_vars}
new_vars = []
for tv in zero_vars:
    tv = TupleVariation(tv.axes, list(tv.coordinates))
    tv.calcInferredDeltas(orig, list(end_pts) + [n, n + 1, n + 2, n + 3])
    tf = tf_by_axes[tuple(sorted(tv.axes.items()))]
    tf_adv = tf.coordinates[-3] or (0, 0)   # phantom point 2 = advance width
    z_adv = tv.coordinates[n + 1]
    dx = (tf_adv[0] - z_adv[0]) / 2
    pts = [(round(x + dx), y) for x, y in tv.coordinates[:n]]
    phantoms = [(0, 0), (tf_adv[0], 0), (0, 0), (0, 0)]
    new_vars.append(TupleVariation(tv.axes, pts + phantoms))
gvar['zero.tf'] = new_vars

# OFL: a Modified Version must not carry the Reserved Font Name "Mona". Rename the family,
# full, PostScript and unique names; keep the copyright (0) and licence (13, 14) records.
NAME_IDS = (1, 3, 4, 6, 16, 17, 18, 21, 22, 25)
for rec in f['name'].names:
    if rec.nameID in NAME_IDS:
        s = rec.toUnicode()
        s = s.replace('Mona Sans', 'Court Numbers').replace('MonaSans', 'CourtNumbers')
        s = s.replace(';GTHB;', ';COURT;')
        rec.string = s
left = [r.nameID for r in f['name'].names if r.nameID in NAME_IDS and 'Mona' in r.toUnicode()]
assert not left, f'Reserved Font Name still in name IDs {left}'

f.flavor = 'woff2'
f.save(out)
print('zero.tf now', len(new_vars), 'masters,', zero.numberOfContours, 'contours, adv', advtf,
      '| family', f['name'].getDebugName(1))
