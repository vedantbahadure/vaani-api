import React from "react";
import { useAuth } from "../lib/contexts";
import { LogIn, LogOut, User as UserIcon, Loader2 } from "lucide-react";
import { toast } from "sonner";

export function AuthButton() {
  const { user, loading, signIn, signOut } = useAuth();

  const handleLogin = async () => {
    try {
      await signIn();
      toast.success("Signed in successfully with Google!");
    } catch (err) {
      if (err?.code !== "auth/popup-closed-by-user") {
        toast.error("Sign-in error: " + (err?.message || "Failed to sign in"));
      }
    }
  };

  const handleLogout = async () => {
    try {
      await signOut();
      toast.success("Signed out of VAANI.");
    } catch (err) {
      toast.error("Sign-out error: " + (err?.message || "Failed to sign out"));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-border bg-card/60 text-xs text-muted-foreground">
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      </div>
    );
  }

  if (user) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2 pl-2 pr-3 py-1 rounded-full border border-border bg-card/80 text-xs shadow-xs">
          {user.photoURL ? (
            <img
              src={user.photoURL}
              alt={user.displayName || "User"}
              referrerPolicy="no-referrer"
              className="w-5 h-5 rounded-full object-cover"
            />
          ) : (
            <UserIcon className="w-4 h-4 text-primary" />
          )}
          <span className="font-medium max-w-[100px] truncate hidden sm:inline">
            {user.displayName || user.email?.split("@")[0] || "User"}
          </span>
        </div>
        <button
          onClick={handleLogout}
          title="Sign out"
          className="grid place-items-center w-8 h-8 rounded-full border border-border hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
        >
          <LogOut className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={handleLogin}
      data-testid="google-signin-btn"
      className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 transition-opacity shadow-xs cursor-pointer"
    >
      <LogIn className="w-3.5 h-3.5" />
      <span>Sign In</span>
    </button>
  );
}
