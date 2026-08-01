import { useLayoutEffect, useRef } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, PerspectiveCamera } from "@react-three/drei";
import * as THREE from "three";

import { PanelCard } from "@/framework/ui";
import { useSelection } from "@/context/SelectionContext";
import { useTwinState } from "@/features/factory/useTwinState";
import { RobotArm } from "@/features/factory/RobotArm";

import { ROBOT_NAMES, type RobotName } from "../roboticsData";

/**
 * Isolated single-robot 3D viewport — one robot at a time, its real live
 * pose driven by the same twinKinematics forward kinematics (via the
 * shared RobotArm) that renders Factory's full-cell viewport, so the two
 * tabs can't disagree about the same q. Independent Canvas/OrbitControls
 * from Factory's — this is a dedicated inspection view, not a slice of the
 * other one.
 *
 * Rendered in the robot's own base frame (rail translation removed) so the
 * arm stays centered while you orbit it; the real rail position is shown
 * as a value in the Inspector, never hidden by the centering.
 */
const TARGET: [number, number, number] = [0, 2, 0];
const EYE: [number, number, number] = [6, 5, 7];

function IsolatedCamera() {
  const camRef = useRef<THREE.PerspectiveCamera>(null);
  useLayoutEffect(() => {
    camRef.current?.position.set(...EYE);
    camRef.current?.lookAt(...TARGET);
  }, []);
  return <PerspectiveCamera ref={camRef} makeDefault fov={45} near={0.1} far={100} />;
}

export default function RoboticsLayout() {
  const { selected } = useSelection();
  const { connected, state } = useTwinState();

  const selectedRobot: RobotName =
    (selected?.feature === "robotics" ? (selected.payload.robotName as RobotName) : undefined) ?? ROBOT_NAMES[0];
  const robot = state ? state.robots[selectedRobot] : undefined;

  return (
    <PanelCard title="Isolated Robot — Live Pose" className="h-full" bodyClassName="flex flex-col flex-1">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100">
        <span className="text-sm font-semibold" style={{ color: "var(--ff-text-primary)" }}>
          Robot {selectedRobot}
        </span>
        {robot && (
          <span className="text-xs" style={{ color: "var(--ff-text-muted)" }}>
            {robot.state}
          </span>
        )}
        <span
          className="ml-auto rounded-full px-2.5 py-0.5 text-xs font-medium"
          style={
            connected
              ? { background: "var(--ff-status-positive)", color: "white" }
              : { background: "var(--ff-chrome-bg)", color: "var(--ff-text-muted)" }
          }
        >
          {connected ? "Live Pose" : "Twin Offline"}
        </span>
      </div>

      <div className="relative flex-1" style={{ background: "var(--ff-content-bg)" }}>
        <Canvas>
          <ambientLight intensity={0.7} />
          <directionalLight position={[10, 15, 8]} intensity={1.2} />
          <directionalLight position={[-8, 6, -6]} intensity={0.4} />
          <mesh position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[8, 8]} />
            <meshStandardMaterial color="#EFEFEF" transparent opacity={0.35} side={THREE.DoubleSide} />
          </mesh>
          {robot && <RobotArm q={robot.q} railX={0} railY={0} toolIdx={robot.tool_idx} />}
          <IsolatedCamera />
          <OrbitControls makeDefault enableDamping dampingFactor={0.08} target={TARGET} />
        </Canvas>

        {!robot && (
          <div
            className="absolute inset-0 flex items-center justify-center text-sm"
            style={{ color: "var(--ff-text-muted)" }}
          >
            No live pose — start the twin and twin-bridge to watch Robot {selectedRobot} animate in real time.
          </div>
        )}

        <p
          className="absolute bottom-2 left-3 rounded px-2 py-1 text-[0.65rem]"
          style={{ background: "var(--ff-chrome-bg)", color: "var(--ff-text-muted)" }}
        >
          Real live joint angles from the twin's DH kinematics, shown in the robot's own base frame. Same q as
          Factory's viewport; rail position is a separate real value in the Inspector.
        </p>
      </div>
    </PanelCard>
  );
}
