import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Loader2, Mail, Lock, User, Phone } from "lucide-react";
import logoImg from "@/assets/vivasayi-logo.jpeg";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import heroImg from "@/assets/hero-farm.jpg";

const Auth = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">(params.get("mode") === "signup" ? "signup" : "signin");

  // Form states
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    document.title = mode === "signup" ? "Create Account — Vivasayi.AI" : "Sign in — Vivasayi.AI";
  }, [mode]);

  useEffect(() => {
    if (!authLoading && user) navigate("/dashboard", { replace: true });
  }, [user, authLoading, navigate]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      toast.success("Welcome back!");
      navigate("/dashboard");
    } catch (err: any) {
      toast.error(err.message || "Sign in failed. Please check your credentials.");
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast.error("Passwords do not match!");
      return;
    }
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    
    setLoading(true);
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { 
            full_name: fullName,
            phone: phone 
          }
        }
      });
      if (error) throw error;
      toast.success("Account created! Welcome to Vivasayi.");
      navigate("/dashboard");
    } catch (err: any) {
      toast.error(err.message || "Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen grid lg:grid-cols-2">
      {/* Left form */}
      <div className="flex flex-col p-6 md:p-10 relative overflow-y-auto">
        <button onClick={() => navigate("/")} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition w-fit mb-8">
          <ArrowLeft className="h-4 w-4" /> Back to home
        </button>

        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}
          className="m-auto w-full max-w-md space-y-7 pb-10">
          <div className="flex items-center gap-2">
            <img src={logoImg} alt="Vivasayi Logo" className="h-9 w-9 object-cover rounded-full mix-blend-multiply border border-primary/20" />
            <span className="font-display text-2xl">Vivasayi<span className="text-leaf">.AI</span></span>
          </div>

          <div className="space-y-2">
            <h1 className="font-display text-4xl md:text-5xl">{mode === "signup" ? "Join Vivasayi" : "Welcome back"}</h1>
            <p className="text-muted-foreground">
              {mode === "signup" ? "Create your free farmer account below." : "Enter your email and password to access your dashboard."}
            </p>
          </div>

          {mode === "signin" ? (
            <form onSubmit={handleSignIn} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input 
                    id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} 
                    placeholder="you@example.com" className="pl-10" required 
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pw">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input 
                    id="pw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} 
                    placeholder="Enter your password" className="pl-10" required 
                  />
                </div>
              </div>
              <Button type="submit" variant="hero" size="lg" className="w-full mt-2" disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Sign In
              </Button>
            </form>
          ) : (
            <form onSubmit={handleSignUp} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="name">User Name (Full Name)</Label>
                <div className="relative">
                  <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input 
                    id="name" type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} 
                    placeholder="Ramesh Patil" className="pl-10" required 
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="phone">Phone Number</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input 
                    id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} 
                    placeholder="9876543210" className="pl-10" required 
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">Email Address</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input 
                    id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} 
                    placeholder="you@example.com" className="pl-10" required 
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="pw">Password</Label>
                  <Input 
                    id="pw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} 
                    placeholder="Min 6 chars" required 
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cpw">Confirm</Label>
                  <Input 
                    id="cpw" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} 
                    placeholder="Confirm pw" required 
                  />
                </div>
              </div>
              <Button type="submit" variant="hero" size="lg" className="w-full mt-2" disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Create Account
              </Button>
            </form>
          )}

          <p className="text-sm text-center text-muted-foreground pt-4 border-t border-border">
            {mode === "signup" ? "Already have an account?" : "Don't have an account yet?"}{" "}
            <button onClick={() => setMode(mode === "signup" ? "signin" : "signup")}
              className="text-primary font-medium hover:underline">
              {mode === "signup" ? "Sign in instead" : "Create a new account"}
            </button>
          </p>
        </motion.div>
      </div>

      {/* Right visual */}
      <div className="hidden lg:block relative overflow-hidden">
        <img src={heroImg} alt="Farm" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-tr from-primary/80 via-primary/40 to-transparent" />
        <div className="absolute inset-0 flex items-end p-12">
          <blockquote className="text-white max-w-md space-y-4">
            <p className="font-display text-3xl leading-tight italic">
              "Vivasayi reads my fields better than I do — and I've been farming for 30 years."
            </p>
            <footer className="text-white/70">— Suresh K., Cotton farmer, Telangana</footer>
          </blockquote>
        </div>
      </div>
    </main>
  );
};

export default Auth;
