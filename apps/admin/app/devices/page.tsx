"use client";

import { useState, useCallback } from "react";
import useSWR from "swr";
import { apiFetch } from "@/lib/api";
import { QRScanner } from "@/components/QRScanner";

interface Device {
  id: string;
  name: string;
  phone: string | null;
  status: "pending" | "connected" | "disconnected" | "banned";
  created_at: string;
}

const statusLabel: Record<Device["status"], string> = {
  pending: "Bekliyor",
  connected: "Bağlı",
  disconnected: "Bağlı Değil",
  banned: "Bant Dışı",
};

const statusColor: Record<Device["status"], string> = {
  pending: "bg-yellow-100 text-yellow-800",
  connected: "bg-green-100 text-green-800",
  disconnected: "bg-gray-100 text-gray-600",
  banned: "bg-red-100 text-red-800",
};

export default function DevicesPage() {
  const { data, mutate } = useSWR("/api/v1/devices", (path: string) =>
    apiFetch<{ devices: Device[] }>(path).then((d) => d.devices)
  );

  const [qrDeviceId, setQrDeviceId] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);

  const addDevice = useCallback(async () => {
    if (!newName.trim()) return;
    setAdding(true);
    try {
      const created = await apiFetch<{ id: string; name: string }>(
        "/api/v1/devices",
        {
          method: "POST",
          body: JSON.stringify({ name: newName }),
        }
      );
      setNewName("");
      setQrDeviceId(created.id);
      await mutate();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setAdding(false);
    }
  }, [newName, mutate]);

  const deleteDevice = useCallback(
    async (id: string) => {
      if (!confirm("Bu cihazı silmek istediğinizden emin misiniz?")) return;
      await apiFetch(`/api/v1/devices/${id}`, { method: "DELETE" });
      await mutate();
    },
    [mutate]
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Cihazlar</h1>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Cihaz adı (örn. Satış Botu)"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addDevice()}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-64"
          />
          <button
            onClick={addDevice}
            disabled={adding}
            className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium"
          >
            {adding ? "Ekleniyor..." : "Cihaz Ekle"}
          </button>
        </div>
      </div>

      <div className="grid gap-4">
        {(data ?? []).map((device) => (
          <div
            key={device.id}
            className="bg-white rounded-lg border border-gray-200 p-5 flex items-center justify-between"
          >
            <div>
              <p className="font-semibold">{device.name}</p>
              <p className="text-sm text-gray-500 mt-0.5">
                {device.phone ?? "Henüz bağlanmadı"} &nbsp;&middot;&nbsp;
                <span className="font-mono text-xs">{device.id}</span>
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span
                className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                  statusColor[device.status]
                }`}
              >
                {statusLabel[device.status]}
              </span>
              {device.status !== "connected" && (
                <button
                  onClick={() => setQrDeviceId(device.id)}
                  className="text-sm text-green-600 hover:text-green-800 font-medium"
                >
                  QR Okut
                </button>
              )}
              <button
                onClick={() => deleteDevice(device.id)}
                className="text-sm text-red-500 hover:text-red-700"
              >
                Sil
              </button>
            </div>
          </div>
        ))}
        {(data ?? []).length === 0 && (
          <div className="text-center text-gray-400 py-12">
            Henüz cihaz eklenmedi. Yukarıdan ekleyebilirsiniz.
          </div>
        )}
      </div>

      {qrDeviceId && (
        <QRScanner
          deviceId={qrDeviceId}
          onConnected={() => {
            mutate();
          }}
          onClose={() => {
            setQrDeviceId(null);
            mutate();
          }}
        />
      )}
    </div>
  );
}
