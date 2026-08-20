"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/client";

export interface QuidaxStatus {
  provider: "QUIDAX";
  environment: string;
  connected: boolean;
  accountId?: string;
  error?: string;
}

export function useQuidaxStatus() {
  return useQuery({
    queryKey: ["quidax-provider-status"],
    queryFn: async (): Promise<QuidaxStatus> => {
      const response = await api.get<{ success: boolean; data: QuidaxStatus }>(
        "/crypto/provider/status"
      );
      return response.data.data;
    },
    refetchInterval: 30000,
  });
}
