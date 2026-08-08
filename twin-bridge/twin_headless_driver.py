# Durable headless driver for CE_Integrated_Cell_V3_0-6.py — calls the
# twin's own advance() (HOOK A command dispatch + step + HOOK B state.json
# write) on a fast loop, exactly the reuse path advance()'s own docstring
# was extracted for. No twin code is imported-and-modified, only imported
# and called — same "extensions wrap, never alter" rule as server.mjs.
#
# Exists because the twin's normal entry point (running the file directly)
# ends in `plt.show()` with an interactive FuncAnimation loop, which stalls
# silently when the process has no foreground window (confirmed directly:
# backgrounding it left state.json's frame counter frozen). This driver
# skips the GUI/animation entirely and just calls advance() in a plain
# loop — the FF frontend has its own real-time 3D viewport, so no local
# window is needed to watch it run.
#
# Launched by twin-bridge/server.mjs's /twin-control/start (a child_process
# spawn), not run directly. Lives here (not in Construction_Enterprises)
# so no new file is added to the twin's own tree at all.

# Must happen BEFORE importing the twin module (which imports
# matplotlib.pyplot at module level and, at the bottom of the file, calls
# plt.show() as part of loading it — that's real, unavoidable given how
# the twin script is structured). Forcing the Agg backend here makes that
# plt.show() a real no-op instead of trying to open a real GUI window
# under this spawned, console-less, headless process — which is exactly
# what crashed the first live test of this script (confirmed: the child
# died silently around tick 50 until this fix was added).
import matplotlib
matplotlib.use("Agg")

import importlib.util
import os
import sys
import time

# Configurable so this same script runs unchanged on this Windows dev
# machine (default below) and on wherever it eventually deploys (Linux
# EC2) — a real env var, not a second hardcoded path for the new target.
TWIN_PATH = os.environ.get(
    "TWIN_MODULE_PATH",
    r"C:\Users\jchap\Dev\Construction_Enterprises\Chappell_Robotics\CE_Integrated_Cell_V3_0-6.py",
)

# Loading by absolute path (spec_from_file_location) does NOT add the
# twin's own directory to sys.path the way running it directly would --
# so its sibling top-level imports (trajectory_planner, planner_strategies,
# path_validation, work_reservation) fail with ModuleNotFoundError unless
# that directory is added here first.
sys.path.insert(0, os.path.dirname(TWIN_PATH))

spec = importlib.util.spec_from_file_location("ce_cell", TWIN_PATH)
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)  # runs the twin's own headless validation once, then defines advance()

print(f"[twin-driver] pid={__import__('os').getpid()} validation done, driving advance() loop", flush=True)
sys.stdout.flush()

i = 0
try:
    while True:
        mod.advance(i)
        i += 1
        time.sleep(0.01)
except KeyboardInterrupt:
    print("[twin-driver] stopped", flush=True)
