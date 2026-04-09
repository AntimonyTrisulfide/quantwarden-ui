import { Loader2 } from "lucide-react";

export default function Loading() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[linear-gradient(160deg,#fff7e6_0%,#fde68a_35%,#fbbf24_65%,#f59e0b_100%)]">
      <div className="bg-white/85 backdrop-blur-sm border border-[#8B0000]/20 rounded-2xl p-6 shadow-2xl flex flex-col items-center gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-[#8B0000]" />
        <span className="text-sm font-bold text-[#3d200a]">Loading scan details...</span>
      </div>
    </div>
  );
}
