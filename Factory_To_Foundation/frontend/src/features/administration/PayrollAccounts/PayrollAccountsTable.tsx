import { useEffect, useState } from "react";

import { PanelCard, ToolbarButton, ToolbarInput, ToolbarSelect } from "@/framework/ui";
import { usePermission } from "@/context/AuthContext";
import { listUsers, USERS_CHANGED_EVENT, type ManagedUser } from "@/features/permissions/userManagementApi";
import * as api from "../payrollAccountsApi";
import type { PayFrequency, PayrollAccount, PayType } from "../payrollAccountsApi";

const PAY_FREQUENCY_LABEL: Record<PayFrequency, string> = {
  WEEKLY: "Weekly",
  BIWEEKLY: "Biweekly",
  SEMIMONTHLY: "Semimonthly",
  MONTHLY: "Monthly",
};

function formatRate(account: PayrollAccount): string {
  if (account.payType === "HOURLY") return `$${account.hourlyRate?.toFixed(2)}/hr`;
  return `$${account.annualSalary?.toLocaleString(undefined, { maximumFractionDigits: 0 })}/yr`;
}

/**
 * Real Payroll Accounts (Administration rebuild, 2026-08-18) — real CRUD
 * against backend/src/routes/payrollAccounts.ts. Accounts are created FROM
 * an existing real User profile (the same directory Permissions' User
 * Management owns, reused here via listUsers()) — there's no separate
 * "add employee" form; only real profiles that don't already have a real
 * payroll account are offered. Deliberately scoped to real pay-profile
 * fields only (rate/frequency/status) — no paycheck or withholding
 * calculation, since this app has no real tax-table data to compute
 * against honestly.
 */
export default function PayrollAccountsTable() {
  const [accounts, setAccounts] = useState<PayrollAccount[] | null>(null);
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const createPermission = usePermission("administration", "create");
  const updatePermission = usePermission("administration", "update");

  function reload() {
    setError(null);
    Promise.all([api.listPayrollAccounts(), listUsers()])
      .then(([accountRows, userRows]) => {
        setAccounts(accountRows);
        setUsers(userRows);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load payroll accounts"));
  }

  useEffect(() => {
    reload();
    // Real fix for the same stale-panel bug class scheduleTasksApi.ts's own
    // doc comment describes: User Management now lives right above this
    // panel on the same Administration page, so a real create/edit/delete
    // there should update this panel's eligible-user list without a manual
    // reload.
    window.addEventListener(USERS_CHANGED_EVENT, reload);
    return () => window.removeEventListener(USERS_CHANGED_EVENT, reload);
  }, []);

  const eligibleUsers = users.filter((u) => !accounts?.some((a) => a.userId === u.id));

  return (
    <PanelCard
      title={`Payroll Accounts — ${accounts?.length ?? "…"} Real Accounts`}
      toolbar={
        <ToolbarButton
          disabled={!createPermission.allowed}
          title={createPermission.reason}
          onClick={() => setCreating((c) => !c)}
        >
          {creating ? "Cancel" : "+ New Payroll Account"}
        </ToolbarButton>
      }
    >
      {error && (
        <p className="mb-2 text-sm" style={{ color: "var(--ff-status-critical)" }}>
          {error}
        </p>
      )}

      {creating && (
        <CreatePayrollAccountForm
          eligibleUsers={eligibleUsers}
          onCreated={() => {
            setCreating(false);
            reload();
          }}
          onError={setError}
        />
      )}

      {!accounts ? (
        <p className="text-sm" style={{ color: "var(--ff-text-muted)" }}>
          Loading real accounts…
        </p>
      ) : accounts.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--ff-text-muted)" }}>
          No real payroll accounts yet — create one from an existing profile above.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr style={{ borderBottom: "2px solid var(--ff-panel-border)" }}>
                {["Employee", "Role", "Pay Type", "Rate", "Frequency", "Status", "Actions"].map((h) => (
                  <th key={h} className="py-2 pr-4 text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--ff-text-muted)" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {accounts.map((a) => (
                <PayrollAccountRow
                  key={a.id}
                  account={a}
                  editing={editingId === a.id}
                  onStartEdit={() => setEditingId(a.id)}
                  onCancelEdit={() => setEditingId(null)}
                  updatePermission={updatePermission}
                  onChanged={() => {
                    setEditingId(null);
                    reload();
                  }}
                  onError={setError}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </PanelCard>
  );
}

function CreatePayrollAccountForm({
  eligibleUsers,
  onCreated,
  onError,
}: {
  eligibleUsers: ManagedUser[];
  onCreated: () => void;
  onError: (msg: string) => void;
}) {
  const [userId, setUserId] = useState(eligibleUsers[0]?.id ?? "");
  const [payType, setPayType] = useState<PayType>("HOURLY");
  const [rate, setRate] = useState("");
  const [payFrequency, setPayFrequency] = useState<PayFrequency>("BIWEEKLY");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) {
      onError("No eligible profile selected — every real profile already has a payroll account.");
      return;
    }
    const numericRate = Number(rate);
    if (!Number.isFinite(numericRate) || numericRate <= 0) {
      onError("Enter a real positive rate.");
      return;
    }
    setSubmitting(true);
    try {
      await api.createPayrollAccount({
        userId,
        payType,
        hourlyRate: payType === "HOURLY" ? numericRate : null,
        annualSalary: payType === "SALARY" ? numericRate : null,
        payFrequency,
      });
      onCreated();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Failed to create payroll account");
    } finally {
      setSubmitting(false);
    }
  }

  if (eligibleUsers.length === 0) {
    return (
      <p className="mb-4 text-sm" style={{ color: "var(--ff-text-muted)" }}>
        Every real profile in Permissions already has a payroll account. Add a new profile there first.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mb-4 flex flex-wrap items-end gap-2 rounded-[0.2rem] p-3" style={{ border: "1px solid var(--ff-panel-border)" }}>
      <ToolbarSelect value={userId} onChange={(e) => setUserId(e.target.value)}>
        {eligibleUsers.map((u) => (
          <option key={u.id} value={u.id}>
            {u.displayName} ({u.email})
          </option>
        ))}
      </ToolbarSelect>
      <ToolbarSelect value={payType} onChange={(e) => setPayType(e.target.value as PayType)}>
        <option value="HOURLY">Hourly</option>
        <option value="SALARY">Salary</option>
      </ToolbarSelect>
      <ToolbarInput
        required
        type="number"
        min="0.01"
        step="0.01"
        placeholder={payType === "HOURLY" ? "Rate ($/hr)" : "Salary ($/yr)"}
        value={rate}
        onChange={(e) => setRate(e.target.value)}
      />
      <ToolbarSelect value={payFrequency} onChange={(e) => setPayFrequency(e.target.value as PayFrequency)}>
        {(Object.keys(PAY_FREQUENCY_LABEL) as PayFrequency[]).map((f) => (
          <option key={f} value={f}>
            {PAY_FREQUENCY_LABEL[f]}
          </option>
        ))}
      </ToolbarSelect>
      <ToolbarButton type="submit" disabled={submitting}>
        {submitting ? "Creating…" : "Create"}
      </ToolbarButton>
    </form>
  );
}

function PayrollAccountRow({
  account,
  editing,
  onStartEdit,
  onCancelEdit,
  updatePermission,
  onChanged,
  onError,
}: {
  account: PayrollAccount;
  editing: boolean;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  updatePermission: { allowed: boolean; reason: string | undefined };
  onChanged: () => void;
  onError: (msg: string) => void;
}) {
  const [rate, setRate] = useState(String(account.payType === "HOURLY" ? account.hourlyRate : account.annualSalary));
  const [payFrequency, setPayFrequency] = useState<PayFrequency>(account.payFrequency);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    const numericRate = Number(rate);
    if (!Number.isFinite(numericRate) || numericRate <= 0) {
      onError("Enter a real positive rate.");
      return;
    }
    setSaving(true);
    try {
      await api.updatePayrollAccount(account.id, {
        hourlyRate: account.payType === "HOURLY" ? numericRate : null,
        annualSalary: account.payType === "SALARY" ? numericRate : null,
        payFrequency,
      });
      onChanged();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Failed to update payroll account");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleStatus() {
    try {
      await api.updatePayrollAccount(account.id, { status: account.status === "ACTIVE" ? "INACTIVE" : "ACTIVE" });
      onChanged();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Failed to update payroll account");
    }
  }

  return (
    <tr style={{ borderBottom: "1px solid var(--ff-content-bg)" }}>
      <td className="py-2 pr-4">
        <div style={{ color: "var(--ff-text-primary)" }}>{account.userDisplayName}</div>
        <div className="text-xs" style={{ color: "var(--ff-text-muted)" }}>{account.userEmail}</div>
      </td>
      <td className="py-2 pr-4" style={{ color: "var(--ff-text-primary)" }}>{account.roleName}</td>
      <td className="py-2 pr-4" style={{ color: "var(--ff-text-primary)" }}>{account.payType === "HOURLY" ? "Hourly" : "Salary"}</td>
      <td className="py-2 pr-4">
        {editing ? (
          <ToolbarInput type="number" min="0.01" step="0.01" value={rate} onChange={(e) => setRate(e.target.value)} />
        ) : (
          <span style={{ color: "var(--ff-text-primary)" }}>{formatRate(account)}</span>
        )}
      </td>
      <td className="py-2 pr-4">
        {editing ? (
          <ToolbarSelect value={payFrequency} onChange={(e) => setPayFrequency(e.target.value as PayFrequency)}>
            {(Object.keys(PAY_FREQUENCY_LABEL) as PayFrequency[]).map((f) => (
              <option key={f} value={f}>
                {PAY_FREQUENCY_LABEL[f]}
              </option>
            ))}
          </ToolbarSelect>
        ) : (
          <span style={{ color: "var(--ff-text-primary)" }}>{PAY_FREQUENCY_LABEL[account.payFrequency]}</span>
        )}
      </td>
      <td className="py-2 pr-4">
        <span style={{ color: account.status === "ACTIVE" ? "var(--ff-status-positive)" : "var(--ff-text-muted)" }}>
          {account.status === "ACTIVE" ? "Active" : "Inactive"}
        </span>
      </td>
      <td className="py-2">
        {editing ? (
          <div className="flex gap-2">
            <ToolbarButton onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </ToolbarButton>
            <ToolbarButton onClick={onCancelEdit}>Cancel</ToolbarButton>
          </div>
        ) : (
          <div className="flex gap-2">
            <ToolbarButton disabled={!updatePermission.allowed} title={updatePermission.reason} onClick={onStartEdit}>
              Edit
            </ToolbarButton>
            <ToolbarButton disabled={!updatePermission.allowed} title={updatePermission.reason} onClick={handleToggleStatus}>
              {account.status === "ACTIVE" ? "Deactivate" : "Activate"}
            </ToolbarButton>
          </div>
        )}
      </td>
    </tr>
  );
}
