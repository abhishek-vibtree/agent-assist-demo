"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import type { AgentAssistRow } from "@/lib/db-types";

export function useCustomers() {
  const [customers, setCustomers] = useState<AgentAssistRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCustomers = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from("agent_assist")
        .select("*")
        .order("updated_at", { ascending: false });

      if (fetchError) throw fetchError;
      setCustomers((data as AgentAssistRow[]) || []);
    } catch (err: any) {
      setError(err?.message || "Failed to fetch customers");
      console.error("[useCustomers] Fetch error:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  return { customers, isLoading, error, refetch: fetchCustomers };
}
