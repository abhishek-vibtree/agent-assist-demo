import { cn } from "@/lib/utils";

const colorMap: Record<string, string> = {
  blue: "bg-blue-100 text-blue-900",
  green: "bg-green-100 text-green-900",
  yellow: "bg-amber-100 text-amber-900",
  red: "bg-red-100 text-red-900",
  gray: "bg-gray-100 text-gray-900",
  purple: "bg-purple-100 text-purple-900",
  teal: "bg-teal-100 text-teal-900",
  pink: "bg-pink-100 text-pink-900",
  cyan: "bg-cyan-100 text-cyan-900",
  orange: "bg-orange-100 text-orange-900",
};

export function CallLabel({
  text,
  color,
  rounded = false,
}: {
  text: string;
  color: string;
  rounded?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-1.5 text-xs font-normal",
        rounded ? "rounded-full px-2" : "rounded",
        colorMap[color] || "bg-gray-100 text-gray-900"
      )}
    >
      {text}
    </span>
  );
}
