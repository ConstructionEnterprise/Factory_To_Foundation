import { Line } from "@react-three/drei";

import { robotJointPoints } from "./twinKinematics";
import { TOOL_COLOR_CYCLE, toThree, type Vec3 } from "./twinGeometryConstants";
import type { Quat6 } from "./useTwinState";

/**
 * The one real robot-arm renderer, shared by Factory's full-cell viewport
 * and Robotics' isolated per-robot viewport — one copy so the two tabs
 * can NEVER show different articulations for the same live q. Pure
 * geometry driven entirely by real inputs: joint positions come from the
 * twin's own DH forward kinematics (robotJointPoints), segment weights
 * and the tool-color cycle are ported from the twin's own draw_robot().
 *
 * `base` is [railX, railY, 0]. Factory passes the robot's real live rail
 * position; Robotics passes [0,0] to inspect the same real articulation
 * centered in the robot's own base frame (rail position shown separately
 * as a real value, never hidden).
 */

// Cosmetic rail-mounted base riser height only — not part of the real DH
// chain (whose origin is z=0), matching the twin's own draw_robot() base_z.
const ROBOT_BASE_Z = 0.06 + 0.14 + 0.14 + 0.14;

// Per-segment width/color, matching the twin's own new draw_robot()
// (ported from CR6_V8_0_Dual_Robot_Cell.py's rendering template).
const SEGMENT_WIDTH = [8, 7, 7, 5, 5, 4];
const SEGMENT_COLOR = ["#DDDDDD", "#DDDDDD", "#CCCCCC", "#CCCCCC", "#CC5500", "#CC5500"];

export function RobotArm({
  q,
  railX,
  railY,
  toolIdx,
}: {
  q: Quat6;
  railX: number;
  railY: number;
  toolIdx: number;
}) {
  const base: Vec3 = [railX, railY, 0];
  const pts = robotJointPoints(q, base);
  const toolColor = TOOL_COLOR_CYCLE[toolIdx % 5];
  const tip = pts[pts.length - 1];
  const [bx, by, bz] = toThree(railX, railY, ROBOT_BASE_Z);

  return (
    <>
      <mesh position={[bx, by, bz]}>
        {/* half [0.18,0.18,0.14] -> toThree swaps y/z, so args = [2*hw, 2*hh, 2*hd]. */}
        <boxGeometry args={[0.36, 0.28, 0.36]} />
        <meshStandardMaterial color="#CCCCCC" />
      </mesh>
      {pts.slice(0, -1).map((p, i) => (
        <Line key={i} points={[toThree(...p), toThree(...pts[i + 1])]} color={SEGMENT_COLOR[i]} lineWidth={SEGMENT_WIDTH[i]} />
      ))}
      {pts.map((p, i) => (
        <mesh key={`j${i}`} position={toThree(...p)}>
          <sphereGeometry args={[0.045, 12, 12]} />
          <meshStandardMaterial color="white" />
        </mesh>
      ))}
      <mesh position={toThree(...tip)}>
        <sphereGeometry args={[0.08, 16, 16]} />
        <meshStandardMaterial color={toolColor} />
      </mesh>
    </>
  );
}
