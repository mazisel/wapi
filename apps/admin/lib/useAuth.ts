"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function useAuth() {
  const router = useRouter();

  useEffect(() => {
    const key = localStorage.getItem("wapi_master_key");
    if (!key) {
      router.replace("/login");
    }
  }, [router]);
}

export function logout() {
  localStorage.removeItem("wapi_master_key");
  window.location.href = "/login";
}
