import { useEffect, useState, type FormEvent } from "react";

import { usePermission } from "@/context/AuthContext";
import { constructionProjects } from "@/features/construction/constructionData";

import {
  createDispatch,
  createDriver,
  createTruck,
  listDrivers,
  listTrucks,
  type LogisticsDriver,
  type LogisticsTruck,
} from "../logisticsOperationsApi";

type LogisticsDispatchFormProps = {
  onClose: () => void;
  /** Called once a real dispatch is actually created — lets the caller refresh whatever list it's showing. */
  onCreated: () => void;
};

const NEW_OPTION = "__new__";

/**
 * Real Dispatch-creation form — closes the gap Phase 5 flagged: Phase 4
 * shipped the real Truck/Driver/Dispatch schema but no way to create any of
 * them, so there was nothing a real user could actually do with it.
 *
 * PROVISIONAL MOUNT POINT: rendered as a modal from LogisticsToolbar/
 * LogisticsPage, not a real panel of its own — Phase 8's real Browse
 * Logistics panel (Dispatches nested under Transportation) hasn't been
 * built yet, and this form is understood to be superseded once it lands,
 * not a permanent second UI. Kept deliberately minimal for that reason.
 *
 * Real Truck/Driver picker: both ship genuinely empty per Phase 4's honest-
 * scaffolding decision, so this form lets a user pick a real existing one
 * OR create a real new one inline (a plain identifier/name field, POSTed
 * for real before the dispatch itself is submitted) — never a fabricated
 * placeholder row. Destination is the real ConstructionProject list
 * (`constructionData.ts`'s `constructionProjects`, the same real fixture
 * array Construction's own map/documents UI already uses), not a
 * hardcoded/duplicated list.
 */
export default function LogisticsDispatchForm({ onClose, onCreated }: LogisticsDispatchFormProps) {
  const createPermission = usePermission("logistics", "create");

  const [trucks, setTrucks] = useState<LogisticsTruck[] | null>(null);
  const [drivers, setDrivers] = useState<LogisticsDriver[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [truckId, setTruckId] = useState<string>(NEW_OPTION);
  const [newTruckIdentifier, setNewTruckIdentifier] = useState("");
  const [driverId, setDriverId] = useState<string>(NEW_OPTION);
  const [newDriverName, setNewDriverName] = useState("");

  const [destinationProjectId, setDestinationProjectId] = useState("");
  const [eta, setEta] = useState("");
  const [route, setRoute] = useState("");
  const [traffic, setTraffic] = useState("");
  const [odometerStart, setOdometerStart] = useState("");
  const [businessPurpose, setBusinessPurpose] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([listTrucks(), listDrivers()])
      .then(([truckRows, driverRows]) => {
        setTrucks(truckRows);
        setDrivers(driverRows);
        // Real, honest default: only pre-select an existing row once real
        // rows exist — otherwise leave "+ New" selected, since there's
        // nothing else to pick.
        if (truckRows.length > 0) setTruckId(truckRows[0].id);
        if (driverRows.length > 0) setDriverId(driverRows[0].id);
      })
      .catch((err) => setLoadError(err instanceof Error ? err.message : String(err)));
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitError(null);
    setSubmitting(true);
    try {
      let resolvedTruckId = truckId;
      if (truckId === NEW_OPTION) {
        if (!newTruckIdentifier.trim()) throw new Error("Enter a truck identifier, or pick an existing truck.");
        const created = await createTruck(newTruckIdentifier.trim());
        resolvedTruckId = created.id;
      }

      let resolvedDriverId = driverId;
      if (driverId === NEW_OPTION) {
        if (!newDriverName.trim()) throw new Error("Enter a driver name, or pick an existing driver.");
        const created = await createDriver(newDriverName.trim());
        resolvedDriverId = created.id;
      }

      if (!destinationProjectId) throw new Error("Choose a destination project.");

      const trimmedOdometerStart = odometerStart.trim();
      if (trimmedOdometerStart && Number(trimmedOdometerStart) < 0) {
        throw new Error("Starting odometer reading can't be negative.");
      }

      await createDispatch({
        truckId: resolvedTruckId,
        driverId: resolvedDriverId,
        destinationProjectId,
        eta: eta ? new Date(eta).toISOString() : undefined,
        route: route.trim() || undefined,
        traffic: traffic.trim() || undefined,
        odometerStart: trimmedOdometerStart ? Number(trimmedOdometerStart) : undefined,
        businessPurpose: businessPurpose.trim() || undefined,
      });

      onCreated();
      onClose();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="w-full max-w-md max-h-[85vh] overflow-y-auto rounded-md p-6 shadow-xl"
        style={{ background: "var(--ff-content-bg)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-lg font-bold" style={{ color: "var(--ff-text-primary)" }}>
            New Dispatch
          </h2>
          <button type="button" onClick={onClose} className="text-sm" style={{ color: "var(--ff-text-muted)" }}>
            ✕
          </button>
        </div>
        <p className="mb-4 text-[0.7rem]" style={{ color: "var(--ff-text-muted)" }}>
          Provisional entry point — creates a real Truck/Driver/Dispatch row. Superseded once the real Browse Logistics
          panel (Phase 8) lands.
        </p>

        {loadError && (
          <p className="mb-3 text-xs" style={{ color: "var(--ff-status-critical)" }}>
            Couldn't load existing trucks/drivers ({loadError}) — you can still create new ones below.
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium" style={{ color: "var(--ff-text-secondary)" }}>
              Truck
            </label>
            <select
              className="w-full rounded border px-2 py-1.5 text-sm"
              value={truckId}
              onChange={(e) => setTruckId(e.target.value)}
            >
              {(trucks ?? []).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.identifier}
                </option>
              ))}
              <option value={NEW_OPTION}>+ New truck…</option>
            </select>
            {truckId === NEW_OPTION && (
              <input
                type="text"
                placeholder="Truck identifier (e.g. TRL-118)"
                className="mt-1.5 w-full rounded border px-2 py-1.5 text-sm"
                value={newTruckIdentifier}
                onChange={(e) => setNewTruckIdentifier(e.target.value)}
              />
            )}
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium" style={{ color: "var(--ff-text-secondary)" }}>
              Driver
            </label>
            <select
              className="w-full rounded border px-2 py-1.5 text-sm"
              value={driverId}
              onChange={(e) => setDriverId(e.target.value)}
            >
              {(drivers ?? []).map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
              <option value={NEW_OPTION}>+ New driver…</option>
            </select>
            {driverId === NEW_OPTION && (
              <input
                type="text"
                placeholder="Driver name"
                className="mt-1.5 w-full rounded border px-2 py-1.5 text-sm"
                value={newDriverName}
                onChange={(e) => setNewDriverName(e.target.value)}
              />
            )}
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium" style={{ color: "var(--ff-text-secondary)" }}>
              Destination
            </label>
            <select
              required
              className="w-full rounded border px-2 py-1.5 text-sm"
              value={destinationProjectId}
              onChange={(e) => setDestinationProjectId(e.target.value)}
            >
              <option value="" disabled>
                Choose a real construction project…
              </option>
              {constructionProjects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium" style={{ color: "var(--ff-text-secondary)" }}>
              ETA <span style={{ color: "var(--ff-text-muted)" }}>(optional)</span>
            </label>
            <input
              type="datetime-local"
              className="w-full rounded border px-2 py-1.5 text-sm"
              value={eta}
              onChange={(e) => setEta(e.target.value)}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium" style={{ color: "var(--ff-text-secondary)" }}>
              Route <span style={{ color: "var(--ff-text-muted)" }}>(free text, optional — no real routing data exists)</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Route 45, Mile 12"
              className="w-full rounded border px-2 py-1.5 text-sm"
              value={route}
              onChange={(e) => setRoute(e.target.value)}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium" style={{ color: "var(--ff-text-secondary)" }}>
              Traffic <span style={{ color: "var(--ff-text-muted)" }}>(placeholder field — not a live traffic feed)</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Light"
              className="w-full rounded border px-2 py-1.5 text-sm"
              value={traffic}
              onChange={(e) => setTraffic(e.target.value)}
            />
          </div>

          <div className="border-t pt-3" style={{ borderColor: "var(--ff-panel-border)" }}>
            <p className="mb-2 text-[0.65rem]" style={{ color: "var(--ff-text-muted)" }}>
              Mileage tracking (optional here — record the ending reading later from Track Dispatches once the haul
              is complete). Real, odometer-based: no route-distance estimate exists yet.
            </p>
            <label className="mb-1 block text-xs font-medium" style={{ color: "var(--ff-text-secondary)" }}>
              Starting Odometer <span style={{ color: "var(--ff-text-muted)" }}>(optional)</span>
            </label>
            <input
              type="number"
              min="0"
              step="any"
              placeholder="e.g. 84213"
              className="w-full rounded border px-2 py-1.5 text-sm"
              value={odometerStart}
              onChange={(e) => setOdometerStart(e.target.value)}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium" style={{ color: "var(--ff-text-secondary)" }}>
              Business Purpose <span style={{ color: "var(--ff-text-muted)" }}>(optional — required for IRS Pub. 463 recordkeeping)</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Module delivery — Cedarwood Flats"
              className="w-full rounded border px-2 py-1.5 text-sm"
              value={businessPurpose}
              onChange={(e) => setBusinessPurpose(e.target.value)}
            />
          </div>

          {submitError && (
            <p className="text-xs" style={{ color: "var(--ff-status-critical)" }}>
              {submitError}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="rounded px-3 py-1.5 text-sm" style={{ color: "var(--ff-text-secondary)" }}>
              Cancel
            </button>
            <button
              type="submit"
              disabled={!createPermission.allowed || submitting}
              title={createPermission.reason}
              className="rounded px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
              style={{ background: "var(--ff-accent)" }}
            >
              {submitting ? "Creating…" : "Create Dispatch"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
