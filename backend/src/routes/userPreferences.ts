import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { authenticate } from "../middleware/auth";
import * as service from "../services/userPreferenceService";

const workspaceSchema = z.object({
  savePanelPositions: z.boolean(),
  snapPanels: z.boolean(),
  floatingWindows: z.boolean(),
  defaultDashboard: z.string().nullable(),
  rememberOpenTabs: z.boolean(),
});

const appearanceSchema = z.object({
  theme: z.enum(["light", "dark"]),
  ceTheme: z.boolean(),
  fontSize: z.enum(["small", "medium", "large"]),
  compactMode: z.boolean(),
  uiAnimations: z.boolean(),
});

const notificationsSchema = z.object({
  desktopAlerts: z.boolean(),
  emailAlerts: z.boolean(),
  soundEffects: z.boolean(),
});

const accessibilitySchema = z.object({
  keyboardShortcuts: z.boolean(),
  highContrastMode: z.boolean(),
  screenScaling: z.number().min(75).max(150),
  reducedMotion: z.boolean(),
});

const preferencesSchema = z.object({
  defaultStartupPage: z.string().nullable(),
  autoSaveIntervalSec: z.number().int().positive(),
  dateTimeFormat: z.string().min(1),
  languageRegion: z.string().min(1),
});

const patchBodySchema = z.object({
  workspace: workspaceSchema.optional(),
  appearance: appearanceSchema.optional(),
  notifications: notificationsSchema.optional(),
  accessibility: accessibilitySchema.optional(),
  preferences: preferencesSchema.optional(),
});

/**
 * Real settings persistence (A2) — scoped to "my own preferences" only,
 * never another user's: both routes always operate on request.user!.id
 * (from `authenticate`), never a client-supplied userId. No
 * requirePermission beyond being signed in — a user's own Settings panel
 * isn't a module-grain RBAC concern the way Construction/Logistics writes
 * are.
 */
export async function userPreferenceRoutes(app: FastifyInstance) {
  app.get("/user-preferences", { preHandler: [authenticate] }, async (request) => {
    return service.getPreferences(request.user!.id);
  });

  app.patch("/user-preferences", { preHandler: [authenticate] }, async (request) => {
    const patch = patchBodySchema.parse(request.body);
    return service.updatePreferences(request.user!.id, patch);
  });
}
