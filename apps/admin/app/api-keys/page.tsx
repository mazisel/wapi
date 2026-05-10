"use client";

import { useState, useCallback } from "react";
import useSWR from "swr";
import { apiFetch } from "@/lib/api";

interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  device_ids: string[] | null;
  is_active: boolean;
  created_at: string;
  last_used_at: string | null;
}

export default function ApiKeysPage() {
  const { data, mutate } = useSWR("/api/v1/api-keys", (path: string) =>
    apiFetch<{ api_keys: ApiKey[] }>(path).then((d) => d.api_keys)
  );

  const [name, setName] = useState("");
  const [rawKey, setRawKey] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const createKey = useCallback(async () => {
    if (!name.trim()) return;
    setCreating(true);
    try {
      const created = await apiFetch<{ key: string; name: string }>(
        "/api/v1/api-keys",
        {
          method: "POST",
          body: JSON.stringify({ name }),
        }
      );
      setName("");
      setRawKey(created.key);
      await mutate();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setCreating(false);
    }
  }, [name, mutate]);

  const deleteKey = useCallback(
    async (id: string) => {
      if (!confirm("Bu API anahtarını devre dışı bırakmak istiyor musunuz?")) return;
      await apiFetch(`/api/v1/api-keys/${id}`, { method: "DELETE" });
      await mutate();
    },
    [mutate]
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">API Anahtarları</h1>

      <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-4">
        <h2 className="font-semibold">Yeni Anahtar Oluştur</h2>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Anahtar adı (örn. Üretim Uygulaması)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && createKey()}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm flex-1"
          />
          <button
            onClick={createKey}
            disabled={creating}
            className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium"
          >
            {creating ? "Oluşturuluyor..." : "Oluştur"}
          </button>
        </div>

        {rawKey && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-sm font-semibold text-yellow-800 mb-2">
              API anahtarınız — yalnızca bir kez gösterilir!
            </p>
            <code className="text-xs font-mono bg-white border border-yellow-300 rounded px-3 py-2 block break-all">
              {rawKey}
            </code>
            <button
              onClick={() => navigator.clipboard.writeText(rawKey)}
              className="mt-2 text-xs text-yellow-700 hover:text-yellow-900"
            >
              Kopyala
            </button>
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3">Ad</th>
              <th className="text-left px-4 py-3">Prefix</th>
              <th className="text-left px-4 py-3">Durum</th>
              <th className="text-left px-4 py-3">Son Kullanım</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {(data ?? []).map((key) => (
              <tr key={key.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">{key.name}</td>
                <td className="px-4 py-3 font-mono text-xs text-gray-500">
                  {key.prefix}...
                </td>
                <td className="px-4 py-3">
                  {key.is_active ? (
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      Aktif
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
                      Devre Dışı
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-gray-400 text-xs">
                  {key.last_used_at
                    ? new Date(key.last_used_at).toLocaleString("tr-TR")
                    : "—"}
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => deleteKey(key.id)}
                    className="text-red-500 hover:text-red-700 text-xs"
                  >
                    Devre Dışı Bırak
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
