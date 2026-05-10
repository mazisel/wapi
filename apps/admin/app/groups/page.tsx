"use client";

import { useState, useCallback } from "react";
import useSWR from "swr";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/useAuth";

interface Device {
  id: string;
  name: string;
  status: string;
}

interface Group {
  jid: string;
  name: string;
  participant_count: number;
}

interface Monitor {
  id: string;
  device_id: string;
  group_jid: string;
  group_name: string | null;
  team_numbers: string[];
  alert_group_jids: string[];
  alert_contacts: string[];
  is_active: boolean;
  created_at: string;
}

const EMPTY_FORM = {
  device_id: "",
  group_jids: [] as string[],
  team_numbers: "",
  alert_group_jids: [] as string[],
  alert_contacts: "",
};

export default function GroupsPage() {
  useAuth();

  const { data: devices } = useSWR("/api/v1/devices", (p: string) =>
    apiFetch<{ devices: Device[] }>(p).then((d) => d.devices)
  );

  const {
    data: monitors,
    mutate: mutateMonitors,
  } = useSWR("/api/v1/group-monitors", (p: string) =>
    apiFetch<{ monitors: Monitor[] }>(p).then((d) => d.monitors)
  );

  const [form, setForm] = useState(EMPTY_FORM);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const { data: groups } = useSWR(
    form.device_id ? `/api/v1/devices/${form.device_id}/groups` : null,
    (p: string) => apiFetch<{ groups: Group[] }>(p).then((d) => d.groups)
  );

  const handleSave = useCallback(async () => {
    if (!form.device_id || form.group_jids.length === 0) {
      alert("Cihaz ve en az bir grup seçmek zorunludur.");
      return;
    }
    setSaving(true);
    try {
      const selectedGroups = form.group_jids.map((jid) => {
        const group = groups?.find((g) => g.jid === jid);
        return {
          group_jid: jid,
          group_name: group?.name,
        };
      });

      await apiFetch("/api/v1/group-monitors", {
        method: "POST",
        body: JSON.stringify({
          device_id: form.device_id,
          groups: selectedGroups,
          team_numbers: form.team_numbers
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          alert_group_jids: form.alert_group_jids,
          alert_contacts: form.alert_contacts
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
        }),
      });
      setForm(EMPTY_FORM);
      setShowForm(false);
      await mutateMonitors();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  }, [form, groups, mutateMonitors]);

  const toggleActive = useCallback(
    async (monitor: Monitor) => {
      await apiFetch(`/api/v1/group-monitors/${monitor.id}`, {
        method: "PUT",
        body: JSON.stringify({ is_active: !monitor.is_active }),
      });
      await mutateMonitors();
    },
    [mutateMonitors]
  );

  const deleteMonitor = useCallback(
    async (id: string) => {
      if (!confirm("Bu monitörü silmek istediğinizden emin misiniz?")) return;
      await apiFetch(`/api/v1/group-monitors/${id}`, { method: "DELETE" });
      await mutateMonitors();
    },
    [mutateMonitors]
  );

  const toggleAlertGroup = (jid: string) => {
    setForm((f) => ({
      ...f,
      alert_group_jids: f.alert_group_jids.includes(jid)
        ? f.alert_group_jids.filter((j) => j !== jid)
        : [...f.alert_group_jids, jid],
    }));
  };

  const toggleWatchedGroup = (jid: string) => {
    setForm((f) => ({
      ...f,
      group_jids: f.group_jids.includes(jid)
        ? f.group_jids.filter((j) => j !== jid)
        : [...f.group_jids, jid],
    }));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Grup İzleme & Uyarı Sistemi</h1>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
        >
          {showForm ? "Vazgeç" : "+ Yeni Monitör"}
        </button>
      </div>

      {showForm && (
        <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
          <h2 className="font-semibold text-gray-800">Yeni Grup Monitörü</h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Cihaz
            </label>
            <select
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              value={form.device_id}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  device_id: e.target.value,
                  group_jids: [],
                  alert_group_jids: [],
                }))
              }
            >
              <option value="">Cihaz seçin...</option>
              {(devices ?? []).map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.status})
                </option>
              ))}
            </select>
          </div>

          {form.device_id && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                İzlenecek Gruplar{" "}
                <span className="text-gray-400 font-normal">
                  ({form.group_jids.length} seçili)
                </span>
              </label>
              {!groups ? (
                <p className="text-sm text-gray-400">Gruplar yükleniyor...</p>
              ) : (
                <div className="space-y-1 max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-2">
                  {groups.map((g) => (
                    <label
                      key={g.jid}
                      className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50 px-2 py-1 rounded"
                    >
                      <input
                        type="checkbox"
                        checked={form.group_jids.includes(g.jid)}
                        onChange={() => toggleWatchedGroup(g.jid)}
                      />
                      <span className="flex-1">
                        {g.name}{" "}
                        <span className="text-gray-400">
                          ({g.participant_count} üye)
                        </span>
                      </span>
                    </label>
                  ))}
                  {groups.length === 0 && (
                    <p className="text-sm text-gray-400 px-2 py-1">
                      Bu cihaz için grup bulunamadı.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Ekip Numaraları{" "}
              <span className="text-gray-400 font-normal">(virgülle ayırın, E.164)</span>
            </label>
            <input
              type="text"
              placeholder="+905551111111, +905552222222"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              value={form.team_numbers}
              onChange={(e) => setForm((f) => ({ ...f, team_numbers: e.target.value }))}
            />
          </div>

          {form.device_id && groups && groups.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Uyarı Gönderilecek Gruplar{" "}
                <span className="text-gray-400 font-normal">(max 2 seçin)</span>
              </label>
              <div className="space-y-1 max-h-40 overflow-y-auto border border-gray-200 rounded-lg p-2">
                {groups.map((g) => (
                  <label key={g.jid} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50 px-2 py-1 rounded">
                    <input
                      type="checkbox"
                      checked={form.alert_group_jids.includes(g.jid)}
                      onChange={() => toggleAlertGroup(g.jid)}
                      disabled={
                        !form.alert_group_jids.includes(g.jid) &&
                        form.alert_group_jids.length >= 2
                      }
                    />
                    {g.name}
                  </label>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Kişisel Uyarı Kişileri{" "}
              <span className="text-gray-400 font-normal">(virgülle ayırın, E.164)</span>
            </label>
            <input
              type="text"
              placeholder="+905553333333, +905554444444"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              value={form.alert_contacts}
              onChange={(e) => setForm((f) => ({ ...f, alert_contacts: e.target.value }))}
            />
          </div>

          <div className="flex justify-end gap-2">
            <button
              onClick={() => { setShowForm(false); setForm(EMPTY_FORM); }}
              className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Vazgeç
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 text-sm bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-lg font-medium"
            >
              {saving ? "Kaydediliyor..." : "Kaydet"}
            </button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {(monitors ?? []).map((m) => (
          <div
            key={m.id}
            className="bg-white border border-gray-200 rounded-lg p-5"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="font-semibold">
                  {m.group_name ?? m.group_jid}
                </p>
                <p className="text-xs text-gray-400 mt-0.5 font-mono">{m.group_jid}</p>
                <div className="mt-2 space-y-1 text-sm text-gray-600">
                  <p>
                    <span className="font-medium">Ekip:</span>{" "}
                    {m.team_numbers.length > 0
                      ? m.team_numbers.join(", ")
                      : <span className="text-gray-400">Tanımlanmadı</span>}
                  </p>
                  <p>
                    <span className="font-medium">Uyarı grupları:</span>{" "}
                    {m.alert_group_jids.length > 0
                      ? m.alert_group_jids.join(", ")
                      : <span className="text-gray-400">Yok</span>}
                  </p>
                  <p>
                    <span className="font-medium">DM kişileri:</span>{" "}
                    {m.alert_contacts.length > 0
                      ? m.alert_contacts.join(", ")
                      : <span className="text-gray-400">Yok</span>}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    m.is_active
                      ? "bg-green-100 text-green-800"
                      : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {m.is_active ? "Aktif" : "Pasif"}
                </span>
                <button
                  onClick={() => toggleActive(m)}
                  className="text-sm text-blue-500 hover:text-blue-700"
                >
                  {m.is_active ? "Durdur" : "Etkinleştir"}
                </button>
                <button
                  onClick={() => deleteMonitor(m.id)}
                  className="text-sm text-red-500 hover:text-red-700"
                >
                  Sil
                </button>
              </div>
            </div>
          </div>
        ))}
        {(monitors ?? []).length === 0 && (
          <div className="text-center text-gray-400 py-12">
            Henüz grup monitörü eklenmedi. Yukarıdan ekleyebilirsiniz.
          </div>
        )}
      </div>
    </div>
  );
}
