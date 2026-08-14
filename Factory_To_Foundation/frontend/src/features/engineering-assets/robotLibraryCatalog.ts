/**
 * Real catalog data for all 12 governed simulation directories (12 unique
 * files), populated directly from the engineering-recovery records in
 * ConstructionEnterprise/simulations-'s simulations/engineering-recovery/
 * -- not invented ahead of that material.
 *
 * Phase 4.5 sync (post-Phase-3B): every entry except the protected
 * ce-integrated-cell-v3-0-6 now has a verified PyVista renderer path
 * (visualization.pyvista). That is real, checkable progress -- but it is
 * deliberately NOT the same claim as `status: "previewable"` (no committed
 * preview image exists in this repo yet, only real generated frames
 * inspected during verification and left in a scratch location) or
 * `status: "launchable"` (no browser-loadable web asset exists; PyVista
 * here renders off-screen in a desktop Python environment). Top-level
 * `status` intentionally stays `not_ready` for the 10 non-piloted entries
 * until an actual preview asset is committed and referenced -- do not
 * promote it just because the renderer works.
 *
 * Not wired into any route, page, or nav item yet -- data model only.
 */
import type { EngineeringAsset } from "./engineeringAssetTypes";

const SIM_REPO = "ConstructionEnterprise/simulations-";
const RECOVERY_DIR = "simulations/engineering-recovery";

export const robotLibraryCatalog: EngineeringAsset[] = [
  {
    id: "assembly-cell-v100",
    name: "LGS Frame Assembly & Weld Cell (v29)",
    category: "jig-frame-cell",
    library: "robot",
    status: "previewable",
    immutable: false,
    engineering: {
      geometry: { summary: "Two 3-DOF planar-arm robots build an LGS stud-and-post frame on a 4-slot fixture table via a zone-based accumulation conveyor, then weld it at 4 corner points." },
      behavior: {
        stateSequence: ["IDLE", "PICKING_A/B", "PRE_PLACE", "PLACING", "PICKING", "PLACING", "WELDING", "FRAME_COMPLETE"],
        processFlow: "Robot 1 loads studs onto the conveyor; zone-gated queueing advances parts toward Robot 2, which places them into the 4-slot frame and welds once all slots are filled. Restocks automatically for continuous production.",
      },
      interfaces: [{ name: "engine.snapshot()", description: "Read-only render-facing state export -- the exact contract the PyVista pilot renderer consumes, proven independent of any specific rendering backend." }],
      recoveryDocPath: `${RECOVERY_DIR}/assembly_cell_v100.md`,
    },
    source: { repository: SIM_REPO, path: "simulations/Dual_CR6_Cell/assembly_cell_v100.py", lineage: "Already migrated once from matplotlib to pygame (\"v28 -> v29\") with a deliberately renderer-agnostic SimulationEngine/Camera/Renderer/HUD split before this repository even existed.", immutable: false },
    visualization: {
      currentRenderer: "pygame",
      migrationClass: "piloted",
      migrationNotes: "Phase 2 pilot: SimulationEngine extracted verbatim (programmatic sed, not retyped) into a standalone file with zero pygame dependency; a new PyVista renderer was written against its existing snapshot() method. Ran 600 real steps, verified correct state-machine progression and a real assembled frame corner rendered in the PyVista output. Original source file never opened for writing.",
      previewImageUrl: undefined,
      pyvista: {
        status: "verified",
        engineFile: "simulation_engine.py",
        rendererFile: "pyvista_renderer.py",
        verifiedBy: "600 real steps; correct state-machine progression; a real assembled frame corner (track+stud at a right angle) rendered on the fixture table by frame 600.",
      },
    },
    verification: {
      engineeringRecoveryStatus: "recovered",
      runtimeStatus: "runnable-headless",
      liveTwinCorrelation: "none",
      knownLimitations: ["PyVista renderer proven at snapshot/state level, not visually diffed against the original pygame output (pygame failed to install in this environment -- no prebuilt wheel yet for Python 3.14)", "No interactive controls or particle/spark visual fidelity ported yet"],
    },
  },
  {
    id: "cr6-6axis-v3-1-corrected",
    name: "CR6 6-Axis Pick Validation (V3.1)",
    category: "robot-arm",
    library: "robot",
    status: "not_ready",
    immutable: false,
    engineering: {
      geometry: {
        summary: "Single CR6 6-DOF arm, full analytical DH forward/inverse kinematics, static-part pick/place over a fixed conveyor.",
        keyConstants: { D1: "1.5 -- base height", A2: "2.5 -- shoulder link", A3: "2.0 -- elbow link", D6: "0.5 -- wrist-to-tool offset", MAX_REACH: "5.0 = A2+A3+D6" },
      },
      behavior: { stateSequence: ["HOME", "PICK_APPROACH", "PICK", "LIFT", "PLACE", "HOME"] },
      recoveryDocPath: `${RECOVERY_DIR}/CR6_6Axis_V3_1_Corrected.md`,
    },
    source: { repository: SIM_REPO, path: "simulations/CR6_6Axis/CR6_6Axis_V3_1_Corrected.py", immutable: false },
    visualization: {
      currentRenderer: "matplotlib",
      migrationClass: "C",
      migrationNotes: "No classes -- state was 14 module-level globals mutated directly inside the animation callback. Phase 3B reimplemented the same computation inside a new CR6Engine class (not extracted, since there was no class to extract).",
      pyvista: {
        status: "verified",
        engineFile: "cr6_v3_1_engine.py",
        rendererFile: "cr6_v3_1_render.py",
        verifiedBy: "Independent FK(IK(target)) kinematics round-trip (error ~4e-16); 2000-frame run confirmed all 5 documented states reached with real pick/attach events.",
      },
    },
    verification: { engineeringRecoveryStatus: "recovered", runtimeStatus: "runnable-headless", liveTwinCorrelation: "none", knownLimitations: ["No stated units", "\"CR6\" not confirmed against a real datasheet"] },
  },
  {
    id: "cr6-6axis-v6-1-workspace-guard",
    name: "CR6 6-Axis Object Tracking (V6.1, Workspace Guard)",
    category: "robot-arm",
    library: "robot",
    status: "not_ready",
    immutable: false,
    engineering: {
      geometry: { summary: "Same arm as V3.1, plus a moving conveyor and an explicit reachability-guard safety check before committing to an intercept.", keyConstants: { SAFE_INTERCEPT_RADIUS: "4.6 = MAX_REACH * 0.92" } },
      behavior: { stateSequence: ["HOME", "PICK_APPROACH", "PICK", "LIFT", "PLACE", "HOME"], processFlow: "Waits at HOME until a moving part enters the verified-safe intercept radius, then launches the pick sequence." },
      relationships: [{ relatedAssetId: "cr6-6axis-v3-1-corrected", kind: "lineage-successor", description: "Same robot geometry; adds moving-target tracking and a workspace-guard bug fix." }],
      recoveryDocPath: `${RECOVERY_DIR}/CR6_6Axis_V6_1_Workspace_Guard.md`,
    },
    source: { repository: SIM_REPO, path: "simulations/CR6_6axis_Object_Tracking/CR6_6Axis_V6_1_Workspace_Guard.py.py", immutable: false },
    visualization: {
      currentRenderer: "matplotlib",
      migrationClass: "C",
      migrationNotes: "Same as V3.1 -- no classes, reimplemented inside a new engine class.",
      pyvista: {
        status: "verified",
        engineFile: "cr6_v6_1_engine.py",
        rendererFile: "cr6_v6_1_render.py",
        verifiedBy: "FK/IK round-trip check passed, but the first full-cycle verification caught a real transcription error (STATE_SEQUENCE dropped the source's trailing \"HOME\", so PLACE was never reached). Fixed against the verified source (confirmed via grep on the actual file) and documented in the engine file's own docstring; re-verified with 10 complete pick-place cycles over 3000 frames.",
      },
    },
    verification: { engineeringRecoveryStatus: "recovered", runtimeStatus: "runnable-headless", liveTwinCorrelation: "none", knownLimitations: ["Only file in the set with axis units explicitly labeled (meters)", "Migration caught and fixed a state-cycle transcription bug -- see visualization.pyvista.verifiedBy"] },
  },
  {
    id: "cr6-v8-0-dual-robot-cell",
    name: "CR6 Dual Robot Cell (V8.0)",
    category: "dual-robot-cell",
    library: "robot",
    status: "not_ready",
    immutable: false,
    engineering: {
      geometry: { summary: "Two CR6 arms handing off one part: Robot A picks from conveyor to a fixture, Robot B moves the part from fixture to output." },
      behavior: { stateSequence: ["ON_CONVEYOR", "COMMITTED_TO_A", "HELD_BY_A", "IN_FIXTURE", "HELD_BY_B", "COMPLETE"], processFlow: "Part-ownership state is the only communication channel between the two robots; transitions only at physical proximity events, not timers." },
      interfaces: [{ name: "Part ownership handoff", description: "Fixture position acts as the physical I/O boundary between Robot A's and Robot B's independent motion programs." }],
      recoveryDocPath: `${RECOVERY_DIR}/CR6_V8_0_Dual_Robot_Cell.md`,
    },
    source: { repository: SIM_REPO, path: "simulations/CR6_V08_Dual_Robot_Cell/CR6_V8_0_Dual_Robot_Cell.py", immutable: false },
    visualization: {
      currentRenderer: "matplotlib",
      migrationClass: "A",
      migrationNotes: "Robot/Part/World classes present; World.step() verified structurally separated from drawing -- same pattern as the pilot.",
      pyvista: { status: "verified", engineFile: "cr6_v8_0_engine.py", rendererFile: "cr6_v8_0_render.py", verifiedBy: "500 real steps; rendered output showed Robot A correctly holding the part at LIFT, matching the HELD_BY_A ownership state." },
    },
    verification: { engineeringRecoveryStatus: "recovered", runtimeStatus: "runnable-headless", liveTwinCorrelation: "none", knownLimitations: ["Docstring says \"V7.5,\" filename/title say \"V8.0\" -- unresolved"] },
  },
  {
    id: "dual-robot-jig-frame-v1-1",
    name: "Dual Robot LGS Jig Frame (V1.1)",
    category: "jig-frame-cell",
    library: "robot",
    status: "not_ready",
    immutable: false,
    engineering: {
      geometry: { summary: "Two CR6 robots build a real 5-member LGS wall panel (bottom track, 3 studs, top track) on a jig table; CR6-1 places, CR6-2 welds each joint." },
      behavior: { processFlow: "bottom_track -> stud_L -> stud_C -> stud_R -> top_track, welded immediately after each placement.", stateSequence: ["IN_RACK", "HELD", "PLACED", "WELDED"] },
      recoveryDocPath: `${RECOVERY_DIR}/Dual_Robot_Jig_Frame_V1_1.md`,
    },
    source: { repository: SIM_REPO, path: "simulations/Dual_Robot_Jig_Frame_V1_1/Dual_Robot_Jig_Frame_V1_1.py", lineage: "Identical file also present at simulations/Dual_Robot_Cell_Jig_Frame/ -- documented once, both directories point to the same record.", immutable: false },
    visualization: {
      currentRenderer: "matplotlib",
      migrationClass: "A",
      migrationNotes: "Robot/Member/World classes present, same pattern as the pilot.",
      pyvista: { status: "verified", engineFile: "jig_frame_engine.py", rendererFile: "jig_frame_render.py", verifiedBy: "800 real steps; rendered output showed real member status progression (IN_RACK/HELD/PLACED) matching the documented lifecycle." },
    },
    verification: { engineeringRecoveryStatus: "recovered", runtimeStatus: "runnable-headless", liveTwinCorrelation: "none", knownLimitations: ["Documented V2+ roadmap (rail travel, outfeed, cycle counter) was never implemented"] },
  },
  {
    id: "factory-rail-v2",
    name: "Factory Rail Transport (V2.0)",
    category: "rail-system",
    library: "robot",
    status: "not_ready",
    immutable: false,
    engineering: {
      geometry: { summary: "A standard CR6 robot mounted on a linear rail; the rail relocates the robot base along X between two jig stations, robot kinematics unchanged." },
      behavior: { stateSequence: ["RAIL_TO_JIG2", "RAIL_TO_JIG1"], processFlow: "Robot starts at Jig_1, rail travels to Jig_2, robot picks a completed wall frame, rail returns, robot places it -- transports a finished panel, does not assemble one." },
      recoveryDocPath: `${RECOVERY_DIR}/Factory_Rail_V2.md`,
    },
    source: { repository: SIM_REPO, path: "simulations/Factory_Rail_v2/Factory_Rail_V2.py", immutable: false },
    visualization: {
      currentRenderer: "matplotlib",
      migrationClass: "A",
      migrationNotes: "FactoryRail/CR6/WallFrame/World classes present, same pattern as the pilot.",
      pyvista: { status: "verified", engineFile: "factory_rail_engine.py", rendererFile: "factory_rail_render.py", verifiedBy: "800 real steps; rendered output showed the rail correctly returning to X=0 with the robot holding the flat wall frame at PLACE." },
    },
    verification: { engineeringRecoveryStatus: "recovered", runtimeStatus: "runnable-headless", liveTwinCorrelation: "none", knownLimitations: [] },
  },
  {
    id: "ce-overhead-gantry-v1",
    name: "Overhead Gantry Crane (V1.0, 2.0T)",
    category: "overhead-gantry",
    library: "robot",
    status: "not_ready",
    immutable: false,
    engineering: {
      geometry: { summary: "Real 2.0-ton portal gantry crane: end trucks + bridge beam (X travel), trolley/hoist (Y travel), hook block (Z travel). Full structural anatomy, not a stick figure.", keyConstants: { BRIDGE_BEAM_Z: "5.8 -- hook hang height", RUNWAY_X_MIN: "2.0", RUNWAY_X_MAX: "26.0" } },
      behavior: { stateSequence: ["PARKED", "TRAVELING_X", "TRAVELING_Y", "LOWERING", "HOOKED", "LIFTING", "TRAVELING_DELIVER_X", "TRAVELING_DELIVER_Y", "LOWERING_DELIVER", "PLACING", "RISING", "RETURNING_Y", "RETURNING_X", "PARKED"] },
      relationships: [{ relatedAssetId: "ce-integrated-cell-v2-6", kind: "coordinate-space-match", description: "Pickup zone X=5.5 and delivery zone X=22.0 exactly match CE_Integrated_Cell_V2_6's TILT_CX and MOD_CX -- confirmed both directions." }],
      recoveryDocPath: `${RECOVERY_DIR}/CE_Overhead_Gantry_V1.md`,
    },
    source: { repository: SIM_REPO, path: "simulations/Overhead_Gantry_V1/CE_Overhead_Gantry_V1.py", lineage: "Reference: Chappell Robotics 2.0T portal gantry render (June 2026) -- models real physical equipment, not an invented prop.", immutable: false },
    visualization: {
      currentRenderer: "matplotlib",
      migrationClass: "A",
      migrationNotes: "OverheadGantry/World classes present; update() verified as ax.clear() -> world.step() -> draw, same pattern as the pilot. Solid Poly3DCollection geometry, more directly portable than line-based robot-arm renders.",
      pyvista: { status: "verified", engineFile: "gantry_engine.py", rendererFile: "gantry_render.py", verifiedBy: "The file's own built-in run_headless_validation() (preserved verbatim) independently PASSED on import at frame 3792 -- exactly matching the frame number cited in the original docstring. 4000 further real steps rendered, showing correct end-truck/bridge/trolley/hook structure and NORTH/SOUTH panel placement." },
    },
    verification: { engineeringRecoveryStatus: "recovered", runtimeStatus: "runnable-headless", liveTwinCorrelation: "shared-coordinate-space", knownLimitations: ["Developed/validated on Android/Pydroid 3 per its own docstring"] },
  },
  {
    id: "ce-integrated-cell-v2-6",
    name: "Integrated Modular Wall Cell (V2.6)",
    category: "integrated-cell",
    library: "robot",
    status: "not_ready",
    immutable: false,
    engineering: {
      geometry: { summary: "4-station wall cell: framing (2 robots) -> roller transfer -> tilt table (2 robots, sheathing) -> overhead crane outfeed. Tilts 0-60 deg (not 90, despite the docstring)." },
      behavior: { processFlow: "Raw studs -> CR6-F1/F2 frame the wall -> roller transfer -> CR6-S1/S2 sheathe it -> tilt to 60 deg -> crane lifts and parks." },
      relationships: [
        { relatedAssetId: "dual-robot-jig-frame-v1-1", kind: "lineage-predecessor", description: "Reuses the same bottom-track/3-stud/top-track ASSEMBLY_SEQ pattern." },
        { relatedAssetId: "ce-overhead-gantry-v1", kind: "coordinate-space-match", description: "TILT_CX=5.5 matches the gantry file's PICKUP_X exactly." },
        { relatedAssetId: "ce-integrated-cell-v1-3", kind: "lineage-successor", description: "Adds a 4th station (tilt) and crane outfeed vs. V1.3's 3-station conveyor design." },
        { relatedAssetId: "ce-module-assembly-v1", kind: "lineage-predecessor", description: "Module Assembly V1 reuses this cell's constants verbatim, extending the crane's range." },
      ],
      recoveryDocPath: `${RECOVERY_DIR}/CE_Integrated_Cell_V2_6.md`,
    },
    source: { repository: SIM_REPO, path: "simulations/Integrated-_Cell_V2_6-/CE_Integrated_Cell_V2_6.py", immutable: false },
    visualization: {
      currentRenderer: "matplotlib",
      migrationClass: "A",
      migrationNotes: "Robot/OverheadCrane/CellState/World classes present, same pattern as the pilot.",
      pyvista: { status: "verified", engineFile: "v2_6_engine.py", rendererFile: "v2_6_render.py", verifiedBy: "3000 real steps; rendered output showed all 4 station robots (F1/F2/S1/S2) and real placed members on the fixed table." },
    },
    verification: { engineeringRecoveryStatus: "recovered", runtimeStatus: "runnable-headless", liveTwinCorrelation: "shared-coordinate-space", knownLimitations: ["Docstring claims 90-degree tilt; actual code and later V3_0-6 both confirm 60 degrees is correct"] },
  },
  {
    id: "ce-module-assembly-v1",
    name: "Module Assembly -- 4-Wall Box (V1.0)",
    category: "module-assembly",
    library: "robot",
    status: "not_ready",
    immutable: false,
    engineering: {
      geometry: { summary: "Same wall-manufacturing cell as V2.6; crane range extended to a Module Assembly Jig where 4 sequential panels are delivered to NORTH/SOUTH/EAST/WEST faces of a closed 4x4 module." },
      behavior: { processFlow: "Panel 1->NORTH, Panel 2->SOUTH, Panel 3->EAST, Panel 4->WEST (closes the module) -> crane parks -> cycle resets." },
      relationships: [{ relatedAssetId: "ce-integrated-cell-v2-6", kind: "lineage-predecessor", description: "Stage-1 wall cell constants copied verbatim; this file adds Stage 2 (module assembly)." }],
      recoveryDocPath: `${RECOVERY_DIR}/CE_Module_Assembly_V1.md`,
    },
    source: { repository: SIM_REPO, path: "simulations/Module_Assembly_V1/CE_Module_Assembly_V1.py", immutable: false },
    visualization: {
      currentRenderer: "matplotlib",
      migrationClass: "A",
      migrationNotes: "Robot/OverheadCrane/WallCellState/ModuleState/World classes present, same pattern as the pilot.",
      pyvista: { status: "verified", engineFile: "module_assembly_engine.py", rendererFile: "module_assembly_render.py", verifiedBy: "6000 real steps; rendered output showed 1 of 4 module panels (NORTH) actually placed and the crane positioned at the module jig." },
    },
    verification: { engineeringRecoveryStatus: "recovered", runtimeStatus: "runnable-headless", liveTwinCorrelation: "shared-coordinate-space", knownLimitations: [] },
  },
  {
    id: "ce-rail-system-v1",
    name: "CR6 Dual Rail System (V1.0)",
    category: "rail-system",
    library: "robot",
    status: "not_ready",
    immutable: false,
    engineering: {
      geometry: { summary: "Two rails (A/B), 2 robots each, named A1/A2/B1/B2 -- 4 ATC tool-change racks (3 tiers x 5 tools = 15 positions each, 60 total)." },
      behavior: { stateSequence: ["PARKED_AT_ATC", "TRAVELING_TO_WORK", "WORKING", "TRAVELING_TO_ATC", "AT_ATC", "TOOL_CHANGE", "PARKED_AT_ATC"] },
      relationships: [{ relatedAssetId: "ce-integrated-cell-v3-0-6", kind: "live-twin-correlation", description: "Robot names A1/A2/B1/B2 and the PARKED_AT_ATC-only-rest-state model match the live production Digital Twin exactly -- HIGH correlation, not proven parameter-for-parameter equivalence." }],
      recoveryDocPath: `${RECOVERY_DIR}/CE_Rail_System_V1.md`,
    },
    source: { repository: SIM_REPO, path: "simulations/Rail_System_V1/CE_Rail_System_V1.py", lineage: "Reference: Chappell Robotics CR6 Rail System finalized render (June 2026).", immutable: false },
    visualization: {
      currentRenderer: "matplotlib",
      migrationClass: "A",
      migrationNotes: "CR6Robot/RailWorld classes present; update() verified as ax.clear() -> world.step() -> draw, same pattern as the pilot.",
      pyvista: { status: "verified", engineFile: "rail_system_engine.py", rendererFile: "rail_system_render.py", verifiedBy: "600 real steps; rendered output showed all 4 robots (A1/A2/B1/B2) at correct WORKING positions on either side of the table jig." },
    },
    verification: { engineeringRecoveryStatus: "recovered", runtimeStatus: "runnable-headless", liveTwinCorrelation: "shared-robot-identity", knownLimitations: ["Not yet diffed parameter-by-parameter against the live twin"] },
  },
  {
    id: "ce-integrated-cell-v1-3",
    name: "Integrated Wall Cell (V1.0 / earliest)",
    category: "integrated-cell",
    library: "robot",
    status: "not_ready",
    immutable: false,
    engineering: {
      geometry: { summary: "Earliest integrated-cell version: 3 stations (framing -> sheathing -> rail inspection), conveyor transfer, no tilt table or crane." },
      behavior: { processFlow: "STUD_ON_RACK->STUD_HELD_F1->STUD_ON_TABLE->FRAME_ASSEMBLING->FRAME_DONE; FRAME_DONE->FRAME_CONVEYING->FRAME_AT_SHEATHING; SHEET_ON_MAG->SHEET_HELD_S1->SHEET_ON_FRAME->WALL_FASTENING->WALL_DONE; WALL_DONE->RAIL_INSPECTING->WALL_COMPLETE" },
      relationships: [{ relatedAssetId: "ce-integrated-cell-v2-6", kind: "lineage-predecessor", description: "V2.6 adds a 4th station, roller transfer, and crane outfeed on top of this design." }],
      recoveryDocPath: `${RECOVERY_DIR}/CE_Integrated_Cell_V1_3.md`,
    },
    source: { repository: SIM_REPO, path: "simulations/CE_Intergrated_Cell_V1_3/CE_Integrated_Cell_V1_3.py", lineage: "Directory named V1_3, docstring says V1.0 -- unresolved naming inconsistency in the source.", immutable: false },
    visualization: {
      currentRenderer: "matplotlib",
      migrationClass: "A",
      migrationNotes: "Robot/FactoryRail/CellState/World classes present, same pattern as the pilot.",
      pyvista: { status: "verified", engineFile: "v1_3_engine.py", rendererFile: "v1_3_render.py", verifiedBy: "3000 real steps; rendered output showed all 5 robots including the rail-mounted inspection robot (RR) at the correct rail position." },
    },
    verification: { engineeringRecoveryStatus: "recovered", runtimeStatus: "runnable-headless", liveTwinCorrelation: "none", knownLimitations: ["Most granular ownership-chain documentation of any file -- 4 separate tracked sub-processes"] },
  },
  {
    id: "ce-integrated-cell-v3-0-6",
    name: "Integrated Cell -- Live Digital Twin Backbone (V3.0-6)",
    category: "integrated-cell",
    library: "robot",
    status: "protected-reference",
    immutable: true,
    engineering: {
      geometry: { summary: "Culmination of the wall-cell lineage: all 4 subsystems integrated (Rail, Roller, Tilt, Gantry) with an explicit inter-subsystem trigger chain. This is the module the live Factory Runtime actually loads in production." },
      behavior: {
        processFlow: "Rail WORKING complete -> Roller RECEIVING -> Roller DELIVERED -> Tilt TILTING_UP -> Tilt HELD_AT_60 -> Gantry activate -> Gantry PARKED -> Rail next cycle.",
      },
      interfaces: [
        { name: "Rail -> Roller trigger", description: "Rail subsystem completing a work cycle triggers the Roller subsystem to begin receiving." },
        { name: "Roller -> Tilt trigger", description: "Roller delivery completion triggers the Tilt subsystem to begin tilting up." },
        { name: "Tilt -> Gantry trigger", description: "Tilt reaching HELD_AT_60 triggers the Gantry to begin its pickup travel." },
      ],
      relationships: [
        { relatedAssetId: "ce-module-assembly-v1", kind: "lineage-successor", description: "Final integration point of the wall-cell lineage that V1.3/V2.6/Module_Assembly_V1 build toward." },
        { relatedAssetId: "ce-rail-system-v1", kind: "live-twin-correlation", description: "Shares robot identities A1/A2/B1/B2 with this file's own IntegratedCell.__init__." },
      ],
      recoveryDocPath: `${RECOVERY_DIR}/CE_Integrated_Cell_V3_0-6.md`,
    },
    source: {
      repository: "ConstructionEnterprise/Construction_Enterprises",
      path: "Chappell_Robotics/CE_Integrated_Cell_V3_0-6.py",
      lineage: "Live, actively-developed backbone of the production Digital Twin (real recent commits: trajectory planner, rail work-target reservation fix, rack redesign). A separate, already-diverged archived snapshot also exists at simulations-/simulations/CE_Intergrated_Cell_V1_3/ -- different SHA-256, not interchangeable.",
      immutable: true,
    },
    visualization: {
      currentRenderer: "matplotlib",
      migrationClass: "D",
      migrationNotes: "Outside classification. Never migrate, convert, or modify -- this entry exists in the library for reference only.",
      pyvista: { status: "not-migrated", verifiedBy: "N/A -- protected source, no migration attempted or planned. All 11 other simulations have a verified PyVista path; this one deliberately does not." },
    },
    verification: {
      engineeringRecoveryStatus: "recovered",
      runtimeStatus: "not-assessed",
      liveTwinCorrelation: "is-the-live-twin",
      knownLimitations: [
        "Two of its four named subsystem sources (CE_TableJig_Tilt_V1.py, CE_TableJig_Roller_V1.py) do not exist anywhere as separate archived files -- their logic only survives embedded here",
        "This record describes the archived reference copy's content; the live copy has since diverged (different hash, active commit history) and was never opened for reading or writing during this recovery pass",
      ],
    },
  },
];
