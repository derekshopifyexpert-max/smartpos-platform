"use client";

import { useQuery } from "@tanstack/react-query";
import { transakService } from "../services/transak.service";

const terminalStatuses = new Set(["COMPLETED", "FAILED", "CANCELLED", "CANCELED", "EXPIRED"]);

export function useTransakCapabilities() {
  return useQuery({ queryKey: ["transak-capabilities"], queryFn: () => transakService.getCapabilities(), staleTime: 5 * 60 * 1000 });
}

export function useTransakTransaction(id?: string) {
  return useQuery({
    queryKey: ["transak-transaction", id],
    queryFn: () => {
      if (!id) throw new Error("Transaction ID is required");
      return transakService.getTransaction(id);
    },
    enabled: Boolean(id),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status && terminalStatuses.has(status) ? false : 5000;
    },
  });
}
