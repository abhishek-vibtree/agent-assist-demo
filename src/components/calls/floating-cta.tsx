"use client";

import { Phone } from "lucide-react";
import { Button } from "@/components/ui/button";

interface FloatingCTAProps {
  onClick?: () => void;
}

export function FloatingCTA({ onClick }: FloatingCTAProps) {
  return (
    <Button
      onClick={onClick}
      className="fixed bottom-8 right-0 gap-2 rounded-l-lg rounded-r-none bg-blue-600 px-4 py-5 text-sm font-normal text-white shadow-lg hover:bg-blue-700"
    >
      <Phone className="h-4 w-4" />
      Make a call
    </Button>
  );
}
