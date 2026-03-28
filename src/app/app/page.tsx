"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSession, organization } from "@/lib/auth-client";

interface OrgData {
  id: string;
  name: string;
  slug: string;
  logo: string | null;
  isPublic: boolean;
  role: string;
  memberCount: number;
}
import {
  Shield,
  ShieldCheck,
  Loader2,
  Building2,
  Plus,
  Users,
  ArrowRight,
  Search,
  Crown,
  Globe,
  Lock,
  Check,
  X,
  MoreHorizontal,
  Copy,
  Share2,
  Trash2,
  AlertTriangle,
  RefreshCw,
  Hash,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function AppDashboard() {
  const { data: sessionData, isPending } = useSession();
  const [orgs, setOrgs] = useState<OrgData[]>([]);
  const [orgsLoading, setOrgsLoading] = useState(true);
  const router = useRouter();

  // Fetch orgs from custom API
  const fetchOrgs = useCallback(async () => {
    setOrgsLoading(true);
    try {
      const res = await fetch("/api/orgs/list");
      const data = await res.json();
      setOrgs(data.organizations ?? []);
    } catch {
      console.error("Failed to fetch orgs");
    } finally {
      setOrgsLoading(false);
    }
  }, []);

  const hasFetchedOrgs = useRef(false);

  useEffect(() => {
    if (!isPending && sessionData?.session && !hasFetchedOrgs.current) {
      hasFetchedOrgs.current = true;
      fetchOrgs();
    }
  }, [isPending, sessionData, fetchOrgs]);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createSlug, setCreateSlug] = useState("");
  const [autoGenerate, setAutoGenerate] = useState(true);
  const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null);
  const [checkingSlug, setCheckingSlug] = useState(false);
  const [joinSlug, setJoinSlug] = useState("");
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState("");
  const checkTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [deleteOrg, setDeleteOrg] = useState<OrgData | null>(null);
  const [deleteConfirmName, setDeleteConfirmName] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Auto-generate slug when modal opens
  const generateSlug = useCallback(async () => {
    try {
      const res = await fetch("/api/orgs/generate-slug");
      const data = await res.json();
      if (data.slug) {
        setCreateSlug(data.slug);
        setSlugAvailable(true);
      }
    } catch {
      console.error("Failed to generate slug");
    }
  }, []);

  // Check slug availability with debounce
  const checkSlugAvailability = useCallback((slug: string) => {
    if (checkTimerRef.current) clearTimeout(checkTimerRef.current);
    if (!slug || slug.length < 3) {
      setSlugAvailable(null);
      return;
    }
    setCheckingSlug(true);
    checkTimerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/orgs/check-slug?slug=${encodeURIComponent(slug)}`);
        const data = await res.json();
        setSlugAvailable(data.available);
      } catch {
        setSlugAvailable(null);
      } finally {
        setCheckingSlug(false);
      }
    }, 400);
  }, []);

  // Generate slug on modal open
  useEffect(() => {
    if (showCreateModal && autoGenerate) {
      generateSlug();
    }
  }, [showCreateModal, autoGenerate, generateSlug]);

  // Close menu on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenuId(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (isPending) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="w-10 h-10 animate-spin text-[#8B0000]" />
      </div>
    );
  }

  const userName = sessionData?.user?.name ?? "there";
  const orgList = orgs;

  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createName.trim() || !createSlug.trim()) return;
    if (!autoGenerate && slugAvailable === false) return;
    setCreating(true);
    setError("");
    try {
      const res = await organization.create({
        name: createName.trim(),
        slug: createSlug.trim().toLowerCase(),
      });
      if (res.error) {
        setError(res.error.message || "Failed to create organization.");
      } else {
        router.push(`/app/${createSlug.trim().toLowerCase()}`);
      }
    } catch {
      setError("Something went wrong.");
    } finally {
      setCreating(false);
    }
  };

  const handleJoinOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinSlug.trim() || joinSlug.length < 3) return;
    setJoining(true);
    setError("");
    try {
      const res = await fetch("/api/orgs/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: joinSlug.trim() }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to join organization.");
      } else {
        setShowJoinModal(false);
        setJoinSlug("");
        router.refresh();
        fetchOrgs();
      }
    } catch {
      setError("Something went wrong.");
    } finally {
      setJoining(false);
    }
  };

  const handleOpenCreateModal = () => {
    setShowCreateModal(true);
    setError("");
    setCreateName("");
    setCreateSlug("");
    setAutoGenerate(true);
    setSlugAvailable(null);
  };

  const handleCopyCode = (orgSlug: string, orgId: string) => {
    navigator.clipboard.writeText(orgSlug);
    setCopiedId(orgId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleShareLink = (orgSlug: string) => {
    const url = `${window.location.origin}/app/${orgSlug}`;
    navigator.clipboard.writeText(url);
  };

  const handleDeleteOrg = async () => {
    if (!deleteOrg || deleteConfirmName.trim() !== deleteOrg.name) return;
    setDeleting(true);
    setDeleteError("");
    try {
      const res = await fetch("/api/orgs/delete", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId: deleteOrg.id,
          confirmName: deleteConfirmName.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setDeleteError(data.error || "Failed to delete.");
      } else {
        setDeleteOrg(null);
        setDeleteConfirmName("");
        fetchOrgs();
      }
    } catch {
      setDeleteError("Something went wrong.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-10">
      {/* Welcome Header */}
      <div className="relative overflow-hidden rounded-2xl bg-[#8B0000] p-8 md:p-12 shadow-xl shadow-[#8B0000]/10">
        <div
          className="absolute inset-0 opacity-15 pointer-events-none"
          style={{
            backgroundImage: "linear-gradient(#ffffff 1px, transparent 1px), linear-gradient(90deg, #ffffff 1px, transparent 1px)",
            backgroundSize: "32px 32px"
          }}
        />
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-4">
            <Shield className="w-8 h-8 text-white/80" />
            <span className="text-xs font-bold text-white/60 uppercase tracking-widest">Dashboard</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-black text-white mb-2 tracking-tight">
            Welcome back, {userName}
          </h1>
          <p className="text-white/70 text-base md:text-lg font-medium max-w-2xl">
            Your quantum-proof security command centre. Monitor assets, generate compliance reports, and manage your team from one place.
          </p>
        </div>
      </div>

      {/* Organizations Section */}
      <div>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-extrabold text-[#3d200a] tracking-tight">Your Organizations</h2>
          {orgList.length > 0 && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => { setShowJoinModal(true); setError(""); }}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-bold text-[#8B0000] border border-[#8B0000]/20 rounded-xl hover:bg-[#8B0000]/5 transition-all"
              >
                <Search className="w-4 h-4" /> Join
              </button>
              <button
                onClick={handleOpenCreateModal}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-bold text-white bg-[#8B0000] rounded-xl hover:bg-[#730000] transition-all shadow-md shadow-[#8B0000]/20"
              >
                <Plus className="w-4 h-4" /> Create
              </button>
            </div>
          )}
        </div>

        {orgsLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-[#8B0000]" />
          </div>
        ) : orgList.length === 0 ? (
          /* Empty State */
          <div className="bg-white border-2 border-dashed border-amber-500/30 rounded-2xl p-12 text-center">
            <div className="w-20 h-20 bg-[#8B0000]/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <Building2 className="w-10 h-10 text-[#8B0000]" />
            </div>
            <h3 className="text-2xl font-black text-[#3d200a] mb-3 tracking-tight">No Organizations Yet</h3>
            <p className="text-[#8a5d33] text-base max-w-md mx-auto mb-8 leading-relaxed">
              Create your first organization to start scanning domains, generating CBOMs, and collaborating with your team.
            </p>
            <div className="flex items-center justify-center gap-4">
              <button
                onClick={handleOpenCreateModal}
                className="flex items-center gap-2 px-6 py-3.5 bg-[#8B0000] text-white rounded-xl font-bold text-base hover:bg-[#730000] transition-all shadow-lg shadow-[#8B0000]/20 hover:-translate-y-0.5 active:scale-[0.98]"
              >
                <Plus className="w-5 h-5" /> Create Organization
              </button>
              <button
                onClick={() => { setShowJoinModal(true); setError(""); }}
                className="flex items-center gap-2 px-6 py-3.5 bg-white border border-amber-500/30 text-[#3d200a] rounded-xl font-bold text-base hover:bg-[#fdf1df] transition-all shadow-sm hover:-translate-y-0.5 active:scale-[0.98]"
              >
                <Users className="w-5 h-5" /> Join Organization
              </button>
            </div>
          </div>
        ) : (
          /* Organization Cards Grid */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {orgList.map((org) => (
              <div
                key={org.id}
                className="group relative bg-white border border-amber-500/20 rounded-2xl p-6 shadow-sm hover:shadow-xl hover:border-[#8B0000]/25 hover:-translate-y-1 transition-all cursor-pointer hover:bg-linear-to-br hover:from-white hover:to-[#fdf1df]"
              >
                {/* 3-dot menu */}
                <div className="absolute top-4 right-4 z-10" ref={openMenuId === org.id ? menuRef : null}>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setOpenMenuId(openMenuId === org.id ? null : org.id);
                    }}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-[#8a5d33] opacity-0 group-hover:opacity-100 hover:bg-[#8B0000]/10 hover:text-[#8B0000] transition-all"
                  >
                    <MoreHorizontal className="w-4 h-4" />
                  </button>

                  {openMenuId === org.id && (
                    <div className="absolute right-0 top-9 w-48 bg-white border border-amber-500/20 rounded-xl shadow-xl z-20 py-1.5 animate-in fade-in slide-in-from-top-1">
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleCopyCode(org.slug, org.id);
                        }}
                        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-[#3d200a] hover:bg-[#fdf1df] transition-colors"
                      >
                        {copiedId === org.id ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-[#8a5d33]" />}
                        <span className="font-medium">{copiedId === org.id ? "Copied!" : "Copy Code"}</span>
                      </button>
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleShareLink(org.slug);
                        }}
                        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-[#3d200a] hover:bg-[#fdf1df] transition-colors"
                      >
                        <Share2 className="w-4 h-4 text-[#8a5d33]" />
                        <span className="font-medium">Share Link</span>
                      </button>
                      {org.role === "owner" && (
                        <>
                          <div className="border-t border-amber-500/15 my-1.5" />
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setDeleteOrg(org);
                              setDeleteConfirmName("");
                              setDeleteError("");
                            }}
                            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                            <span className="font-medium">Delete Organization</span>
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>

                {/* Card content - clickable */}
                <Link href={`/app/${org.slug}`} className="block">
                  <div className="flex items-start gap-4 mb-4">
                    {org.logo ? (
                      <img src={org.logo} alt={org.name} className="w-12 h-12 rounded-full object-cover shadow-sm" />
                    ) : (
                      <div className="w-12 h-12 bg-[#8B0000]/10 rounded-full flex items-center justify-center shrink-0">
                        <Building2 className="w-6 h-6 text-[#8B0000]" />
                      </div>
                    )}
                    <div className="overflow-hidden flex-1 pr-8">
                      <h3 className="text-base font-bold text-[#3d200a] truncate group-hover:text-[#8B0000] transition-colors">
                        {org.name}
                      </h3>
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleCopyCode(org.slug, org.id);
                        }}
                        className="group/code flex items-center gap-1.5 mt-0.5 text-xs text-[#8a5d33] font-mono tracking-wider hover:text-[#8B0000] transition-colors text-left"
                        title="Copy code"
                      >
                        <span className="truncate">{org.slug}</span>
                        {copiedId === org.id ? (
                          <Check className="w-3 h-3 text-emerald-600 shrink-0" />
                        ) : (
                          <Copy className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 mb-5">
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-[#8a5d33] bg-[#fdf1df] px-2.5 py-1 rounded-lg">
                      <Crown className="w-3 h-3" />
                      {org.role === "owner" ? "Owner" : org.role === "admin" ? "Admin" : "Member"}
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-[#8a5d33]">
                      {org.isPublic ? (
                        <><Globe className="w-3 h-3" /> Public</>
                      ) : (
                        <><Lock className="w-3 h-3" /> Private</>
                      )}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs text-[#8a5d33]">
                      <Users className="w-3.5 h-3.5" />
                      <span className="font-medium">{org.memberCount} {org.memberCount === 1 ? "member" : "members"}</span>
                    </div>
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-[#8B0000] uppercase tracking-wider opacity-0 group-hover:opacity-100 transition-opacity">
                      Open <ArrowRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </Link>
              </div>
            ))}

            {/* + New Organization Card */}
            <button
              onClick={handleOpenCreateModal}
              className="group bg-white/50 border-2 border-dashed border-amber-500/25 rounded-2xl p-6 flex flex-col items-center justify-center min-h-[200px] hover:border-[#8B0000]/30 hover:bg-[#8B0000]/[0.02] transition-all cursor-pointer"
            >
              <div className="w-14 h-14 bg-[#8B0000]/10 rounded-xl flex items-center justify-center mb-4 group-hover:bg-[#8B0000]/15 group-hover:scale-110 transition-all">
                <Plus className="w-7 h-7 text-[#8B0000]" />
              </div>
              <p className="text-base font-bold text-[#3d200a] mb-1">New Organization</p>
              <p className="text-xs text-[#8a5d33]">Create a new workspace</p>
            </button>
          </div>
        )}
      </div>

      {/* Quick Links */}
      <div>
        <h2 className="text-xl font-extrabold text-[#3d200a] mb-5 tracking-tight">Quick Actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          {[
            { icon: <ShieldCheck className="w-6 h-6" />, title: "Safety Report", desc: "Review your encryption grading and PQC coverage.", color: "bg-emerald-700" },
            { icon: <Shield className="w-6 h-6" />, title: "Documentation", desc: "Learn about CertIn-CBOM compliance requirements.", color: "bg-[#5f3512]" },
            { icon: <Building2 className="w-6 h-6" />, title: "Team Settings", desc: "Manage roles, permissions, and team access.", color: "bg-amber-600" },
          ].map((item, idx) => (
            <div
              key={idx}
              className="group bg-white border border-amber-500/20 rounded-2xl p-6 shadow-sm hover:shadow-lg hover:border-amber-500/40 hover:-translate-y-1 transition-all cursor-pointer"
            >
              <div className={`${item.color} w-12 h-12 rounded-xl flex items-center justify-center text-white mb-5 shadow-md group-hover:scale-110 transition-transform`}>
                {item.icon}
              </div>
              <h3 className="text-base font-bold text-[#3d200a] mb-1.5">{item.title}</h3>
              <p className="text-sm text-[#8a5d33] leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Create Organization Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => setShowCreateModal(false)}>
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-amber-500/20"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="bg-[#8B0000] px-6 py-5">
              <h3 className="text-lg font-black text-white tracking-tight">Create Organization</h3>
              <p className="text-white/70 text-sm mt-1">Set up a new workspace for your team.</p>
            </div>

            <form onSubmit={handleCreateOrg} className="p-6 space-y-5">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#8a5d33] uppercase tracking-wider">
                  Organization Name <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={createName}
                  onChange={e => setCreateName(e.target.value)}
                  placeholder="Acme Corporation"
                  className="w-full bg-white border border-amber-500/30 rounded-xl px-4 py-3 text-[#3d200a] placeholder:text-[#8a5d33]/50 focus:outline-none focus:ring-2 focus:ring-[#8B0000]/50 focus:border-transparent transition-all shadow-sm"
                />
              </div>

              {/* Organization Code */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-[#8a5d33] uppercase tracking-wider">
                    Organization Code <span className="text-red-600">*</span>
                  </label>
                </div>

                {/* Auto-generate checkbox */}
                <label className="flex items-center gap-2.5 cursor-pointer select-none group">
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={autoGenerate}
                      onChange={e => {
                        setAutoGenerate(e.target.checked);
                        if (e.target.checked) {
                          generateSlug();
                        } else {
                          setCreateSlug("");
                          setSlugAvailable(null);
                        }
                      }}
                      className="sr-only peer"
                    />
                    <div className="w-5 h-5 rounded-md border-2 border-amber-500/40 bg-white peer-checked:bg-[#8B0000] peer-checked:border-[#8B0000] transition-all flex items-center justify-center">
                      {autoGenerate && <Check className="w-3.5 h-3.5 text-white" />}
                    </div>
                  </div>
                  <span className="text-sm text-[#3d200a] font-medium group-hover:text-[#8B0000] transition-colors">Auto-generate code</span>
                </label>

                {autoGenerate ? (
                  /* Auto-generated code display */
                  <div className="flex items-center gap-3">
                    <div className="flex-1 bg-[#fdf1df]/60 border border-amber-500/25 rounded-xl px-4 py-3 font-mono text-lg font-bold text-[#8B0000] tracking-[0.3em] text-center select-all">
                      {createSlug || <Loader2 className="w-5 h-5 animate-spin text-[#8a5d33] mx-auto" />}
                    </div>
                    <button
                      type="button"
                      onClick={generateSlug}
                      className="p-3.5 rounded-xl border border-amber-500/30 text-[#8a5d33] hover:bg-[#fdf1df] hover:text-[#8B0000] transition-all"
                      title="Regenerate code"
                    >
                      <RefreshCw className="w-5 h-5" />
                    </button>
                  </div>
                ) : (
                  /* Custom code input with availability check */
                  <div className="space-y-1.5">
                    <div className={`flex items-center gap-0 bg-white border rounded-xl overflow-hidden shadow-sm transition-all ${
                      createSlug.length >= 3
                        ? slugAvailable === true
                          ? "border-emerald-400 ring-2 ring-emerald-400/20"
                          : slugAvailable === false
                            ? "border-red-400 ring-2 ring-red-400/20"
                            : "border-amber-500/30 focus-within:ring-2 focus-within:ring-[#8B0000]/50"
                        : "border-amber-500/30 focus-within:ring-2 focus-within:ring-[#8B0000]/50"
                    }`}>
                      <input
                        type="text"
                        required
                        maxLength={20}
                        value={createSlug}
                        onChange={e => {
                          const val = e.target.value.toLowerCase().replace(/[^a-z0-9]/g, "");
                          setCreateSlug(val);
                          setSlugAvailable(null);
                          checkSlugAvailability(val);
                        }}
                        placeholder="e.g. abc123"
                        className="flex-1 bg-transparent py-3 px-4 text-[#3d200a] font-mono text-lg tracking-[0.2em] text-center placeholder:text-[#8a5d33]/40 placeholder:tracking-normal placeholder:text-sm focus:outline-none"
                      />
                      <div className="pr-3 shrink-0">
                        {checkingSlug ? (
                          <Loader2 className="w-5 h-5 animate-spin text-[#8a5d33]" />
                        ) : createSlug.length >= 3 && slugAvailable === true ? (
                          <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center">
                            <Check className="w-4 h-4 text-emerald-600" />
                          </div>
                        ) : createSlug.length >= 3 && slugAvailable === false ? (
                          <div className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center">
                            <X className="w-4 h-4 text-red-600" />
                          </div>
                        ) : null}
                      </div>
                    </div>
                    {createSlug.length >= 3 && slugAvailable === true && (
                      <p className="text-xs text-emerald-600 font-medium px-1 flex items-center gap-1">
                        <Check className="w-3 h-3" /> This code is available!
                      </p>
                    )}
                    {createSlug.length >= 3 && slugAvailable === false && (
                      <p className="text-xs text-red-600 font-medium px-1 flex items-center gap-1">
                        <X className="w-3 h-3" /> This code is already taken. Try a different one.
                      </p>
                    )}
                    {createSlug.length > 0 && createSlug.length < 3 && (
                      <p className="text-xs text-[#8a5d33] font-medium px-1">Code must be at least 3 characters.</p>
                    )}
                  </div>
                )}

                <p className="text-xs text-[#8a5d33]/70 px-1">Members will use this code to find and join your organization.</p>
              </div>

              {error && (
                <p className="text-xs text-red-600 font-medium bg-red-50 border border-red-200 px-3 py-2 rounded-lg">{error}</p>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 py-3 px-4 rounded-xl font-bold text-[#3d200a] border border-amber-500/30 hover:bg-[#fdf1df] transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating || !createName.trim() || !createSlug.trim() || (!autoGenerate && slugAvailable !== true)}
                  className="flex-1 flex items-center justify-center py-3 px-4 rounded-xl font-bold text-white bg-[#8B0000] hover:bg-[#730000] transition-all shadow-md shadow-[#8B0000]/20 disabled:opacity-50"
                >
                  {creating ? <Loader2 className="w-5 h-5 animate-spin" /> : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Join Organization Modal */}
      {showJoinModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => setShowJoinModal(false)}>
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-amber-500/20"
            onClick={e => e.stopPropagation()}
          >
            {/* Rich Maroon & Gold Header */}
            <div className="bg-linear-to-r from-[#8B0000] to-[#5a0000] px-6 py-5 flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-amber-500/20 border border-amber-500/30 rounded-xl flex items-center justify-center shrink-0 shadow-inner">
                  <Hash className="w-5 h-5 text-amber-500" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-white tracking-tight">Join Organization</h3>
                  <p className="text-white/80 text-sm mt-0.5">Enter the organization code.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowJoinModal(false)}
                className="text-white/70 hover:text-white hover:bg-white/10 p-1.5 rounded-lg transition-colors cursor-pointer"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleJoinOrg} className="p-6 space-y-5">
              <div className="space-y-3">
                <label className="text-xs font-bold text-[#8a5d33] uppercase tracking-wider block">
                  Organization Code <span className="text-red-600">*</span>
                </label>
                <div className="flex items-center gap-0 bg-white border border-amber-500/30 rounded-xl overflow-hidden shadow-sm focus-within:ring-2 focus-within:ring-[#8B0000]/50 focus-within:border-transparent transition-all">
                  <span className="text-lg font-bold text-[#8B0000] bg-amber-50 py-3 px-4 border-r border-amber-500/20 select-none shrink-0 flex items-center justify-center">#</span>
                  <input
                    type="text"
                    required
                    maxLength={20}
                    value={joinSlug}
                    onChange={e => setJoinSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ""))}
                    placeholder="abc123"
                    className="flex-1 bg-transparent py-3 px-4 text-[#3d200a] font-mono tracking-[0.2em] text-lg placeholder:text-[#8a5d33]/50 placeholder:font-sans placeholder:tracking-normal placeholder:text-sm focus:outline-none"
                  />
                </div>
              </div>

              {error && (
                <p className="text-xs text-red-600 font-medium bg-red-50 border border-red-200 px-3 py-2 rounded-lg">{error}</p>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowJoinModal(false)}
                  className="flex-1 py-3 px-4 rounded-xl font-bold text-[#3d200a] border border-amber-500/30 hover:bg-[#fdf1df] transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={joining || joinSlug.length < 3}
                  className="flex-1 flex items-center justify-center py-3 px-4 rounded-xl font-bold text-white bg-linear-to-r from-[#8B0000] to-[#5a0000] hover:from-[#7a0000] hover:to-[#4a0000] transition-all shadow-md disabled:opacity-50"
                >
                  {joining ? <Loader2 className="w-5 h-5 animate-spin" /> : "Join"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteOrg && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => { setDeleteOrg(null); setDeleteConfirmName(""); }}>
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-red-200"
            onClick={e => e.stopPropagation()}
          >
            {/* Red Warning Header */}
            <div className="bg-red-600 px-6 py-5 flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-white tracking-tight">Delete Organization</h3>
                  <p className="text-white/70 text-sm mt-0.5">This action cannot be undone.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => { setDeleteOrg(null); setDeleteConfirmName(""); }}
                className="text-white/70 hover:text-white hover:bg-white/10 p-1.5 rounded-lg transition-colors cursor-pointer"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                <p className="text-sm text-red-800 leading-relaxed">
                  This will permanently delete <strong className="font-bold">{deleteOrg.name}</strong> and all its data, including members, invitations, roles, and configurations.
                </p>
              </div>

              <div className="space-y-3">
                <label className="text-xs font-bold text-[#8a5d33] uppercase tracking-wider block">
                  Type <span className="normal-case tracking-normal font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded">{deleteOrg.name}</span> to confirm
                </label>
                <input
                  type="text"
                  value={deleteConfirmName}
                  onChange={e => setDeleteConfirmName(e.target.value)}
                  placeholder={deleteOrg.name}
                  className={`w-full bg-white border rounded-xl px-4 py-3 text-[#3d200a] placeholder:text-[#8a5d33]/30 focus:outline-none focus:ring-2 transition-all shadow-sm ${
                    deleteConfirmName.length > 0 && deleteConfirmName.trim() === deleteOrg.name
                      ? "border-red-400 focus:ring-red-400/50"
                      : "border-amber-500/30 focus:ring-[#8B0000]/50"
                  }`}
                />
              </div>

              {deleteError && (
                <p className="text-xs text-red-600 font-medium bg-red-50 border border-red-200 px-3 py-2 rounded-lg">{deleteError}</p>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setDeleteOrg(null); setDeleteConfirmName(""); }}
                  className="flex-1 py-3 px-4 rounded-xl font-bold text-[#3d200a] border border-amber-500/30 hover:bg-[#fdf1df] transition-all"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteOrg}
                  disabled={deleting || deleteConfirmName.trim() !== deleteOrg.name}
                  className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold text-white bg-red-600 hover:bg-red-700 transition-all shadow-md disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {deleting ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Trash2 className="w-4 h-4" /> Delete Forever</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
