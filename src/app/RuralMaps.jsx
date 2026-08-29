import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  APIProvider,
  Map,
  AdvancedMarker,
  Pin,
  InfoWindow,
  MapControl,
  ControlPosition,
  useMap,
  useMapsLibrary,
} from "@vis.gl/react-google-maps";
import { motion } from "framer-motion";
import {
  MapPin,
  Search,
  Navigation,
  Layers,
  Store,
  FileCheck,
  Wheat,
  FlaskConical,
  Building2,
  ExternalLink,
  MessageCircle,
  Phone,
  Compass,
} from "lucide-react";
import { toast } from "sonner";
import { useLang } from "../lib/contexts";
import { useNavigate } from "react-router-dom";

// Pre-seeded verified Agricultural / Rural Governance Centers across India
const SEED_CENTERS = [
  {
    id: "kvk-1",
    name: "Krishi Vigyan Kendra, Baramati",
    type: "kvk",
    typeLabel: "Krishi Vigyan Kendra (KVK)",
    lat: 18.1519,
    lng: 74.5771,
    address: "Malegaon Khurd, Baramati, Maharashtra 413115",
    phone: "+91 2112 255227",
    services: ["Soil Testing", "Seed Multiplication", "Organic Farming Training", "Custom Hiring"],
    district: "Pune, Maharashtra",
  },
  {
    id: "apmc-1",
    name: "APMC Krishi Upaj Mandi, Lasalgaon",
    type: "apmc",
    typeLabel: "APMC Agricultural Mandi",
    lat: 20.1472,
    lng: 74.2257,
    address: "Lasalgaon Station Road, Niphad, Nashik, Maharashtra 422306",
    phone: "+91 2550 266023",
    services: ["Daily e-NAM Auction", "Grading & Weighing", "Cold Storage", "Price Discovery"],
    district: "Nashik, Maharashtra",
  },
  {
    id: "csc-1",
    name: "Common Service Center (CSC) Gram Digital",
    type: "csc",
    typeLabel: "Common Service Center (CSC)",
    lat: 19.076,
    lng: 72.8777,
    address: "Near Gram Panchayat Bhawan, Vasai, Maharashtra",
    phone: "1800 121 3468",
    services: ["PM-KISAN e-KYC", "Kisan Credit Card Enrollment", "Crop Insurance Registration"],
    district: "Palghar, Maharashtra",
  },
  {
    id: "pacs-1",
    name: "Primary Agricultural Cooperative Society (PACS)",
    type: "pacs",
    typeLabel: "PACS Cooperative",
    lat: 23.2599,
    lng: 77.4126,
    address: "Berasia Road, Bhopal, Madhya Pradesh 462038",
    phone: "+91 755 2734120",
    services: ["Short-term Crop Loans", "Fertilizer & Pesticide Depot", "Subsidized Machinery"],
    district: "Bhopal, Madhya Pradesh",
  },
  {
    id: "soil-1",
    name: "State Soil Health & Quality Testing Laboratory",
    type: "soil",
    typeLabel: "Soil Testing Lab",
    lat: 28.6139,
    lng: 77.209,
    address: "Pusa Institute Complex, New Delhi 110012",
    phone: "+91 11 25841000",
    services: ["NPK Soil Nutrient Card", "Micronutrient Analysis", "Organic Carbon Profiling"],
    district: "New Delhi",
  },
  {
    id: "kvk-2",
    name: "Krishi Vigyan Kendra, Karnal (NDRI)",
    type: "kvk",
    typeLabel: "Krishi Vigyan Kendra (KVK)",
    lat: 29.6857,
    lng: 76.9905,
    address: "NDRI Campus, Karnal, Haryana 132001",
    phone: "+91 184 2259023",
    services: ["Dairy Farming Extension", "Wheat-Paddy Advisory", "Climate Resilient Tech"],
    district: "Karnal, Haryana",
  },
  {
    id: "apmc-2",
    name: "APMC Azadpur Mandi",
    type: "apmc",
    typeLabel: "APMC Agricultural Mandi",
    lat: 28.7126,
    lng: 77.1724,
    address: "Azadpur, New Delhi 110033",
    phone: "+91 11 27691234",
    services: ["Wholesale Produce Trading", "Cold Storage", "e-NAM Digital Gate Entry"],
    district: "North Delhi",
  },
];

const CATEGORIES = [
  { id: "all", label: "All Centers", icon: Layers, color: "#16a34a" },
  { id: "kvk", label: "KVK Advisory", icon: Wheat, color: "#2563eb" },
  { id: "apmc", label: "APMC Mandis", icon: Store, color: "#d97706" },
  { id: "csc", label: "CSC Digital", icon: FileCheck, color: "#7c3aed" },
  { id: "pacs", label: "Cooperative PACS", icon: Building2, color: "#0d9488" },
  { id: "soil", label: "Soil Testing", icon: FlaskConical, color: "#dc2626" },
];

function PlaceAutocomplete({ onPlaceSelect }) {
  const [autocomplete, setAutocomplete] = useState(null);
  const inputRef = useRef(null);
  const places = useMapsLibrary("places");

  useEffect(() => {
    if (!places || !inputRef.current) return;
    const auto = new places.Autocomplete(inputRef.current, {
      fields: ["geometry", "name", "formatted_address"],
    });
    setAutocomplete(auto);
  }, [places]);

  useEffect(() => {
    if (!autocomplete) return;
    const listener = autocomplete.addListener("place_changed", () => {
      onPlaceSelect(autocomplete.getPlace());
    });
    return () => {
      google.maps.event.removeListener(listener);
    };
  }, [autocomplete, onPlaceSelect]);

  return (
    <div className="relative w-full max-w-md">
      <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
      <input
        ref={inputRef}
        type="text"
        placeholder="Search village, mandi, district or state..."
        className="w-full pl-10 pr-4 py-2.5 rounded-full border border-border bg-card text-foreground text-sm shadow-xs outline-none focus:ring-2 focus:ring-primary/20"
      />
    </div>
  );
}

function MapHandler({ place, center }) {
  const map = useMap();
  useEffect(() => {
    if (!map) return;
    if (place?.geometry?.viewport) {
      map.fitBounds(place.geometry.viewport);
    } else if (place?.geometry?.location) {
      map.setCenter(place.geometry.location);
      map.setZoom(13);
    } else if (center) {
      map.setCenter(center);
    }
  }, [map, place, center]);
  return null;
}

export default function RuralMaps() {
  const { lang } = useLang();
  const navigate = useNavigate();
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedCenter, setSelectedCenter] = useState(null);
  const [selectedPlace, setSelectedPlace] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [locating, setLocating] = useState(false);

  const mapsApiKey =
    import.meta.env.VITE_GOOGLE_MAPS_API_KEY ||
    "AIzaSyDxkjjaMoXn9_Iw7Dr0YlbvcHPT6o1ZYhE";

  const defaultCenter = useMemo(() => ({ lat: 20.5937, lng: 78.9629 }), []); // Center of India

  const filteredCenters = useMemo(() => {
    if (selectedCategory === "all") return SEED_CENTERS;
    return SEED_CENTERS.filter((c) => c.type === selectedCategory);
  }, [selectedCategory]);

  const handleLocateMe = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported by your browser");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserLocation(coords);
        setSelectedPlace({
          geometry: { location: coords },
          name: "My Location",
          formatted_address: "Current Geolocation",
        });
        setLocating(false);
        toast.success("Located your position!");
      },
      (err) => {
        console.warn("Geo error:", err);
        setLocating(false);
        toast.error("Could not retrieve your location. Please check browser permissions.");
      },
      { timeout: 10000 }
    );
  };

  const askAiAboutKendra = (kendra) => {
    navigate(`/app/chat?q=${encodeURIComponent(`Tell me about ${kendra.name} located in ${kendra.district}. What services like ${kendra.services.join(", ")} can farmers avail here?`)}`);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] overflow-hidden bg-background text-foreground">
      {/* Top Header & Filter Bar */}
      <div className="p-4 md:px-8 border-b border-border bg-card/60 backdrop-blur-md flex flex-wrap items-center justify-between gap-4 z-20">
        <div>
          <h1 className="font-head text-xl md:text-2xl font-medium tracking-tight flex items-center gap-2">
            <Compass className="w-5 h-5 text-primary" />
            Rural Kisan Kendra & Mandi Locator
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Locate Krishi Vigyan Kendras, APMC Mandis, Soil Labs, and Common Service Centers powered by Google Maps
          </p>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <button
            onClick={handleLocateMe}
            disabled={locating}
            className="flex items-center gap-2 px-3.5 py-2 rounded-full border border-border bg-card text-xs font-medium hover:bg-accent transition-colors"
          >
            <Navigation className={`w-3.5 h-3.5 text-primary ${locating ? "animate-spin" : ""}`} />
            <span>{locating ? "Locating..." : "Near Me"}</span>
          </button>
        </div>
      </div>

      {/* Main Map View & Split Panel */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
        {/* Left Side List / Details Panel */}
        <aside className="w-full md:w-80 lg:w-96 border-r border-border bg-card flex flex-col z-10 shrink-0 overflow-hidden">
          {/* Categories Tab Pill Bar */}
          <div className="p-3 border-b border-border overflow-x-auto flex gap-1.5 no-scrollbar">
            {CATEGORIES.map((cat) => {
              const Icon = cat.icon;
              const active = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs whitespace-nowrap transition-colors font-medium ${
                    active
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{cat.label}</span>
                </button>
              );
            })}
          </div>

          {/* List of Kendras */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
            {filteredCenters.map((c) => {
              const isSelected = selectedCenter?.id === c.id;
              const catMeta = CATEGORIES.find((cat) => cat.id === c.type) || CATEGORIES[0];
              const Icon = catMeta.icon;

              return (
                <div
                  key={c.id}
                  onClick={() => setSelectedCenter(c)}
                  className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                    isSelected
                      ? "border-primary bg-primary/5 shadow-xs"
                      : "border-border bg-card/60 hover:bg-accent/40"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-2">
                      <span
                        className="grid place-items-center w-7 h-7 rounded-lg"
                        style={{ background: `${catMeta.color}18`, color: catMeta.color }}
                      >
                        <Icon className="w-3.5 h-3.5" />
                      </span>
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        {c.typeLabel}
                      </span>
                    </div>
                  </div>

                  <h4 className="text-sm font-medium leading-snug">{c.name}</h4>
                  <p className="text-xs text-muted-foreground mt-1 flex items-start gap-1">
                    <MapPin className="w-3.5 h-3.5 shrink-0 text-muted-foreground mt-0.5" />
                    <span>{c.district}</span>
                  </p>

                  <div className="mt-2.5 flex flex-wrap gap-1">
                    {c.services.slice(0, 2).map((s, idx) => (
                      <span
                        key={idx}
                        className="text-[10px] px-2 py-0.5 rounded-md bg-muted text-muted-foreground font-mono"
                      >
                        {s}
                      </span>
                    ))}
                    {c.services.length > 2 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground font-mono">
                        +{c.services.length - 2}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Selected Center Detailed Box */}
          {selectedCenter && (
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="p-4 border-t border-border bg-card/95 backdrop-blur-sm"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] uppercase font-bold tracking-widest text-primary">
                  {selectedCenter.typeLabel}
                </span>
                <span className="text-xs text-muted-foreground font-mono">
                  {selectedCenter.lat.toFixed(4)}, {selectedCenter.lng.toFixed(4)}
                </span>
              </div>
              <h3 className="text-sm font-semibold">{selectedCenter.name}</h3>
              <p className="text-xs text-muted-foreground mt-1">{selectedCenter.address}</p>

              {selectedCenter.phone && (
                <div className="mt-2 flex items-center gap-1.5 text-xs text-foreground font-medium">
                  <Phone className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>{selectedCenter.phone}</span>
                </div>
              )}

              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => askAiAboutKendra(selectedCenter)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-full bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 transition-opacity"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>Ask VAANI AI</span>
                </button>
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${selectedCenter.lat},${selectedCenter.lng}`}
                  target="_blank"
                  rel="noreferrer"
                  className="grid place-items-center w-9 h-9 rounded-full border border-border hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                  title="Open in Google Maps"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </motion.div>
          )}
        </aside>

        {/* Right Interactive Google Map */}
        <div className="flex-1 h-full w-full relative">
          <APIProvider apiKey={mapsApiKey}>
            <Map
              mapId="vaani-rural-map"
              defaultCenter={defaultCenter}
              defaultZoom={5}
              gestureHandling="greedy"
              disableDefaultUI={false}
              className="w-full h-full"
            >
              {/* Autocomplete Search Control */}
              <MapControl position={ControlPosition.TOP_CENTER}>
                <div className="p-3">
                  <PlaceAutocomplete onPlaceSelect={setSelectedPlace} />
                </div>
              </MapControl>

              <MapHandler place={selectedPlace} center={selectedCenter ? { lat: selectedCenter.lat, lng: selectedCenter.lng } : null} />

              {/* User Location Marker */}
              {userLocation && (
                <AdvancedMarker position={userLocation}>
                  <Pin background="#3b82f6" glyphColor="#ffffff" borderColor="#1e3a8a" />
                </AdvancedMarker>
              )}

              {/* Render Seed Centers Markers */}
              {filteredCenters.map((c) => {
                const catMeta = CATEGORIES.find((cat) => cat.id === c.type) || CATEGORIES[0];
                return (
                  <AdvancedMarker
                    key={c.id}
                    position={{ lat: c.lat, lng: c.lng }}
                    onClick={() => setSelectedCenter(c)}
                  >
                    <Pin
                      background={catMeta.color}
                      glyphColor="#ffffff"
                      borderColor="#ffffff"
                    />
                  </AdvancedMarker>
                );
              })}

              {/* Info Window for Selected Center */}
              {selectedCenter && (
                <InfoWindow
                  position={{ lat: selectedCenter.lat, lng: selectedCenter.lng }}
                  onCloseClick={() => setSelectedCenter(null)}
                >
                  <div className="p-2 max-w-[220px] text-foreground">
                    <div className="text-[10px] font-bold text-emerald-600 uppercase">
                      {selectedCenter.typeLabel}
                    </div>
                    <div className="font-semibold text-xs mt-0.5">{selectedCenter.name}</div>
                    <div className="text-[11px] text-muted-foreground mt-1">
                      {selectedCenter.district}
                    </div>
                  </div>
                </InfoWindow>
              )}
            </Map>
          </APIProvider>
        </div>
      </div>
    </div>
  );
}
