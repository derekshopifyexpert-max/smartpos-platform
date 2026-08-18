"use client";

import { useQuery } from "@tanstack/react-query";
import { settlementService } from "@/features/exchange/services/settlement.service";

const terminalStatuses = new Set(["CONFIRMED", "SETTLED", "FAILED", "REVERTED", "CANCELED", "COMPLETED"]);

export function useSettlements() {
  return useQuery({
    queryKey: ["crypto-settlements"],
    queryFn: () => settlementService.list(),
  });
}

export function useSettlement(id?: string) {
  return useQuery({
    queryKey: ["crypto-settlement", id],
    queryFn: () => {
      if (!id) throw new Error("Settlement ID is required");
      return settlementService.get(id);
    },
    enabled: Boolean(id),
    refetchInterval: (query) => {
      const status = query.state.data?.settlement.status;
      return status && terminalStatuses.has(status) ? false : 5000;
    },
  });
}
