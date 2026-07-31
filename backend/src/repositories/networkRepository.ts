import type { NetworkDevice, NetworkVlan } from "@prisma/client";

import { prisma } from "../lib/prisma";

export function findAllVlans(): Promise<NetworkVlan[]> {
  return prisma.networkVlan.findMany({ orderBy: { number: "asc" } });
}

export function findAllDevices(): Promise<NetworkDevice[]> {
  return prisma.networkDevice.findMany({ orderBy: { name: "asc" } });
}
