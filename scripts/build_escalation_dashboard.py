#!/usr/bin/env python3
"""Build the escalation-transfer dashboard from the monthly Transfer Dashboard workbook.

Usage:
  python3 scripts/build_escalation_dashboard.py <Transfer_Dashboard.xlsx> [out.html]

Reads the `Data` sheet (same layout as the June 2026 export), flags every transfer whose
Transferred Skill contains "Escalat", and embeds a compact copy of the rows in
tools/escalation-dashboard/template.html. The output is one self-contained HTML file.

NOTE: the output contains agent names. It lives under tools/ (not public/) so the Next.js /
Netlify site does not serve it.
"""
import json, re, sys
from pathlib import Path
import openpyxl

src = Path(sys.argv[1])
root = Path(__file__).resolve().parent.parent
tpl = root / "tools/escalation-dashboard/template.html"
out = Path(sys.argv[2]) if len(sys.argv) > 2 else root / "tools/escalation-dashboard/escalation-dashboard.html"

wb = openpyxl.load_workbook(src, read_only=True)
it = wb["Data"].iter_rows(values_only=True)
hdr = list(next(it))
col = {h: i for i, h in enumerate(hdr) if h}
need = ["Original Agent", "Original Skill", "Transferred Skill", "Transfer Type",
        "Team Manager", "Team", "Time of Original Contact"]
missing = [n for n in need if n not in col]
if missing:
    sys.exit(f"Data sheet is missing columns: {missing}")

def idx(table, val):
    if val not in table:
        table[val] = len(table)
    return table[val]

agents, oskills, tskills, tms, teams, types = {}, {}, {}, {}, {}, {}
agent_meta = {}
rows = []
dates = []
for r in it:
    if r[col["Original Agent"]] is None:
        continue
    a = r[col["Original Agent"]]
    tm = r[col["Team Manager"]]
    team = r[col["Team"]]
    ai = idx(agents, a)
    agent_meta[ai] = (idx(tms, tm), idx(teams, team))
    ts = r[col["Transferred Skill"]]
    d = r[col["Time of Original Contact"]]
    dates.append(d)
    rows.append([ai, idx(oskills, r[col["Original Skill"]]), idx(tskills, ts),
                 idx(types, r[col["Transfer Type"]]), d.day,
                 1 if re.search("escalat", ts, re.I) else 0])

lst = lambda t: [k for k, _ in sorted(t.items(), key=lambda kv: kv[1])]
data = {
    "period": f"{min(dates):%b %Y}" if min(dates).month == max(dates).month else f"{min(dates):%b %Y} – {max(dates):%b %Y}",
    "from": f"{min(dates):%Y-%m-%d}", "to": f"{max(dates):%Y-%m-%d}",
    "agents": [[n, *agent_meta[i]] for i, n in enumerate(lst(agents))],
    "oskills": lst(oskills), "tskills": lst(tskills), "tms": lst(tms),
    "teams": lst(teams), "types": lst(types), "rows": rows,
}
html = tpl.read_text().replace("/*__DATA__*/null", json.dumps(data, separators=(",", ":")))
out.write_text(html)
print(f"{len(rows):,} transfers, {sum(r[5] for r in rows):,} escalated -> {out} ({out.stat().st_size/1024:.0f} KB)")
