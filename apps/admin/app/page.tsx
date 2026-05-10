"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/useAuth";

interface MetricDevice {
  id: string;
  name: string;
  status: string;
  phone: string | null;
  today_sent: number;
  today_failed: number;
}

export default function Dashboard() {
  useAuth();
  const [metrics, setMetrics] = useState<MetricDevice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<{ devices: MetricDevice[] }>("/api/v1/metrics")
      .then((d) => setMetrics(d.devices))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const connected = metrics.filter((d) => d.status === "connected").length;
  const disconnected = metrics.length - connected;

  const statusColor: Record<string, string> = {
    connected: "bg-green-100 text-green-800",
    disconnected: "bg-gray-100 text-gray-600",
    pending: "bg-yellow-100 text-yellow-800",
    banned: "bg-red-100 text-red-800",
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Toplam Cihaz" value={metrics.length} />
        <StatCard label="Bağlı" value={connected} color="text-green-600" />
        <StatCard label="Bağlı Değil" value={disconnected} />
      </div>

      <h2 className="text-lg font-semibold">Cihaz Durumları</h2>
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3">Cihaz</th>
              <th className="text-left px-4 py-3">Telefon</th>
              <th className="text-left px-4 py-3">Durum</th>
              <th className="text-right px-4 py-3">Bugün Gönderildi</th>
              <th className="text-right px-4 py-3">Başarısız</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                  Yükleniyor...
                </td>
              </tr>
            )}
            {!loading && metrics.map((d) => (
              <tr key={d.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">{d.name}</td>
                <td className="px-4 py-3 text-gray-500">{d.phone ?? "—"}</td>
                <td className="px-4 py-3">
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      statusColor[d.status] ?? "bg-gray-100"
                    }`}
                  >
                    {d.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">{d.today_sent}</td>
                <td className="px-4 py-3 text-right text-red-500">
                  {d.today_failed || "—"}
                </td>
              </tr>
            ))}
            {!loading && metrics.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                  Henüz cihaz yok
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  color = "text-gray-900",
}: {
  label: string;
  value: number;
  color?: string;
}) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5">
      <p className="text-sm text-gray-500">{label}</p>
      <p className={`text-3xl font-bold mt-1 ${color}`}>{value}</p>
    </div>
  );
}
