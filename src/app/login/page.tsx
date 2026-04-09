"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { signIn, signOut, useSession } from "@/lib/auth-client";
import { Loader2, Shield, LogOut, LayoutDashboard } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import OtpInput from "@/components/ui/otp-input";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/app";
  const { data: sessionData, isPending: sessionLoading } = useSession();
  const [email, setEmail] = useState("");
  const [emailTouched, setEmailTouched] = useState(false);
  const [loadingGoogle, setLoadingGoogle] = useState(false);
  const [loadingMagic, setLoadingMagic] = useState(false);
  const [otpScreen, setOtpScreen] = useState(false);

  const isValidEmail = (val: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
  const emailError = emailTouched && email.length > 0 && !isValidEmail(email);

  const handleGoogleSignIn = async () => {
    setLoadingGoogle(true);
    try {
      await signIn.social({ provider: "google", callbackURL: callbackUrl });
    } catch (e) {
      console.error(e);
      setLoadingGoogle(false);
    }
  };

  const handleSendCode = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!isValidEmail(email)) return;
    setLoadingMagic(true);
    try {
      // This triggers the magicLink flow which now also generates an OTP
      await signIn.magicLink({ email, callbackURL: callbackUrl });
      setOtpScreen(true);
    } catch (error) {
      console.error(error);
    } finally {
      setLoadingMagic(false);
    }
  };

  const handleResend = async () => {
    await signIn.magicLink({ email, callbackURL: callbackUrl });
  };

  const handleOtpVerified = (verifyUrl: string) => {
    // Navigate to the magic link verify URL which sets the session
    window.location.href = verifyUrl;
  };

  const handleLogout = async () => {
    await signOut({
      fetchOptions: {
        onSuccess: () => {
          router.refresh();
        }
      }
    });
  };

  return (
    <div className="flex min-h-screen bg-[#fffcf5] text-slate-900 font-sans selection:bg-[#8B0000] selection:text-white">
      
      {/* Left Column - Branding */}
      <div className="hidden lg:flex lg:flex-1 relative bg-[#8B0000] overflow-hidden flex-col justify-between p-12">
        <div 
          className="absolute inset-0 opacity-20 pointer-events-none"
          style={{
            backgroundImage: "linear-gradient(#ffffff 1px, transparent 1px), linear-gradient(90deg, #ffffff 1px, transparent 1px)",
            backgroundSize: "40px 40px"
          }}
        />
        
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-12 h-12 border border-white/30 rounded-xl flex items-center justify-center bg-white/10 backdrop-blur-sm">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-white font-extrabold text-xl tracking-tight leading-none uppercase">QuantWarden</h1>
            <p className="text-white/70 text-sm">Quantum-Proof Scanner</p>
          </div>
        </div>

        <div className="relative z-10 max-w-xl">
          <div className="inline-block px-3 py-1 mb-6 border border-white/30 rounded-full bg-white/10 backdrop-blur-sm">
            <span className="text-white text-xs font-bold uppercase tracking-wider">Enterprise Edition</span>
          </div>
          <h2 className="text-5xl lg:text-6xl font-black text-white mb-6 leading-[1.1] tracking-tight">
            Securing the Future of Banking.
          </h2>
          <p className="text-white/80 text-lg leading-relaxed font-medium">
            Proactively identify deprecated cryptography algorithms, measure transition readiness, and intuitively manage CertIn-compliant CBOMs.
          </p>
        </div>
      </div>

      {/* Right Column - Auth Form */}
      <div className="flex-1 flex flex-col justify-center px-8 sm:px-16 lg:px-24 xl:px-32 relative">
        <div className="w-full max-w-md mx-auto">
          {sessionLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-10 h-10 animate-spin text-[#8B0000]" />
            </div>
          ) : sessionData?.session ? (
            <div className="text-center bg-white border border-amber-500/30 p-10 rounded-2xl shadow-xl shadow-amber-500/5">
              <div className="w-16 h-16 bg-[#8B0000]/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <Shield className="w-8 h-8 text-[#8B0000]" />
              </div>
              <h2 className="text-2xl font-black text-[#3d200a] mb-2 tracking-tight">Active Session</h2>
              <p className="text-[#8a5d33] mb-4 font-medium">
                You are already logged in as <br/>
                <strong className="text-[#8B0000] text-lg block mt-1">{sessionData.user.name ?? sessionData.user.email}</strong>
              </p>

              {callbackUrl.includes("/invites/") && (
                <div className="mb-8 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800 font-medium">
                  Proceed to view your organization invitation.
                </div>
              )}
              {(!callbackUrl || !callbackUrl.includes("/invites/")) && (
                <div className="mb-8" />
              )}
              <div className="space-y-3">
                <Link
                  href={callbackUrl}
                  className="w-full flex items-center justify-center gap-2 bg-[#8B0000] text-white py-3.5 px-6 rounded-xl font-bold shadow-md shadow-[#8B0000]/20 hover:-translate-y-0.5 hover:bg-[#730000] transition-all"
                >
                  <LayoutDashboard className="w-5 h-5" /> Open App
                </Link>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center justify-center gap-2 bg-[#fffcf5] border border-amber-500/40 text-[#8B0000] py-3.5 px-6 rounded-xl font-bold hover:bg-white hover:-translate-y-0.5 shadow-sm transition-all"
                >
                  <LogOut className="w-4 h-4" /> Log out to switch
                </button>
              </div>
            </div>
          ) : otpScreen ? (
            /* OTP Verification Screen */
            <OtpInput
              email={email}
              onVerified={handleOtpVerified}
              onBack={() => setOtpScreen(false)}
              onResend={handleResend}
            />
          ) : (
            <>
              <div className="mb-10">
                <h2 className="text-3xl font-extrabold text-[#3d200a] mb-2">Welcome Back</h2>
                <p className="text-[#8a5d33] text-sm">Enter your credentials to access the scanner portal.</p>
              </div>

              <div className="space-y-6">
                <button 
                  onClick={handleGoogleSignIn}
                  disabled={loadingGoogle}
                  className="w-full flex items-center justify-center space-x-3 bg-white border border-amber-500/30 text-[#3d200a] py-3.5 px-6 rounded-xl font-bold hover:bg-[#fdf1df] transition-all active:scale-[0.98] shadow-sm disabled:opacity-50"
                >
                  {loadingGoogle ? (
                    <Loader2 className="w-5 h-5 animate-spin text-[#8B0000]" />
                  ) : (
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                    </svg>
                  )}
                  <span>Continue with Google</span>
                </button>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-amber-500/20"></span>
                  </div>
                  <div className="relative flex justify-center text-xs font-bold uppercase tracking-wider">
                    <span className="bg-[#fffcf5] px-3 text-[#8a5d33]">Or use email</span>
                  </div>
                </div>

                <form onSubmit={handleSendCode} className="space-y-5">
                  <div className="space-y-1.5">
                    <label htmlFor="email" className="text-xs font-bold text-[#8a5d33] uppercase tracking-wider px-1">
                      Email Address <span className="text-red-600">*</span>
                    </label>
                    <input 
                      id="email"
                      type="email" 
                      required
                      value={email}
                      onChange={e => { setEmail(e.target.value); if (!emailTouched) setEmailTouched(true); }}
                      onBlur={() => setEmailTouched(true)}
                      placeholder="you@example.com" 
                      className={`w-full bg-white border rounded-xl px-4 py-3.5 text-[#3d200a] placeholder:text-[#8a5d33]/50 focus:outline-none focus:ring-2 focus:border-transparent transition-all shadow-sm ${
                        emailError ? "border-red-400 focus:ring-red-400/50" : "border-amber-500/30 focus:ring-[#8B0000]/50"
                      }`}
                    />
                    {emailError && (
                      <p className="text-xs text-red-600 font-medium px-1 mt-1">Please enter a valid email address.</p>
                    )}
                  </div>
                  
                  <button 
                    type="submit"
                    disabled={loadingMagic || !email || emailError}
                    className="w-full flex items-center justify-center bg-[#8B0000] text-white py-4 px-6 rounded-xl font-bold text-base hover:bg-[#730000] transition-all hover:shadow-lg hover:shadow-[#8B0000]/20 active:scale-[0.98] disabled:opacity-50"
                  >
                    {loadingMagic ? <Loader2 className="w-5 h-5 animate-spin" /> : "Send Verification Code"}
                  </button>
                </form>
              </div>

              <p className="mt-8 text-sm text-[#8a5d33] text-center w-full">
                Don&apos;t have an enterprise account?{' '}
                <Link href="/signup" className="font-bold text-[#8B0000] hover:underline">
                  Register here
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[#fffcf5]">
        <Loader2 className="w-10 h-10 animate-spin text-[#8B0000]" />
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
