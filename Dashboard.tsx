import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Plus, Sprout, MapPin, RefreshCw, Cloud, Droplets, Thermometer, FlaskConical, Sparkles, AlertTriangle, CheckCircle2, Loader2, LogOut, CloudRain, Home, Volume2, VolumeX, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { fetchWeather, type WeatherSummary } from "@/lib/weather";
import { simulateSensor, type SensorSnapshot } from "@/lib/sensor-sim";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, BarChart, Bar, CartesianGrid } from "recharts";
import { useI18n } from "@/lib/i18n";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { LiveLocationMap } from "@/components/LiveLocationMap";
import { speak, stopSpeaking, isSpeechSupported } from "@/lib/voice";

interface Farm {
  id: string;
  name: string;
  crop_type: string;
  area_acres: number;
  soil_type: string | null;
  latitude: number | null;
  longitude: number | null;
}
interface Recommendation {
  id: string;
  category: string;
  title: string;
  message: string;
  priority: string;
  acknowledged: boolean;
  created_at: string;
}

const crops = ["Rice", "Wheat", "Cotton", "Sugarcane", "Maize", "Tomato"];
const soils = ["Alluvial", "Black", "Red", "Laterite", "Sandy", "Clay"];

const Dashboard = () => {
  const { user, loading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const { t, bcp47 } = useI18n();
  const [farms, setFarms] = useState<Farm[]>([]);
  const [activeFarm, setActiveFarm] = useState<Farm | null>(null);
  const [sensor, setSensor] = useState<SensorSnapshot | null>(null);
  const [weather, setWeather] = useState<WeatherSummary | null>(null);
  const [recs, setRecs] = useState<Recommendation[]>([]);
  const [history, setHistory] = useState<{ time: string; moisture: number; temp: number }[]>([]);
  const [loadingFarm, setLoadingFarm] = useState(false);
  const [generatingAi, setGeneratingAi] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const lastLang = useRef(bcp47);
  const [form, setForm] = useState({ name: "", crop_type: "Rice", area_acres: "1", soil_type: "Alluvial", soil_moisture: "", soil_ph: "", soil_temperature: "", location: "", lat: null as number|null, lon: null as number|null });

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (form.location.length > 3) {
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(form.location)}`);
          const data = await res.json();
          if (data && data.length > 0) {
            setForm(f => ({ ...f, lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) }));
          }
        } catch (err) {}
      }
    }, 1200);
    return () => clearTimeout(timer);
  }, [form.location]);

  useEffect(() => { document.title = "Dashboard · Vivasayi.AI"; }, []);
  useEffect(() => () => stopSpeaking(), []);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth", { replace: true });
  }, [user, authLoading, navigate]);

  useEffect(() => { if (user) loadFarms(); }, [user]);

  useEffect(() => {
    if (lastLang.current !== bcp47 && recs.length > 0) {
      refreshRecommendationsLanguage(bcp47);
    }
    lastLang.current = bcp47;
  }, [bcp47, recs]);

  const loadFarms = async () => {
    const { data, error } = await supabase.from("farms").select("*").order("created_at", { ascending: true });
    if (error) { toast.error(error.message); return; }
    setFarms(data || []);
    if (data && data.length && !activeFarm) selectFarm(data[0]);
  };

  const selectFarm = async (farm: Farm) => {
    setActiveFarm(farm);
    setLoadingFarm(true);
    try {
      const [w, readingsRes, recsRes] = await Promise.all([
        fetchWeather(farm.latitude ?? 18.52, farm.longitude ?? 73.85),
        supabase.from("sensor_readings").select("*").eq("farm_id", farm.id).order("captured_at", { ascending: false }).limit(24),
        supabase.from("recommendations").select("*").eq("farm_id", farm.id).order("created_at", { ascending: false }).limit(10),
      ]);
      setWeather(w);
      setRecs(recsRes.data || []);

      let readings = readingsRes.data || [];
      if (readings.length === 0) {
        const fresh = simulateSensor(farm.crop_type);
        const { data: inserted } = await supabase.from("sensor_readings").insert({
          farm_id: farm.id, user_id: user!.id, ...fresh,
        }).select().single();
        if (inserted) readings = [inserted];
      }
      const latest = readings[0];
      setSensor({
        soil_moisture: Number(latest.soil_moisture),
        soil_temperature: Number(latest.soil_temperature),
        soil_ph: Number(latest.soil_ph),
        nitrogen: Number(latest.nitrogen),
        phosphorus: Number(latest.phosphorus),
        potassium: Number(latest.potassium),
      });
      setHistory(readings.slice().reverse().map((r: any) => ({
        time: new Date(r.captured_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        moisture: Number(r.soil_moisture),
        temp: Number(r.soil_temperature),
      })));
    } catch (e: any) {
      toast.error(e.message || "Failed to load farm data");
    } finally {
      setLoadingFarm(false);
    }
  };

  const captureNewReading = async () => {
    if (!activeFarm || !user) return;
    const fresh = simulateSensor(activeFarm.crop_type, {
      lat: activeFarm.latitude ?? 18.52,
      lon: activeFarm.longitude ?? 73.85,
    });
    const { data, error } = await supabase.from("sensor_readings").insert({
      farm_id: activeFarm.id, user_id: user.id, ...fresh,
    }).select().single();
    if (error) { toast.error(error.message); return; }
    setSensor(fresh);
    setHistory((h) => [...h.slice(-23), {
      time: new Date(data.captured_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      moisture: fresh.soil_moisture, temp: fresh.soil_temperature,
    }]);
    toast.success("New sensor reading captured");
  };

  const fetchRecommendations = async (persist = true, targetLang = bcp47) => {
    if (!activeFarm || !sensor || !weather || !user) return;
    setGeneratingAi(true);
    try {
      const { data, error } = await supabase.functions.invoke("agri-recommend", {
        body: { farm: { ...activeFarm, location: form.location }, sensor, weather, lang: targetLang },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      const items = (data.recommendations || []) as Array<Omit<Recommendation, "id" | "acknowledged" | "created_at">>;
      if (!items.length) throw new Error("No recommendations returned");

      if (persist) {
        const rows = items.map((it) => ({
          farm_id: activeFarm.id, user_id: user.id,
          category: it.category, title: it.title, message: it.message, priority: it.priority,
        }));
        const { data: inserted, error: insertError } = await supabase.from("recommendations").insert(rows).select();
        if (insertError) throw insertError;
        if (inserted) setRecs((r) => [...inserted, ...r].slice(0, 10));
        toast.success(`Generated ${items.length} recommendations`);
      } else {
        setRecs(items.map((it, index) => ({
          id: `lang-${targetLang}-${index}`,
          acknowledged: false,
          created_at: new Date().toISOString(),
          category: it.category,
          title: it.title,
          message: it.message,
          priority: it.priority,
        })));
      }
    } catch (e: any) {
      toast.error(e.message || "AI generation failed");
    } finally {
      setGeneratingAi(false);
    }
  };

  const generateAi = async () => {
    await fetchRecommendations(true, bcp47);
  };

  const refreshRecommendationsLanguage = async (langCode: string) => {
    if (!recs.length || !activeFarm || !sensor || !weather) return;
    await fetchRecommendations(false, langCode);
  };

  const ackRec = async (id: string) => {
    await supabase.from("recommendations").update({ acknowledged: true }).eq("id", id);
    setRecs((r) => r.map((x) => (x.id === id ? { ...x, acknowledged: true } : x)));
  };

  const updateFarmLocation = async (lat: number, lon: number) => {
    if (!activeFarm || !user) return;
    const { error } = await supabase.from("farms").update({ latitude: lat, longitude: lon }).eq("id", activeFarm.id);
    if (error) { toast.error(error.message); return; }
    const updated = { ...activeFarm, latitude: lat, longitude: lon };
    setActiveFarm(updated);
    setFarms((f) => f.map((x) => (x.id === updated.id ? updated : x)));

    try {
      const w = await fetchWeather(lat, lon);
      setWeather(w);
    } catch (e: any) {
      toast.error("Weather refresh failed");
    }

    const locationSensor = simulateSensor(updated.crop_type, { lat, lon });
    try {
      const { data: inserted, error: insertError } = await supabase.from("sensor_readings").insert({
        farm_id: updated.id,
        user_id: user.id,
        ...locationSensor,
      }).select().single();
      if (insertError) throw insertError;
      setHistory((h) => [...h.slice(-23), {
        time: new Date(inserted.captured_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        moisture: locationSensor.soil_moisture,
        temp: locationSensor.soil_temperature,
      }]);
    } catch (e: any) {
      setHistory((h) => [...h.slice(-23), {
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        moisture: locationSensor.soil_moisture,
        temp: locationSensor.soil_temperature,
      }]);
    }
    setSensor(locationSensor);
  };

  const toggleSpeak = (rec: Recommendation) => {
    if (!isSpeechSupported()) {
      toast.error("Voice not supported on this browser");
      return;
    }
    if (speakingId === rec.id) {
      stopSpeaking();
      setSpeakingId(null);
      return;
    }
    stopSpeaking();
    setSpeakingId(rec.id);
    speak(`${rec.title}. ${rec.message}`, bcp47, () => setSpeakingId(null));
  };

  const addFarm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!form.soil_moisture || !form.soil_ph || !form.soil_temperature) {
      toast.error("Soil moisture, soil pH, and soil temperature are required.");
      return;
    }
    const { data, error } = await supabase.from("farms").insert({
        user_id: user.id,
        name: form.name,
        crop_type: form.crop_type.toLowerCase(),
        area_acres: Number(form.area_acres),
        soil_type: form.soil_type,
        latitude: form.lat ?? 18.52, longitude: form.lon ?? 73.85,
      }).select().single();
    if (error) { toast.error(error.message); return; }

    const fresh = simulateSensor(form.crop_type.toLowerCase(), {
      lat: form.lat ?? 18.52,
      lon: form.lon ?? 73.85,
    });
    const reading = {
      ...fresh,
      soil_moisture: Number(form.soil_moisture),
      soil_ph: Number(form.soil_ph),
      soil_temperature: Number(form.soil_temperature),
    };
    const { error: readingError } = await supabase.from("sensor_readings").insert({
      farm_id: data.id,
      user_id: user.id,
      ...reading,
    });
    if (readingError) {
      toast.error(readingError.message);
    }

    setAddOpen(false);
    setForm({ ...form, name: "", soil_moisture: "", soil_ph: "", soil_temperature: "" });
    setFarms((f) => [...f, data]);
    selectFarm(data);
    toast.success("Farm added");
  };

  const deleteFarm = async (farmId: string) => {
    if (!confirm("Are you sure you want to delete this farm?")) return;
    const { error } = await supabase.from("farms").delete().eq("id", farmId);
    if (error) { toast.error("Error deleting farm"); return; }
    toast.success("Farm deleted");
    setFarms(f => f.filter(x => x.id !== farmId));
    if (activeFarm?.id === farmId) setActiveFarm(null);
  };

  if (authLoading || !user) {
    return <div className="min-h-screen grid place-items-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  return (
    <main className="min-h-screen bg-gradient-sage">
      <header className="sticky top-0 z-40 glass border-b border-border">
        <div className="container flex items-center justify-between py-3 gap-2">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate("/")} title={t("dash.home")} className="gap-1.5">
              <Home className="h-4 w-4" />
              <span className="hidden sm:inline">{t("dash.home")}</span>
            </Button>
            <button onClick={() => navigate("/")} className="flex items-center gap-2">
              <Sprout className="h-6 w-6 text-primary" />
              <span className="font-display text-xl hidden sm:inline">Vivasayi<span className="text-leaf">.AI</span></span>
            </button>
          </div>
          <div className="flex items-center gap-1">
            <LanguageSwitcher variant="dark" />
            <span className="hidden lg:inline text-sm text-muted-foreground ml-2">{user.email}</span>
            <Button variant="ghost" size="sm" onClick={signOut} title="Sign out"><LogOut className="h-4 w-4" /></Button>
          </div>
        </div>
      </header>

      <div className="container py-8 space-y-8">
        <motion.section initial={{ opacity: 1, y: 10  }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <div className="flex items-end justify-between flex-wrap gap-3">
            <div>
              <h1 className="font-display text-4xl md:text-5xl">{t("dash.morning")}</h1>
              <p className="text-muted-foreground mt-1">{t("dash.subtitle")}</p>
            </div>
            <Dialog open={addOpen} onOpenChange={setAddOpen}>
              <DialogTrigger asChild>
                <Button variant="hero"><Plus className="h-4 w-4" /> {t("dash.addfarm")}</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle className="font-display text-2xl">Add a new farm</DialogTitle></DialogHeader>
                <form onSubmit={addFarm} className="space-y-4">
                    <div className="space-y-1.5">
                      <Label>Farm name</Label>
                      <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. North field" required />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label>Crop</Label>
                        <Select value={form.crop_type} onValueChange={(v) => setForm({ ...form, crop_type: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>{crops.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label>Area (acres)</Label>
                        <Input type="number" min="0.1" step="0.1" value={form.area_acres} onChange={(e) => setForm({ ...form, area_acres: e.target.value })} required />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label>Soil type</Label>
                        <Select value={form.soil_type} onValueChange={(v) => setForm({ ...form, soil_type: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>{soils.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label>Location</Label>
                        <Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Village, District, State" required />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="space-y-1.5">
                        <Label>Soil moisture (%)</Label>
                        <Input type="number" min="0" max="100" step="0.1" value={form.soil_moisture} onChange={(e) => setForm({ ...form, soil_moisture: e.target.value })} placeholder="e.g. 45.5" required />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Soil pH</Label>
                        <Input type="number" min="0" max="14" step="0.1" value={form.soil_ph} onChange={(e) => setForm({ ...form, soil_ph: e.target.value })} placeholder="e.g. 6.8" required />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Soil temperature (°C)</Label>
                        <Input type="number" min="-10" max="60" step="0.1" value={form.soil_temperature} onChange={(e) => setForm({ ...form, soil_temperature: e.target.value })} placeholder="e.g. 26.5" required />
                      </div>
                    </div>
                    {form.lat !== null && form.lon !== null && (
                      <div className="rounded-xl overflow-hidden border border-border h-40 mt-2">
                        <iframe src={`https://www.openstreetmap.org/export/embed.html?bbox=${form.lon-0.02},${form.lat-0.02},${form.lon+0.02},${form.lat+0.02}&layer=mapnik&marker=${form.lat},${form.lon}`} className="w-full h-full border-0" loading="lazy" />
                      </div>
                    )}
                    <Button type="submit" variant="hero" className="w-full">Create farm</Button>
                  </form>
              </DialogContent>
            </Dialog>
          </div>

          {farms.length > 0 ? (
            <div className="flex gap-3 overflow-x-auto pb-2 -mx-2 px-2">
              {farms.map((f) => {
                const active = activeFarm?.id === f.id;
                return (
                                      <div key={f.id} className="relative group shrink-0">
                      <button onClick={() => selectFarm(f)}
                        className={`w-full text-left rounded-2xl px-5 py-4 border transition-all duration-300 min-w-[220px] ${
                          active ? "bg-primary text-primary-foreground border-primary shadow-elevated" : "bg-card border-border hover:border-primary/40"
                        }`}>
                        <div className="flex items-center gap-2 text-xs uppercase tracking-widest opacity-70">
                          <MapPin className="h-3 w-3" /> {f.crop_type} - {f.area_acres} ac
                        </div>
                        <div className="font-display text-xl mt-1 pr-6">{f.name}</div>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteFarm(f.id);
                        }}
                        className={`absolute top-4 right-4 p-1.5 rounded-full transition-all duration-300 opacity-0 group-hover:opacity-100 ${
                          active ? "text-primary-foreground hover:bg-white/20" : "text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        }`}
                        title="Delete farm"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-3xl bg-card border border-dashed border-border p-12 text-center">
              <Sprout className="h-10 w-10 text-primary/40 mx-auto mb-3" />
              <p className="text-muted-foreground">Add your first farm to start receiving AI recommendations.</p>
            </div>
          )}
        </motion.section>

        {activeFarm && (
          <>
            <section className="grid lg:grid-cols-3 gap-5">
              <motion.div layout className="lg:col-span-1 rounded-3xl bg-gradient-emerald text-primary-foreground p-6 shadow-elevated overflow-hidden relative">
                <div className="absolute -top-12 -right-12 h-44 w-44 bg-accent/20 rounded-full blur-3xl" />
                <div className="relative space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs uppercase tracking-widest opacity-70">{t("dash.weather")}</span>
                    <Cloud className="h-5 w-5 text-accent" />
                  </div>
                  {weather ? (
                    <>
                      <div className="font-display text-7xl leading-none">{weather.temp}°<span className="text-3xl text-white/60">C</span></div>
                      <div className="text-white/80">{weather.condition} · {weather.humidity}% {t("dash.humidity")}</div>
                      <div className="grid grid-cols-2 gap-3 pt-2">
                        <div className="rounded-2xl bg-white/10 p-3">
                          <div className="text-xs opacity-70">{t("dash.rain24")}</div>
                          <div className="font-display text-2xl">{weather.rain_mm_24h}mm</div>
                        </div>
                        <div className="rounded-2xl bg-white/10 p-3">
                          <div className="text-xs opacity-70">{t("dash.rain7")}</div>
                          <div className="font-display text-2xl">{weather.rain_mm_7d_forecast}mm</div>
                        </div>
                      </div>
                      <div className="pt-3">
                        <div className="text-xs uppercase tracking-widest opacity-70 mb-2">{t("dash.rain7day")}</div>
                        <div className="h-20">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={weather.daily}>
                              <Bar dataKey="rain" fill="hsl(var(--accent))" radius={[6, 6, 0, 0]} />
                              <XAxis dataKey="date" tickFormatter={(d) => new Date(d).toLocaleDateString([], { weekday: "short" })} stroke="rgba(255,255,255,0.5)" fontSize={10} tickLine={false} axisLine={false} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    </>
                  ) : <div className="h-48 grid place-items-center"><Loader2 className="h-5 w-5 animate-spin" /></div>}
                </div>
              </motion.div>

              <motion.div layout className="lg:col-span-2 rounded-3xl bg-card p-6 shadow-soft border border-border space-y-5">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs uppercase tracking-widest text-muted-foreground">{t("dash.sensors")} · {activeFarm.name}</span>
                    <h2 className="font-display text-2xl mt-0.5">{t("dash.live")}</h2>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={captureNewReading} disabled={loadingFarm}>
                      <RefreshCw className="h-3.5 w-3.5 mr-1" /> {t("dash.capture")}
                    </Button>
                  </div>
                </div>

                {sensor ? (
                  <>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      <SensorTile icon={Droplets} label={t("hero.moisture")} value={`${sensor.soil_moisture}%`} hue="leaf" />
                      <SensorTile icon={Thermometer} label="Soil temp" value={`${sensor.soil_temperature}°C`} hue="sun" />
                      <SensorTile icon={FlaskConical} label={t("hero.ph")} value={`${sensor.soil_ph}`} hue="moss" />
                    </div>
                    {history.length > 1 && (
                      <div className="h-40">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={history}>
                            <defs>
                              <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="hsl(var(--leaf))" stopOpacity={0.5} />
                                <stop offset="100%" stopColor="hsl(var(--leaf))" stopOpacity={0} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="time" stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} />
                            <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} />
                            <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12 }} />
                            <Area type="monotone" dataKey="moisture" stroke="hsl(var(--leaf))" strokeWidth={2} fill="url(#g1)" />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </>
                ) : <div className="h-48 grid place-items-center"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>}
              </motion.div>
            </section>

            <section>
              <LiveLocationMap
                lat={activeFarm.latitude ?? 18.52}
                lon={activeFarm.longitude ?? 73.85}
                onLocate={updateFarmLocation}
              />
            </section>

            <section className="rounded-3xl bg-card p-6 md:p-8 shadow-soft border border-border space-y-5">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <span className="text-xs uppercase tracking-widest text-muted-foreground">{t("dash.aiagronomist")}</span>
                  <h2 className="font-display text-3xl mt-0.5 flex items-center gap-2">
                    {t("dash.aititle")} <Sparkles className="h-5 w-5 text-leaf" />
                  </h2>
                </div>
                <Button variant="hero" onClick={generateAi} disabled={generatingAi || !sensor || !weather}>
                  {generatingAi ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Sparkles className="h-4 w-4 mr-1" />}
                  {generatingAi ? t("dash.thinking") : t("dash.generate")}
                </Button>
              </div>

              {recs.length === 0 ? (
                <div className="rounded-2xl bg-muted/40 border border-dashed border-border p-10 text-center text-muted-foreground">
                  {t("dash.empty")}
                </div>
              ) : (
                <div className="grid md:grid-cols-2 gap-3">
                  {recs.map((r, i) => {
                    const speaking = speakingId === r.id;
                    return (
                    <motion.div key={r.id}
                      initial={{ opacity: 1, y: 10  }} animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className={`rounded-2xl p-5 border space-y-2 transition-all ${
                        r.acknowledged ? "bg-muted/30 border-border opacity-70" :
                        r.priority === "high" ? "bg-destructive/5 border-destructive/30" :
                        "bg-accent/10 border-accent/30"
                      }`}>
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] uppercase tracking-widest font-medium text-muted-foreground flex items-center gap-1.5">
                          {r.category === "irrigation" ? <CloudRain className="h-3 w-3" /> :
                           r.category === "fertilization" ? <Sprout className="h-3 w-3" /> :
                           r.category === "pest" ? <AlertTriangle className="h-3 w-3" /> :
                           <Sparkles className="h-3 w-3" />}
                          {r.category} · <PriorityChip p={r.priority} />
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => toggleSpeak(r)}
                            className={`text-xs flex items-center gap-1 transition-colors ${speaking ? "text-destructive" : "text-primary hover:underline"}`}
                            aria-label={speaking ? t("dash.stop") : t("dash.listen")}
                          >
                            {speaking ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
                            {speaking ? t("dash.stop") : t("dash.listen")}
                          </button>
                          {!r.acknowledged && (
                            <button onClick={() => ackRec(r.id)} className="text-xs text-primary hover:underline flex items-center gap-1">
                              <CheckCircle2 className="h-3 w-3" /> {t("dash.done")}
                            </button>
                          )}
                        </div>
                      </div>
                      <h3 className="font-display text-lg leading-tight">{r.title}</h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">{r.message}</p>
                    </motion.div>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
};

const SensorTile = ({ icon: Icon, label, value, unit, hue }: { icon: any; label: string; value: string; unit?: string; hue: string }) => (
  <div className="rounded-2xl bg-muted/40 p-4 space-y-1.5 hover:bg-muted/60 transition-colors">
    <div className="flex items-center gap-1.5 text-xs uppercase tracking-widest text-muted-foreground">
      <Icon className={`h-3.5 w-3.5 text-${hue}`} /> {label}
    </div>
    <div className="font-display text-2xl">
      {value}{unit && <span className="text-sm text-muted-foreground ml-1">{unit}</span>}
    </div>
  </div>
);

const PriorityChip = ({ p }: { p: string }) => (
  <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
    p === "high" ? "bg-destructive/20 text-destructive" :
    p === "medium" ? "bg-sun/20 text-bark" :
    "bg-leaf/20 text-leaf"
  }`}>{p}</span>
);

export default Dashboard;
