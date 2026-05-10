"use client";

import { useState } from "react";
import useSWR from "swr";
import { apiFetch } from "@/lib/api";

interface Message {
  id: string;
  device_id: string;
  to_number: string;
  body: string;
  status: string;
  queued_at: string;
  sent_at: string | null;
  delivered_at: string | null;
  error: string | null;
}

const statusColor: Record<string, string> = {
  queued: "bg-gray-100 text-gray-600",
  sending: "bg-blue-100 text-blue-800",
  sent: "bg-green-100 text-green-800",
  delivered: "bg-green-200 text-green-900",
  read: "bg-purple-100 text-purple-800",
  failed: "bg-red-100 text-red-800",
};

export default function MessagesPage() {
  const [deviceFilter, setDeviceFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);

  const params = new URLSearchParams();
  if (deviceFilter) params.set("device_id", deviceFilter);
  if (statusFilter) params.set("status", statusFilter);
  params.set("page", String(page));
  params.set("limit", "30");

  const { data } = useSWR(
    `/api/v1/messages?${params.toString()}`,
    (path: string) =>
      apiFetch<{ messages: Message[]; total: number }>(path)
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Mesajlar</h1>

      <div className="flex gap-3">
        <input
          type="text"
          placeholder="Cihaz ID filtrele"
          value={deviceFilter}
          onChange={(e) => { setDeviceFilter(e.target.value); setPage(1); }}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
        />
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
        >
          <option value="">Tüm durumlar</option>
          <option value="queued">Kuyrukta</option>
          <option value="sending">Gönderiliyor</option>
          <option value="sent">Gönderildi</option>
          <option value="delivered">İletildi</option>
          <option value="read">Okundu</option>
          <option value="failed">Başarısız</option>
        </select>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3">Alıcı</th>
              <th className="text-left px-4 py-3">Mesaj</th>
              <th className="text-left px-4 py-3">Durum</th>
              <th className="text-left px-4 py-3">Tarih</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {(data?.messages ?? []).map((msg) => (
              <tr key={msg.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-mono text-xs">{msg.to_number}</td>
                <td className="px-4 py-3 max-w-xs truncate text-gray-700">
                  {msg.body}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      statusColor[msg.status] ?? "bg-gray-100"
                    }`}
                  >
                    {msg.status}
                  </span>
                  {msg.error && (
                    <p className="text-xs text-red-500 mt-1">{msg.error}</p>
                  )}
                </td>
                <td className="px-4 py-3 text-gray-400 text-xs">
                  {new Date(msg.queued_at).toLocaleString("tr-TR")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex gap-2 justify-end items-center text-sm">
        <span className="text-gray-500">
          Toplam: {data?.total ?? 0} mesaj
        </span>
        <button
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page === 1}
          className="px-3 py-1 border rounded disabled:opacity-40"
        >
          ‹ Önceki
        </button>
        <span>Sayfa {page}</span>
        <button
          onClick={() => setPage((p) => p + 1)}
          disabled={(data?.messages.length ?? 0) < 30}
          className="px-3 py-1 border rounded disabled:opacity-40"
        >
          Sonraki ›
        </button>
      </div>
    </div>
  );
}
