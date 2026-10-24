import React, { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { KeyRound, ShieldCheck, Sparkles, AlertCircle } from "lucide-react";
import { DiscordUser } from "../types";

interface LoginModalProps {
  onLoginSuccess: (user: DiscordUser) => void;
}

const isTauri = typeof window !== "undefined" && Boolean((window as any).__TAURI_INTERNALS__);

export const LoginModal: React.FC<LoginModalProps> = ({ onLoginSuccess }) => {
  const [tokenInput, setTokenInput] = useState("");
  const [hasVaultToken, setHasVaultToken] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!isTauri) return;

    // Check if vault has a saved token
    invoke<string | null>("get_saved_token")
      .then((saved) => {
        if (saved) {
          setHasVaultToken(true);
          handleAutoLogin();
        }
      })
      .catch((e) => console.log("No saved vault token:", e));
  }, []);

  const handleAutoLogin = async () => {
    if (!isTauri) return;
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const user = await invoke<DiscordUser>("auto_login");
      onLoginSuccess(user);
    } catch (err: any) {
      setErrorMsg(typeof err === "string" ? err : "Failed to login with saved token");
    } finally {
      setIsLoading(false);
    }
  };

  const handleManualLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tokenInput.trim() || !isTauri) return;

    setIsLoading(true);
    setErrorMsg(null);
    try {
      const user = await invoke<DiscordUser>("login", { token: tokenInput.trim() });
      onLoginSuccess(user);
    } catch (err: any) {
      setErrorMsg(typeof err === "string" ? err : "Failed to verify token with Discord");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/60 backdrop-blur-xl">
      <div className="w-full max-w-md glass-card rounded-3xl p-8 border border-white/10 shadow-2xl relative overflow-hidden bg-[#0c0e17]">
        {/* Top Glow bar */}
        <div
          className="absolute -top-24 left-1/2 -translate-x-1/2 w-48 h-48 rounded-full blur-3xl opacity-50"
          style={{ backgroundColor: "var(--accent)" }}
        />

        <div className="relative z-10 flex flex-col items-center text-center">
          <div className="w-14 h-14 rounded-2xl capsule-pill flex items-center justify-center mb-4 border border-white/20">
            <Sparkles className="w-7 h-7 text-[var(--accent)]" />
          </div>

          <h2 className="text-xl font-bold tracking-tight text-white">
            Welcome to MiniCord Next
          </h2>
          <p className="text-xs text-white/50 mt-1 mb-6">
            Lightweight, frameless Discord client synced with your desktop rice
          </p>

          {errorMsg && (
            <div className="w-full p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-xs flex items-center gap-2 mb-4 text-left">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Quick Auto Login from Vault */}
          {hasVaultToken && (
            <button
              onClick={handleAutoLogin}
              disabled={isLoading}
              className="w-full py-3 px-4 rounded-xl flex items-center justify-center gap-2 font-semibold text-sm text-black mb-4 transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-50 cursor-pointer"
              style={{ backgroundColor: "var(--accent)" }}
            >
              <ShieldCheck className="w-4 h-4" />
              <span>{isLoading ? "Signing in..." : "Continue with Saved Account"}</span>
            </button>
          )}

          {hasVaultToken && (
            <div className="w-full flex items-center gap-3 my-2">
              <div className="flex-1 h-[1px] bg-white/10" />
              <span className="text-[11px] text-white/30 uppercase tracking-widest font-mono">
                or
              </span>
              <div className="flex-1 h-[1px] bg-white/10" />
            </div>
          )}

          {/* Manual Token Input */}
          <form onSubmit={handleManualLogin} className="w-full space-y-3 mt-2">
            <div className="relative">
              <KeyRound className="w-4 h-4 text-white/40 absolute left-3 top-3.5" />
              <input
                type="password"
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                placeholder="Enter Discord Token"
                className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-xs placeholder-white/30 focus:outline-none focus:border-[var(--accent)] transition-colors"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading || !tokenInput.trim()}
              className="w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold border border-white/10 transition-colors disabled:opacity-40 cursor-pointer"
            >
              {isLoading ? "Authenticating..." : "Login with Token"}
            </button>
          </form>

          <p className="text-[10px] text-white/30 mt-6">
            Tokens are protected by Windows DPAPI and never leave your machine.
          </p>
        </div>
      </div>
    </div>
  );
};
