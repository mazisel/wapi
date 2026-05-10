"use client";

import { useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/api";

type QrMessage =
  | { type: "qr"; data: string }
  | { type: "connected"; data: { phone: string } }
  | { type: "timeout" }
  | { type: "error"; data: { message: string } }
  | { type: "disconnected" };

interface Props {
  deviceId: string;
  onConnected: (phone: string) => void;
  onClose: () => void;
}

// WS URL'yi build-time değişkene bağlama — her zaman mevcut sayfanın
// hostname'ini kullan, port 3000 (API portu) ile
function buildWsUrl(path: string): string {
  if (typeof window === "undefined") return "";
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  const host = window.location.hostname;
  const apiPort = process.env.NEXT_PUBLIC_API_PORT ?? "3000";
  return `${proto}//${host}:${apiPort}${path}`;
}

export function QRScanner({ deviceId, onConnected, onClose }: Props) {
  const [qrSrc, setQrSrc] = useState<string | null>(null);
  const [status, setStatus] = useState<"waiting" | "connected" | "timeout" | "error">("waiting");
  const [errorMsg, setErrorMsg] = useState("");
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    let ws: WebSocket;

    apiFetch<{ token: string }>(`/api/v1/devices/${deviceId}/qr-token`)
      .then(({ token }) => {
        const url = buildWsUrl(`/ws/qr/${deviceId}?token=${token}`);
        ws = new WebSocket(url);
        wsRef.current = ws;

        ws.onopen = () => {
          // Bağlantı açıldı — sunucu cached QR varsa hemen gönderecek
        };

        ws.onmessage = (event) => {
          const msg: QrMessage = JSON.parse(event.data);
          if (msg.type === "qr") {
            setQrSrc(msg.data);
          } else if (msg.type === "connected") {
            setStatus("connected");
            onConnected(msg.data.phone);
          } else if (msg.type === "timeout") {
            setStatus("timeout");
          } else if (msg.type === "error") {
            setStatus("error");
            setErrorMsg(msg.data.message);
          }
        };

        ws.onerror = () => {
          setStatus("error");
          setErrorMsg(`WebSocket bağlantısı kurulamadı (${buildWsUrl(`/ws/qr/${deviceId}`)})`);
        };
      })
      .catch((err) => {
        setStatus("error");
        setErrorMsg(err.message);
      });

    return () => {
      wsRef.current?.close();
    };
  }, [deviceId]);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-sm w-full mx-4 text-center">
        <h2 className="text-xl font-semibold mb-2">WhatsApp Bağla</h2>
        <p className="text-sm text-gray-500 mb-6">
          WhatsApp &gt; Bağlı Cihazlar &gt; Cihaz Bağla
        </p>

        {status === "waiting" && qrSrc && (
          <img src={qrSrc} alt="QR Kod" className="mx-auto w-64 h-64" />
        )}

        {status === "waiting" && !qrSrc && (
          <div className="w-64 h-64 mx-auto flex items-center justify-center bg-gray-100 rounded-lg">
            <span className="text-gray-400 text-sm">QR bekleniyor...</span>
          </div>
        )}

        {status === "connected" && (
          <div className="py-8">
            <div className="text-5xl mb-4">✓</div>
            <p className="text-green-600 font-semibold">Başarıyla bağlandı!</p>
          </div>
        )}

        {status === "timeout" && (
          <div className="py-8">
            <p className="text-red-500 mb-3">QR kodu süresi doldu.</p>
            <button
              onClick={onClose}
              className="text-sm bg-green-600 text-white px-4 py-2 rounded-lg"
            >
              Tekrar Dene
            </button>
          </div>
        )}

        {status === "error" && (
          <div className="py-8">
            <p className="text-red-500 text-sm">{errorMsg}</p>
          </div>
        )}

        <button
          onClick={onClose}
          className="mt-6 text-sm text-gray-400 hover:text-gray-600"
        >
          {status === "connected" ? "Kapat" : "İptal"}
        </button>
      </div>
    </div>
  );
}
