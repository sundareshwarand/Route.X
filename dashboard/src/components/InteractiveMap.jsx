import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { 
  MapPin, 
  Radio, 
  Activity, 
  ShieldAlert, 
  Clock, 
  Compass, 
  AlertTriangle, 
  CheckCircle2, 
  Maximize2, 
  Minimize2, 
  X, 
  Building2, 
  Navigation, 
  Layers, 
  ExternalLink, 
  Key, 
  RefreshCw, 
  Info, 
  ZoomIn, 
  ZoomOut, 
  Crosshair, 
  Sparkles, 
  Shield,
  Globe,
  Sliders,
  Check,
  Zap
} from 'lucide-react';
import { Loader } from '@googlemaps/js-api-loader';
import L from 'leaflet';
import { opsService } from '../services/api';

// Midnight Obsidian Tactical Palette for Google Maps Platform
const MIDNIGHT_OBSIDIAN_STYLES = [
  { elementType: "geometry", stylers: [{ color: "#0A0E17" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#0A0E17" }, { weight: 3 }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#64748b" }] },
  {
    featureType: "administrative.locality",
    elementType: "labels.text.fill",
    stylers: [{ color: "#94a3b8" }],
  },
  {
    featureType: "poi",
    elementType: "labels.text.fill",
    stylers: [{ color: "#64748b" }],
  },
  {
    featureType: "poi.park",
    elementType: "geometry",
    stylers: [{ color: "#0f172a" }],
  },
  {
    featureType: "road",
    elementType: "geometry",
    stylers: [{ color: "#1e293b" }],
  },
  {
    featureType: "road",
    elementType: "geometry.stroke",
    stylers: [{ color: "#0f172a" }],
  },
  {
    featureType: "road",
    elementType: "labels.text.fill",
    stylers: [{ color: "#94a3b8" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry",
    stylers: [{ color: "#243247" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry.stroke",
    stylers: [{ color: "#1e293b" }],
  },
  {
    featureType: "road.highway",
    elementType: "labels.text.fill",
    stylers: [{ color: "#cbd5e1" }],
  },
  {
    featureType: "transit",
    elementType: "geometry",
    stylers: [{ color: "#1e293b" }],
  },
  {
    featureType: "transit.station",
    elementType: "labels.text.fill",
    stylers: [{ color: "#94a3b8" }],
  },
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#070c14" }],
  },
  {
    featureType: "water",
    elementType: "labels.text.fill",
    stylers: [{ color: "#475569" }],
  },
];

// Official OpenStreetMap Tile Configuration (100% Free & Zero-Billing, Policy Compliant)
const OSM_TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const OSM_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors';

// Optional CARTO key check (only used if explicitly provided via VITE_CARTO_API_KEY)
const rawCartoKey = import.meta.env.VITE_CARTO_API_KEY || '';
const hasCartoKey = Boolean(
  rawCartoKey && 
  rawCartoKey.trim().length > 5 && 
  !rawCartoKey.includes('REPLACE_WITH')
);
const CARTO_DARK_TILES = hasCartoKey 
  ? `https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png?api_key=${rawCartoKey.trim()}`
  : null;
const CARTO_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions" target="_blank" rel="noreferrer">CARTO</a>';

// Google Maps SVG Icon Generators
const createGoogleJunctionIcon = (label, color, ringColor) => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="38" height="38" viewBox="0 0 38 38">
    <circle cx="19" cy="19" r="17" fill="#0A0E17" stroke="${ringColor}" stroke-width="3"/>
    <circle cx="19" cy="19" r="12" fill="${color}" fill-opacity="0.35"/>
    <text x="19" y="23" font-family="monospace" font-size="11" font-weight="bold" fill="#F8FAFC" text-anchor="middle">${label}</text>
  </svg>`;
  return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg);
};

const createGoogleHospitalIcon = (isTrauma) => {
  const borderCol = isTrauma ? '#F43F5E' : '#38BDF8';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 36 36">
    <rect x="3" y="3" width="30" height="30" rx="8" fill="#0A0E17" stroke="${borderCol}" stroke-width="2.5"/>
    <path d="M18 10v16M10 18h16" stroke="${borderCol}" stroke-width="3.5" stroke-linecap="round"/>
  </svg>`;
  return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg);
};

const createGoogleAmbulanceIcon = (heading = 0) => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">
    <circle cx="20" cy="20" r="18" fill="#EF4444" fill-opacity="0.25" stroke="#EF4444" stroke-width="2"/>
    <g transform="rotate(${heading} 20 20)">
      <polygon points="20,7 28,31 20,26 12,31" fill="#EF4444" stroke="#FFFFFF" stroke-width="2"/>
    </g>
  </svg>`;
  return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg);
};

// Leaflet Custom DivIcon Generators
const createLeafletJunctionIcon = (id, name, fillColor, ringColor, isPriority) => {
  const shortId = id.replace('JNC-', 'J');
  const pingHtml = isPriority 
    ? '<div style="position:absolute; inset:-5px; border-radius:50%; border:2px solid #34D399; opacity:0.8; animation:ping 1.5s cubic-bezier(0,0,0.2,1) infinite;"></div>' 
    : '';

  return L.divIcon({
    className: 'routex-jnc-marker',
    html: `
      <div style="position:relative; width:38px; height:38px; cursor:pointer;" title="${name} (${id})">
        ${pingHtml}
        <div style="width:38px; height:38px; border-radius:50%; background:#0A0E17; border:3px solid ${ringColor}; display:flex; align-items:center; justify-content:center; box-shadow:0 2px 10px rgba(0,0,0,0.85);">
          <div style="width:24px; height:24px; border-radius:50%; background:${fillColor}; opacity:0.4; position:absolute;"></div>
          <span style="font-family:ui-monospace, monospace; font-size:11px; font-weight:700; color:#F8FAFC; z-index:2;">${shortId}</span>
        </div>
      </div>
    `,
    iconSize: [38, 38],
    iconAnchor: [19, 19]
  });
};

const createLeafletHospitalIcon = (id, name, isTrauma) => {
  const borderCol = isTrauma ? '#F43F5E' : '#38BDF8';
  return L.divIcon({
    className: 'routex-hosp-marker',
    html: `
      <div style="width:34px; height:34px; border-radius:8px; background:#0A0E17; border:2.5px solid ${borderCol}; display:flex; align-items:center; justify-content:center; box-shadow:0 2px 10px rgba(0,0,0,0.85); cursor:pointer;" title="${name}">
        <span style="font-size:14px; line-height:1;">🏥</span>
      </div>
    `,
    iconSize: [34, 34],
    iconAnchor: [17, 17]
  });
};

const createLeafletAmbulanceIcon = (callSign, heading = 0) => {
  return L.divIcon({
    className: 'routex-amb-marker',
    html: `
      <div style="position:relative; width:44px; height:44px; display:flex; align-items:center; justify-content:center; pointer-events:none;">
        <div style="position:absolute; inset:2px; border-radius:50%; background:rgba(239,68,68,0.25); animation:ping 1.2s cubic-bezier(0,0,0.2,1) infinite;"></div>
        <div style="position:relative; width:34px; height:34px; border-radius:50%; background:#0A0E17; border:2px solid #EF4444; display:flex; align-items:center; justify-content:center; box-shadow:0 2px 12px rgba(239,68,68,0.5);">
          <div style="transform:rotate(${heading}deg); transition:transform 0.25s linear; display:flex; align-items:center; justify-content:center;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="#EF4444" stroke="#FFFFFF" stroke-width="2">
              <polygon points="12,2 22,22 12,18 2,22" />
            </svg>
          </div>
        </div>
        <div style="position:absolute; top:-16px; background:#1E293B; border:1px solid #EF4444; padding:0.5px 4px; border-radius:3px; font-family:ui-monospace, monospace; font-size:9px; font-weight:700; color:#FFFFFF; white-space:nowrap; box-shadow:0 2px 4px rgba(0,0,0,0.6);">
          ${callSign}
        </div>
      </div>
    `,
    iconSize: [44, 44],
    iconAnchor: [22, 22]
  });
};

export default function InteractiveMap({ simulationStatus, junctions: propJunctions = [], onSelectJunction }) {
  // Container References
  const googleContainerRef = useRef(null);
  const leafletContainerRef = useRef(null);

  // Instance References
  const googleMapRef = useRef(null);
  const googleMarkersRef = useRef({});
  const googleAmbulancesRef = useRef({});
  const googleHospitalsRef = useRef({});
  const googlePolylinesRef = useRef([]);

  const leafletMapRef = useRef(null);
  const leafletTileLayerRef = useRef(null);
  const leafletJunctionsRef = useRef({});
  const leafletAmbulancesRef = useRef({});
  const leafletHospitalsRef = useRef({});
  const leafletPolylinesRef = useRef([]);

  // Provider states:
  // selectedProvider: 'AUTO' | 'GOOGLE' | 'LEAFLET' | 'SVG'
  // activeProvider: 'GOOGLE_MAPS' | 'LEAFLET_OSM' | 'SVG_VECTOR'
  const [selectedProvider, setSelectedProvider] = useState('AUTO');
  const [activeProvider, setActiveProvider] = useState('LEAFLET_OSM');
  const [osmTileStyle, setOsmTileStyle] = useState('dark'); // 'dark' | 'standard'
  const [googleLoadStatus, setGoogleLoadStatus] = useState('INITIAL'); // 'INITIAL' | 'LOADING' | 'SUCCESS' | 'FAILED'
  const [providerNotification, setProviderNotification] = useState(null);

  const [isExpanded, setIsExpanded] = useState(false);
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [selectedJunction, setSelectedJunction] = useState(null);
  const [selectedHospital, setSelectedHospital] = useState(null);
  const [hospitals, setHospitals] = useState([]);

  // Layer filters
  const [layerVisibility, setLayerVisibility] = useState({
    junctions: true,
    hospitals: true,
    ambulances: true,
    corridors: true
  });

  // SVG Canvas Zoom & Pan
  const [svgZoom, setSvgZoom] = useState(1);
  const [svgPan, setSvgPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  const ambulances = simulationStatus?.ambulances || [];
  const rawJunctions = (simulationStatus?.junctions && simulationStatus.junctions.length > 0)
    ? simulationStatus.junctions
    : propJunctions;

  const junctions = useMemo(() => {
    return rawJunctions.map(j => ({
      ...j,
      lat: j.lat ?? j.latitude ?? 28.62,
      lon: j.lon ?? j.longitude ?? 77.22,
      signal_state: j.signal_state ?? j.current_signal_state ?? 'NORMAL_CYCLE'
    }));
  }, [rawJunctions]);

  const latestJunctionsRef = useRef(junctions);
  useEffect(() => {
    latestJunctionsRef.current = junctions;
  }, [junctions]);

  // Keep tactical drawer synced with live signal & telemetry updates
  useEffect(() => {
    if (!selectedJunction) return;
    const updated = junctions.find(j => j.id === selectedJunction.id);
    if (updated && (
      updated.signal_state !== selectedJunction.signal_state ||
      updated.granted_to !== selectedJunction.granted_to ||
      updated.is_online !== selectedJunction.is_online ||
      updated.queue !== selectedJunction.queue
    )) {
      setSelectedJunction(updated);
    }
  }, [junctions, selectedJunction]);

  const edges = simulationStatus?.corridor_edges || [];

  // Fetch registered hospitals from backend
  useEffect(() => {
    opsService.getHospitals().then(data => {
      if (data && Array.isArray(data)) setHospitals(data);
    }).catch(err => console.warn("Failed to load hospitals for map:", err));
  }, []);

  // Determine Google Maps Key Configuration
  const rawKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
  const isGoogleKeyPresent = Boolean(
    rawKey && 
    rawKey.trim().length > 10 && 
    !rawKey.includes('your_google_maps_api_key') && 
    !rawKey.includes('REPLACE_WITH')
  );

  // Primary Provider Arbitrator
  useEffect(() => {
    if (selectedProvider === 'SVG') {
      setActiveProvider('SVG_VECTOR');
      return;
    }

    if (selectedProvider === 'LEAFLET') {
      setActiveProvider('LEAFLET_OSM');
      return;
    }

    if (selectedProvider === 'GOOGLE') {
      if (!isGoogleKeyPresent) {
        setProviderNotification("No Google Maps Key found in dashboard/.env.local. Switched to OpenStreetMap.");
        setActiveProvider('LEAFLET_OSM');
        return;
      }
      setActiveProvider('GOOGLE_MAPS');
      return;
    }

    // AUTO mode:
    // If a Google Maps Demo Key or API Key is configured, try Google Maps; otherwise default directly to OpenStreetMap!
    if (isGoogleKeyPresent && googleLoadStatus !== 'FAILED') {
      setActiveProvider('GOOGLE_MAPS');
    } else {
      setActiveProvider('LEAFLET_OSM');
    }
  }, [selectedProvider, isGoogleKeyPresent, googleLoadStatus]);

  // -------------------------------------------------------------
  // 1. Google Maps Lifecycle
  // -------------------------------------------------------------
  useEffect(() => {
    if (activeProvider !== 'GOOGLE_MAPS' || !googleContainerRef.current) return;
    if (googleMapRef.current) return; // Already instantiated

    let isCancelled = false;
    setGoogleLoadStatus('LOADING');

    // Handle Google auth failures (billing error, quota, invalid key)
    window.gm_authFailure = () => {
      console.warn("Google Maps Auth Failure detected. Falling back to OpenStreetMap (Zero Billing).");
      setGoogleLoadStatus('FAILED');
      setProviderNotification("Google Maps key requires billing or is invalid. Automatically switched to OpenStreetMap.");
      setActiveProvider('LEAFLET_OSM');
    };

    const loader = new Loader({
      apiKey: rawKey.trim(),
      version: 'weekly',
      libraries: ['places', 'geometry']
    });

    loader.importLibrary('maps').then(() => {
      if (isCancelled || !googleContainerRef.current) return;

      try {
        const centerLat = junctions[0]?.lat || 28.6220;
        const centerLon = junctions[0]?.lon || 77.2190;

        const map = new window.google.maps.Map(googleContainerRef.current, {
          center: { lat: centerLat, lng: centerLon },
          zoom: 14,
          styles: MIDNIGHT_OBSIDIAN_STYLES,
          disableDefaultUI: true,
          zoomControl: false,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          backgroundColor: '#0A0E17'
        });

        googleMapRef.current = map;
        setGoogleLoadStatus('SUCCESS');
      } catch (err) {
        console.error("Google Maps instantiation failed:", err);
        setGoogleLoadStatus('FAILED');
        setActiveProvider('LEAFLET_OSM');
      }
    }).catch(err => {
      console.warn("Google Maps Loader failed, falling back to OpenStreetMap:", err);
      setGoogleLoadStatus('FAILED');
      setProviderNotification("Google Maps failed to load. Falling back to free OpenStreetMap tiles.");
      setActiveProvider('LEAFLET_OSM');
    });

    return () => {
      isCancelled = true;
    };
  }, [activeProvider, rawKey, junctions]);

  // Google Maps Overlays (Polylines, Junctions, Ambulances, Hospitals)
  useEffect(() => {
    if (activeProvider !== 'GOOGLE_MAPS' || !googleMapRef.current || !window.google) return;
    const map = googleMapRef.current;

    // Polylines
    googlePolylinesRef.current.forEach(p => p.setMap(null));
    googlePolylinesRef.current = [];

    if (layerVisibility.corridors) {
      const jMap = {};
      junctions.forEach(j => { jMap[j.id] = { lat: j.lat, lng: j.lon }; });

      edges.forEach(edge => {
        const p1 = jMap[edge.from];
        const p2 = jMap[edge.to];
        if (p1 && p2) {
          const isActive = edge.active;
          const poly = new window.google.maps.Polyline({
            path: [p1, p2],
            geodesic: true,
            strokeColor: isActive ? '#38BDF8' : '#243247',
            strokeOpacity: isActive ? 0.95 : 0.6,
            strokeWeight: isActive ? 5 : 3,
            map: map
          });
          googlePolylinesRef.current.push(poly);
        }
      });
    }

    // Junctions
    junctions.forEach(j => {
      const isPriority = j.signal_state === 'PRIORITY_ACTIVE';
      const isClearance = j.signal_state === 'FAILSAFE_ALL_RED';
      const isOffline = !j.is_online;

      const ringColor = isOffline ? '#475569' : isPriority ? '#34D399' : isClearance ? '#F43F5E' : '#38BDF8';
      const fillColor = isOffline ? '#1E293B' : isPriority ? '#10B981' : isClearance ? '#EF4444' : '#0284C7';
      const iconUrl = createGoogleJunctionIcon(j.id.replace('JNC-', 'J'), fillColor, ringColor);

      if (googleMarkersRef.current[j.id]) {
        googleMarkersRef.current[j.id].setIcon(iconUrl);
        googleMarkersRef.current[j.id].setPosition({ lat: j.lat, lng: j.lon });
        googleMarkersRef.current[j.id].setVisible(layerVisibility.junctions);
      } else {
        const marker = new window.google.maps.Marker({
          position: { lat: j.lat, lng: j.lon },
          map: map,
          title: `${j.name} (${j.id})`,
          icon: iconUrl,
          visible: layerVisibility.junctions
        });

        marker.addListener('click', () => {
          const latestJ = latestJunctionsRef.current.find(item => item.id === j.id) || j;
          setSelectedJunction(latestJ);
          setSelectedHospital(null);
          if (onSelectJunction) onSelectJunction(latestJ);
        });

        googleMarkersRef.current[j.id] = marker;
      }
    });

    // Ambulances
    ambulances.forEach(amb => {
      const iconUrl = createGoogleAmbulanceIcon(amb.heading || 0);

      if (googleAmbulancesRef.current[amb.id]) {
        googleAmbulancesRef.current[amb.id].setIcon(iconUrl);
        googleAmbulancesRef.current[amb.id].setPosition({ lat: amb.current_lat, lng: amb.current_lon });
        googleAmbulancesRef.current[amb.id].setVisible(layerVisibility.ambulances);
      } else {
        const marker = new window.google.maps.Marker({
          position: { lat: amb.current_lat, lng: amb.current_lon },
          map: map,
          title: `${amb.call_sign} [${amb.speed_kmh} km/h]`,
          icon: iconUrl,
          zIndex: 999,
          visible: layerVisibility.ambulances
        });
        googleAmbulancesRef.current[amb.id] = marker;
      }
    });

    // Hospitals
    hospitals.forEach(h => {
      const isTrauma = h.readiness_status === 'TRAUMA_READY';
      const iconUrl = createGoogleHospitalIcon(isTrauma);
      const lat = h.latitude + 0.0012;
      const lon = h.longitude + 0.0012;

      if (googleHospitalsRef.current[h.id]) {
        googleHospitalsRef.current[h.id].setPosition({ lat, lng: lon });
        googleHospitalsRef.current[h.id].setVisible(layerVisibility.hospitals);
      } else {
        const marker = new window.google.maps.Marker({
          position: { lat, lng: lon },
          map: map,
          title: `${h.name} [${h.readiness_status}]`,
          icon: iconUrl,
          visible: layerVisibility.hospitals
        });

        marker.addListener('click', () => {
          setSelectedHospital(h);
          setSelectedJunction(null);
        });

        googleHospitalsRef.current[h.id] = marker;
      }
    });
  }, [junctions, edges, ambulances, hospitals, activeProvider, layerVisibility]);

  // -------------------------------------------------------------
  // 2. Leaflet + OpenStreetMap Lifecycle (Zero Billing, Policy Compliant)
  // -------------------------------------------------------------
  useEffect(() => {
    if (activeProvider !== 'LEAFLET_OSM' || !leafletContainerRef.current) return;

    if (!leafletMapRef.current) {
      try {
        const centerLat = junctions[0]?.lat || 28.6220;
        const centerLon = junctions[0]?.lon || 77.2190;

        const map = L.map(leafletContainerRef.current, {
          center: [centerLat, centerLon],
          zoom: 14,
          zoomControl: false,
          attributionControl: false
        });

        // Determine Tile Provider: CARTO only if an explicit API key is configured; otherwise official OpenStreetMap
        const useCarto = Boolean(hasCartoKey && selectedProvider === 'CARTO');
        const tileUrl = useCarto ? CARTO_DARK_TILES : OSM_TILE_URL;
        const tileAttribution = useCarto ? CARTO_ATTRIBUTION : OSM_ATTRIBUTION;

        const tileLayer = L.tileLayer(tileUrl, {
          maxZoom: 19,
          attribution: tileAttribution,
          className: (!useCarto && osmTileStyle === 'dark') ? 'routex-osm-tiles-dark' : ''
        });

        tileLayer.addTo(map);
        leafletTileLayerRef.current = tileLayer;

        tileLayer.on('tileerror', (err) => {
          console.warn("Tile load error on Leaflet basemap:", err);
        });

        leafletMapRef.current = map;
      } catch (err) {
        console.error("Leaflet initialization failed, falling back to SVG:", err);
        setActiveProvider('SVG_VECTOR');
        return;
      }
    }

    // Immediate & staggered invalidateSize to handle mounting and visibility transitions
    const map = leafletMapRef.current;
    if (map) {
      map.invalidateSize();
      const t1 = setTimeout(() => map.invalidateSize(), 80);
      const t2 = setTimeout(() => map.invalidateSize(), 250);
      const t3 = setTimeout(() => map.invalidateSize(), 600);
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
        clearTimeout(t3);
      };
    }
  }, [activeProvider, junctions, selectedProvider]);

  // Handle dynamic style toggle (Dark Command Mode vs Standard OSM Colors) without reload
  useEffect(() => {
    if (!leafletTileLayerRef.current) return;
    const container = leafletTileLayerRef.current.getContainer();
    if (container) {
      if (osmTileStyle === 'dark') {
        container.classList.add('routex-osm-tiles-dark');
      } else {
        container.classList.remove('routex-osm-tiles-dark');
      }
    }
  }, [osmTileStyle]);

  // Continuous ResizeObserver to guarantee Leaflet map size is always pixel-perfect
  useEffect(() => {
    if (!leafletContainerRef.current) return;
    const ro = new ResizeObserver(() => {
      if (leafletMapRef.current) {
        leafletMapRef.current.invalidateSize();
      }
    });
    ro.observe(leafletContainerRef.current);
    return () => ro.disconnect();
  }, []);

  // Leaflet Overlays (Polylines, Junctions, Ambulances, Hospitals)
  useEffect(() => {
    if (activeProvider !== 'LEAFLET_OSM' || !leafletMapRef.current) return;
    const map = leafletMapRef.current;

    // Polylines
    leafletPolylinesRef.current.forEach(p => map.removeLayer(p));
    leafletPolylinesRef.current = [];

    if (layerVisibility.corridors) {
      const jMap = {};
      junctions.forEach(j => { jMap[j.id] = [j.lat, j.lon]; });

      edges.forEach(edge => {
        const p1 = jMap[edge.from];
        const p2 = jMap[edge.to];
        if (p1 && p2) {
          const isActive = edge.active;
          
          if (isActive) {
            const glow = L.polyline([p1, p2], {
              color: '#38BDF8',
              weight: 9,
              opacity: 0.35,
              lineCap: 'round'
            }).addTo(map);
            leafletPolylinesRef.current.push(glow);
          }

          const line = L.polyline([p1, p2], {
            color: isActive ? '#38BDF8' : '#334155',
            weight: isActive ? 4 : 2,
            opacity: isActive ? 0.95 : 0.6,
            dashArray: isActive ? null : '6, 6'
          }).addTo(map);
          leafletPolylinesRef.current.push(line);
        }
      });
    }

    // Junction Markers
    junctions.forEach(j => {
      const isPriority = j.signal_state === 'PRIORITY_ACTIVE';
      const isClearance = j.signal_state === 'FAILSAFE_ALL_RED';
      const isOffline = !j.is_online;

      const ringColor = isOffline ? '#475569' : isPriority ? '#34D399' : isClearance ? '#F43F5E' : '#38BDF8';
      const fillColor = isOffline ? '#1E293B' : isPriority ? '#10B981' : isClearance ? '#EF4444' : '#0284C7';
      const icon = createLeafletJunctionIcon(j.id, j.name, fillColor, ringColor, isPriority);

      if (leafletJunctionsRef.current[j.id]) {
        const marker = leafletJunctionsRef.current[j.id];
        marker.setIcon(icon);
        marker.setLatLng([j.lat, j.lon]);
        if (layerVisibility.junctions && !map.hasLayer(marker)) marker.addTo(map);
        if (!layerVisibility.junctions && map.hasLayer(marker)) map.removeLayer(marker);
      } else {
        const marker = L.marker([j.lat, j.lon], { icon });
        marker.on('click', () => {
          const latestJ = latestJunctionsRef.current.find(item => item.id === j.id) || j;
          setSelectedJunction(latestJ);
          setSelectedHospital(null);
          if (onSelectJunction) onSelectJunction(latestJ);
        });
        if (layerVisibility.junctions) marker.addTo(map);
        leafletJunctionsRef.current[j.id] = marker;
      }
    });

    // Ambulance Markers
    ambulances.forEach(amb => {
      const icon = createLeafletAmbulanceIcon(amb.call_sign, amb.heading || 0);
      const pos = [amb.current_lat, amb.current_lon];

      if (leafletAmbulancesRef.current[amb.id]) {
        const marker = leafletAmbulancesRef.current[amb.id];
        marker.setIcon(icon);
        marker.setLatLng(pos);
        if (layerVisibility.ambulances && !map.hasLayer(marker)) marker.addTo(map);
        if (!layerVisibility.ambulances && map.hasLayer(marker)) map.removeLayer(marker);
      } else {
        const marker = L.marker(pos, { icon, zIndexOffset: 1000 });
        if (layerVisibility.ambulances) marker.addTo(map);
        leafletAmbulancesRef.current[amb.id] = marker;
      }
    });

    // Hospital Markers
    hospitals.forEach(h => {
      const isTrauma = h.readiness_status === 'TRAUMA_READY';
      const icon = createLeafletHospitalIcon(h.id, h.name, isTrauma);
      const lat = h.latitude + 0.0012;
      const lon = h.longitude + 0.0012;

      if (leafletHospitalsRef.current[h.id]) {
        const marker = leafletHospitalsRef.current[h.id];
        marker.setIcon(icon);
        marker.setLatLng([lat, lon]);
        if (layerVisibility.hospitals && !map.hasLayer(marker)) marker.addTo(map);
        if (!layerVisibility.hospitals && map.hasLayer(marker)) map.removeLayer(marker);
      } else {
        const marker = L.marker([lat, lon], { icon });
        marker.on('click', () => {
          setSelectedHospital(h);
          setSelectedJunction(null);
        });
        if (layerVisibility.hospitals) marker.addTo(map);
        leafletHospitalsRef.current[h.id] = marker;
      }
    });
  }, [junctions, edges, ambulances, hospitals, activeProvider, layerVisibility]);

  // Invalidate sizing on container resize / expansion
  useEffect(() => {
    const timer = setTimeout(() => {
      if (leafletMapRef.current) {
        leafletMapRef.current.invalidateSize();
      }
      if (googleMapRef.current && window.google) {
        window.google.maps.event.trigger(googleMapRef.current, 'resize');
      }
    }, 320);
    return () => clearTimeout(timer);
  }, [isExpanded]);

  // Clean teardown on unmount
  useEffect(() => {
    return () => {
      if (leafletMapRef.current) {
        leafletMapRef.current.remove();
        leafletMapRef.current = null;
      }
    };
  }, []);

  // -------------------------------------------------------------
  // 3. High-Precision Tactical SVG Vector Canvas (Offline Fallback)
  // -------------------------------------------------------------
  const projectedCoordinates = useMemo(() => {
    const latMin = 28.6100;
    const latMax = 28.6330;
    const lonMin = 77.2050;
    const lonMax = 77.2350;

    const width = 840;
    const height = 500;
    const padding = 70;

    const project = (lat, lon) => {
      const x = padding + ((lon - lonMin) / (lonMax - lonMin)) * (width - 2 * padding);
      const y = height - padding - ((lat - latMin) / (latMax - latMin)) * (height - 2 * padding);
      return { 
        x: Math.max(padding, Math.min(width - padding, x)), 
        y: Math.max(padding, Math.min(height - padding, y)) 
      };
    };

    const jCoords = {};
    junctions.forEach(j => {
      jCoords[j.id] = project(j.lat || 28.62, j.lon || 77.22);
    });

    const hCoords = {};
    hospitals.forEach(h => {
      hCoords[h.id] = project((h.latitude || 28.62) + 0.0015, (h.longitude || 77.22) + 0.0015);
    });

    const ambCoords = ambulances.map(a => ({
      ...a,
      pos: project(a.current_lat || 28.62, a.current_lon || 77.22)
    }));

    return { jCoords, hCoords, ambCoords };
  }, [junctions, hospitals, ambulances]);

  // SVG Pan Handlers
  const handleMouseDown = (e) => {
    if (activeProvider !== 'SVG_VECTOR') return;
    setIsPanning(true);
    setPanStart({ x: e.clientX - svgPan.x, y: e.clientY - svgPan.y });
  };

  const handleMouseMove = (e) => {
    if (!isPanning || activeProvider !== 'SVG_VECTOR') return;
    setSvgPan({
      x: e.clientX - panStart.x,
      y: e.clientY - panStart.y
    });
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  // -------------------------------------------------------------
  // Unified Navigation Controls
  // -------------------------------------------------------------
  const handleZoomIn = () => {
    if (activeProvider === 'GOOGLE_MAPS' && googleMapRef.current) {
      googleMapRef.current.setZoom(googleMapRef.current.getZoom() + 1);
    } else if (activeProvider === 'LEAFLET_OSM' && leafletMapRef.current) {
      leafletMapRef.current.zoomIn();
    } else {
      setSvgZoom(z => Math.min(2.5, z + 0.25));
    }
  };

  const handleZoomOut = () => {
    if (activeProvider === 'GOOGLE_MAPS' && googleMapRef.current) {
      googleMapRef.current.setZoom(googleMapRef.current.getZoom() - 1);
    } else if (activeProvider === 'LEAFLET_OSM' && leafletMapRef.current) {
      leafletMapRef.current.zoomOut();
    } else {
      setSvgZoom(z => Math.max(0.75, z - 0.25));
    }
  };

  const handleFitCorridor = () => {
    if (activeProvider === 'GOOGLE_MAPS' && googleMapRef.current && window.google) {
      const bounds = new window.google.maps.LatLngBounds();
      junctions.forEach(j => bounds.extend({ lat: j.lat, lng: j.lon }));
      hospitals.forEach(h => bounds.extend({ lat: h.latitude, lng: h.longitude }));
      ambulances.forEach(a => bounds.extend({ lat: a.current_lat, lng: a.current_lon }));
      googleMapRef.current.fitBounds(bounds, { top: 50, bottom: 50, left: 50, right: 50 });
    } else if (activeProvider === 'LEAFLET_OSM' && leafletMapRef.current) {
      const latLngs = [];
      junctions.forEach(j => latLngs.push([j.lat, j.lon]));
      hospitals.forEach(h => latLngs.push([h.latitude, h.longitude]));
      ambulances.forEach(a => latLngs.push([a.current_lat, a.current_lon]));
      if (latLngs.length > 0) {
        leafletMapRef.current.fitBounds(latLngs, { padding: [50, 50], maxZoom: 16 });
      }
    } else {
      setSvgZoom(1);
      setSvgPan({ x: 0, y: 0 });
    }
  };

  return (
    <div className={`relative bg-command-panel border border-command-border rounded-xl overflow-hidden shadow-command-card flex flex-col transition-all duration-300 ${
      isExpanded ? 'h-[740px]' : 'h-[560px]'
    }`}>
      {/* Top Map Operations Command Bar */}
      <div className="px-4 py-3 bg-command-panel border-b border-command-border flex flex-wrap items-center justify-between gap-3 z-20">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-sky-500/10 border border-sky-500/30 rounded-lg text-sky-400">
            <Radio className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-xs font-bold text-slate-100 tracking-wide">
                Arterial Emergency Corridor GIS
              </h3>
              
              {/* Active Provider Badge */}
              {activeProvider === 'GOOGLE_MAPS' && (
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold border bg-emerald-500/15 text-emerald-300 border-emerald-500/30 flex items-center space-x-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                  <span>GOOGLE MAPS DEMO</span>
                </span>
              )}

              {activeProvider === 'LEAFLET_OSM' && (
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold border bg-sky-500/15 text-sky-300 border-sky-500/30 flex items-center space-x-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-sky-400"></span>
                  <span>{hasCartoKey && selectedProvider === 'CARTO' ? 'CARTO DARK MATTER' : 'OPENSTREETMAP (FREE)'}</span>
                </span>
              )}

              {activeProvider === 'SVG_VECTOR' && (
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold border bg-amber-500/15 text-amber-300 border-amber-500/30 flex items-center space-x-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                  <span>TACTICAL SVG FALLBACK</span>
                </span>
              )}
            </div>
            <p className="text-[11px] text-command-muted font-mono">
              Delhi NCR Arterial Testbed • Zero-Billing Architecture
            </p>
          </div>
        </div>

        {/* Tactical Control Buttons & Provider Dropdown */}
        <div className="flex items-center space-x-2">
          {/* Tile Palette Toggle for OpenStreetMap (Tactical Dark vs Natural OSM) */}
          {activeProvider === 'LEAFLET_OSM' && (!hasCartoKey || selectedProvider !== 'CARTO') && (
            <button
              onClick={() => setOsmTileStyle(s => s === 'dark' ? 'standard' : 'dark')}
              className="px-2.5 py-1 bg-command-surface hover:bg-command-border border border-command-border rounded-lg text-[10px] font-mono text-slate-300 hover:text-sky-300 transition flex items-center space-x-1"
              title={osmTileStyle === 'dark' ? "Switch to Standard OpenStreetMap Natural Basemap" : "Switch to Tactical Dark OpenStreetMap Mode"}
            >
              <span>{osmTileStyle === 'dark' ? '🌙 Dark Grid' : '☀️ Natural OSM'}</span>
            </button>
          )}

          {/* Provider Selector Dropdown */}
          <div className="relative">
            <select
              value={selectedProvider}
              onChange={(e) => setSelectedProvider(e.target.value)}
              className="bg-command-surface border border-command-border text-slate-200 text-[11px] font-mono rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-sky-500 transition cursor-pointer"
              title="Select Map Tile Engine"
            >
              <option value="AUTO">Provider: Auto ({activeProvider === 'GOOGLE_MAPS' ? 'Google' : activeProvider === 'LEAFLET_OSM' ? (hasCartoKey && selectedProvider === 'CARTO' ? 'CARTO' : 'OSM') : 'SVG'})</option>
              <option value="LEAFLET">OpenStreetMap (Official Free Raster)</option>
              {hasCartoKey && <option value="CARTO">CARTO Dark Matter (Key Configured)</option>}
              <option value="GOOGLE">Google Maps (Demo / Live Key)</option>
              <option value="SVG">Tactical SVG Vector (Offline)</option>
            </select>
          </div>

          {/* Layer Filter Toggles */}
          <div className="hidden sm:flex items-center bg-command-surface border border-command-border rounded-lg p-0.5 text-[11px] font-mono">
            <button
              onClick={() => setLayerVisibility(l => ({ ...l, junctions: !l.junctions }))}
              className={`px-2 py-1 rounded transition flex items-center space-x-1 ${
                layerVisibility.junctions ? 'bg-sky-500/20 text-sky-300 font-bold' : 'text-command-muted hover:text-slate-300'
              }`}
              title="Toggle Junctions"
            >
              <MapPin className="w-3 h-3" />
              <span>JNC</span>
            </button>
            <button
              onClick={() => setLayerVisibility(l => ({ ...l, hospitals: !l.hospitals }))}
              className={`px-2 py-1 rounded transition flex items-center space-x-1 ${
                layerVisibility.hospitals ? 'bg-rose-500/20 text-rose-300 font-bold' : 'text-command-muted hover:text-slate-300'
              }`}
              title="Toggle Hospitals"
            >
              <span>🏥</span>
              <span>HOSP</span>
            </button>
            <button
              onClick={() => setLayerVisibility(l => ({ ...l, corridors: !l.corridors }))}
              className={`px-2 py-1 rounded transition flex items-center space-x-1 ${
                layerVisibility.corridors ? 'bg-emerald-500/20 text-emerald-300 font-bold' : 'text-command-muted hover:text-slate-300'
              }`}
              title="Toggle Preemption Corridors"
            >
              <Navigation className="w-3 h-3" />
              <span>LINKS</span>
            </button>
          </div>

          {/* Unified Pan / Zoom Navigation Controls */}
          <div className="flex items-center space-x-1 bg-command-surface border border-command-border rounded-lg p-0.5">
            <button
              onClick={handleZoomIn}
              className="p-1.5 hover:bg-command-border text-slate-300 hover:text-sky-400 rounded transition"
              title="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleZoomOut}
              className="p-1.5 hover:bg-command-border text-slate-300 hover:text-sky-400 rounded transition"
              title="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleFitCorridor}
              className="p-1.5 hover:bg-command-border text-slate-300 hover:text-emerald-400 rounded transition"
              title="Fit Corridor Bounds & Recenter"
            >
              <Crosshair className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Expand / Minimize Toggle */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 bg-command-surface hover:bg-command-border border border-command-border text-slate-300 hover:text-sky-400 rounded-lg transition"
            title={isExpanded ? "Collapse View" : "Expand Full View"}
          >
            {isExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>

          {/* Map Config & Setup Modal */}
          <button
            onClick={() => setShowSetupModal(true)}
            className="flex items-center space-x-1.5 px-2.5 py-1.5 bg-command-surface hover:bg-command-border border border-command-border text-slate-300 hover:text-sky-400 rounded-lg text-xs font-mono transition"
            title="Map Provider Settings & Free Demo Key Guide"
          >
            <Key className="w-3.5 h-3.5 text-sky-400" />
            <span className="hidden md:inline text-[11px]">Map Config</span>
          </button>
        </div>
      </div>

      {/* Main Multi-Engine Map Canvas Viewport */}
      <div 
        className="relative flex-1 w-full h-full bg-[#0A0E17] overflow-hidden select-none"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* Tier 1: Google Maps Platform Viewport */}
        <div 
          ref={googleContainerRef} 
          className={`absolute inset-0 w-full h-full transition-opacity duration-300 ${
            activeProvider === 'GOOGLE_MAPS' ? 'opacity-100 z-10 pointer-events-auto' : 'opacity-0 z-0 pointer-events-none'
          }`} 
        />

        {/* Tier 2: Leaflet + OpenStreetMap Viewport (Zero-Billing Default) */}
        <div 
          ref={leafletContainerRef} 
          className={`absolute inset-0 w-full h-full transition-opacity duration-300 ${
            activeProvider === 'LEAFLET_OSM' ? 'opacity-100 z-10 pointer-events-auto' : 'opacity-0 z-0 pointer-events-none'
          }`} 
        />

        {/* Tier 3: Tactical High-Precision SVG Canvas Viewport (Offline) */}
        {activeProvider === 'SVG_VECTOR' && (
          <div className="absolute inset-0 w-full h-full bg-[#0A0E17] z-10 cursor-grab active:cursor-grabbing">
            <svg 
              className="w-full h-full transition-transform duration-75" 
              viewBox="0 0 840 500" 
              preserveAspectRatio="xMidYMid meet"
              style={{
                transform: `scale(${svgZoom}) translate(${svgPan.x}px, ${svgPan.y}px)`,
                transformOrigin: 'center center'
              }}
            >
              <defs>
                <filter id="neon-glow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="3.5" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
                <radialGradient id="radar-pulse" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.35" />
                  <stop offset="100%" stopColor="#38BDF8" stopOpacity="0" />
                </radialGradient>
              </defs>

              {/* Tactical Grid Background Pattern */}
              <g stroke="#1E293B" strokeWidth="0.75" opacity="0.45">
                {[...Array(12)].map((_, i) => (
                  <line key={`h-${i}`} x1="0" y1={i * 45} x2="840" y2={i * 45} />
                ))}
                {[...Array(19)].map((_, i) => (
                  <line key={`v-${i}`} x1={i * 46} y1="0" x2={i * 46} y2="500" />
                ))}
              </g>

              {/* Corridor Road Edges */}
              {layerVisibility.corridors && edges.map((edge, idx) => {
                const p1 = projectedCoordinates.jCoords[edge.from];
                const p2 = projectedCoordinates.jCoords[edge.to];
                if (!p1 || !p2) return null;

                const isActive = edge.active;
                return (
                  <g key={`edge-${idx}`}>
                    {isActive && (
                      <line
                        x1={p1.x} y1={p1.y}
                        x2={p2.x} y2={p2.y}
                        stroke="#38BDF8"
                        strokeWidth="8"
                        strokeOpacity="0.35"
                        filter="url(#neon-glow)"
                      />
                    )}
                    <line
                      x1={p1.x} y1={p1.y}
                      x2={p2.x} y2={p2.y}
                      stroke={isActive ? '#38BDF8' : '#334155'}
                      strokeWidth={isActive ? '4' : '2'}
                      strokeDasharray={isActive ? undefined : '5,5'}
                      strokeLinecap="round"
                    />
                  </g>
                );
              })}

              {/* Hospital Receiving Nodes */}
              {layerVisibility.hospitals && hospitals.map(h => {
                const pos = projectedCoordinates.hCoords[h.id];
                if (!pos) return null;
                const isTrauma = h.readiness_status === 'TRAUMA_READY';

                return (
                  <g 
                    key={`hosp-${h.id}`}
                    className="cursor-pointer transition-transform hover:scale-110"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedHospital(h);
                      setSelectedJunction(null);
                    }}
                  >
                    <rect
                      x={pos.x - 17}
                      y={pos.y - 17}
                      width="34"
                      height="34"
                      rx="8"
                      fill="#0A0E17"
                      stroke={isTrauma ? '#F43F5E' : '#38BDF8'}
                      strokeWidth="2.5"
                    />
                    <text x={pos.x} y={pos.y + 4} textAnchor="middle" fontSize="13">🏥</text>
                    <text
                      x={pos.x}
                      y={pos.y - 21}
                      textAnchor="middle"
                      fill="#E2E8F0"
                      fontSize="9"
                      fontFamily="monospace"
                      fontWeight="bold"
                    >
                      {h.name.split(' ')[0]}
                    </text>
                  </g>
                );
              })}

              {/* Junction Interlocking Nodes */}
              {layerVisibility.junctions && junctions.map(j => {
                const pos = projectedCoordinates.jCoords[j.id];
                if (!pos) return null;

                const isPriority = j.signal_state === 'PRIORITY_ACTIVE';
                const isClearance = j.signal_state === 'FAILSAFE_ALL_RED';
                const isOffline = !j.is_online;

                const strokeCol = isOffline ? '#475569' : isPriority ? '#34D399' : isClearance ? '#F43F5E' : '#38BDF8';
                const fillCol = isOffline ? '#1E293B' : isPriority ? '#064E3B' : isClearance ? '#4C0519' : '#0B2342';

                return (
                  <g 
                    key={`jnc-${j.id}`}
                    className="cursor-pointer group"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedJunction(j);
                      setSelectedHospital(null);
                      if (onSelectJunction) onSelectJunction(j);
                    }}
                  >
                    {isPriority && (
                      <circle
                        cx={pos.x} cy={pos.y}
                        r="26"
                        fill="none"
                        stroke="#34D399"
                        strokeWidth="1.5"
                        opacity="0.6"
                        className="animate-ping"
                      />
                    )}
                    <circle
                      cx={pos.x} cy={pos.y}
                      r="17"
                      fill={fillCol}
                      stroke={strokeCol}
                      strokeWidth="2.5"
                    />
                    <text
                      x={pos.x} y={pos.y + 4}
                      textAnchor="middle"
                      fill="#F8FAFC"
                      fontSize="10"
                      fontFamily="monospace"
                      fontWeight="bold"
                    >
                      {j.id.replace('JNC-', 'J')}
                    </text>
                    <text
                      x={pos.x} y={pos.y + 30}
                      textAnchor="middle"
                      fill="#94A3B8"
                      fontSize="9"
                      fontFamily="monospace"
                    >
                      {j.name.split(' ')[0]}
                    </text>
                  </g>
                );
              })}

              {/* Active Ambulance Marker */}
              {layerVisibility.ambulances && projectedCoordinates.ambCoords.map(amb => (
                <g key={`amb-${amb.id}`} transform={`translate(${amb.pos.x}, ${amb.pos.y})`}>
                  <circle cx="0" cy="0" r="22" fill="url(#radar-pulse)" className="animate-ping" />
                  <circle cx="0" cy="0" r="14" fill="#EF4444" stroke="#FFFFFF" strokeWidth="2" />
                  <polygon
                    points="0,-7 6,7 0,4 -6,7"
                    fill="#FFFFFF"
                    transform={`rotate(${amb.heading || 0})`}
                  />
                  <rect x="-35" y="-30" width="70" height="15" rx="3" fill="#1E293B" stroke="#EF4444" strokeWidth="1" />
                  <text x="0" y="-20" textAnchor="middle" fill="#FFFFFF" fontSize="8" fontFamily="monospace" fontWeight="bold">
                    {amb.call_sign}
                  </text>
                </g>
              ))}

              {/* Tactical Scale Indicator */}
              <g transform="translate(30, 470)" stroke="#64748B" strokeWidth="1">
                <line x1="0" y1="0" x2="60" y2="0" />
                <line x1="0" y1="-4" x2="0" y2="4" />
                <line x1="60" y1="-4" x2="60" y2="4" />
                <text x="30" y="-6" textAnchor="middle" fill="#64748B" fontSize="8" fontFamily="monospace" stroke="none">500 METERS</text>
              </g>

              {/* Compass Rose */}
              <g transform="translate(805, 35)">
                <circle cx="0" cy="0" r="14" fill="#111827" stroke="#334155" strokeWidth="1" />
                <polygon points="0,-11 3,0 0,-3 -3,0" fill="#38BDF8" />
                <polygon points="0,11 3,0 0,3 -3,0" fill="#64748B" />
                <text x="0" y="-13" textAnchor="middle" fill="#38BDF8" fontSize="7" fontFamily="monospace" fontWeight="bold">N</text>
              </g>
            </svg>
          </div>
        )}

        {/* Temporary Notification Toast */}
        {providerNotification && (
          <div className="absolute top-3 inset-x-4 z-30 flex items-center justify-between p-2.5 bg-sky-950/95 border border-sky-800/80 rounded-lg text-xs text-sky-200 backdrop-blur-md shadow-xl animate-fade-in">
            <div className="flex items-center space-x-2">
              <Info className="w-4 h-4 text-sky-400 flex-shrink-0" />
              <span>{providerNotification}</span>
            </div>
            <button
              onClick={() => setProviderNotification(null)}
              className="text-sky-300 hover:text-white p-1 transition"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Floating Ambulance Telemetry Overlay Card */}
        {ambulances.length > 0 && (
          <div className="absolute top-4 left-4 z-20 max-w-xs bg-command-panel/95 backdrop-blur-md border border-command-border rounded-xl p-3 shadow-command-card space-y-2">
            <div className="flex items-center justify-between pb-2 border-b border-command-border">
              <div className="flex items-center space-x-2">
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping"></span>
                <span className="font-mono text-xs font-bold text-slate-100">{ambulances[0].call_sign}</span>
              </div>
              <span className="px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 font-mono text-[10px] font-bold border border-rose-500/30">
                {ambulances[0].triage_priority}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
              <div>
                <span className="text-command-muted block text-[10px]">CURRENT SPEED</span>
                <span className="text-sky-400 font-bold">{ambulances[0].speed_kmh} km/h</span>
              </div>
              <div>
                <span className="text-command-muted block text-[10px]">CORRIDOR ETA</span>
                <span className="text-amber-400 font-bold">{ambulances[0].eta_seconds}s</span>
              </div>
              <div>
                <span className="text-command-muted block text-[10px]">NEXT JUNCTION</span>
                <span className="text-slate-100 font-bold">{ambulances[0].approaching_junction}</span>
              </div>
              <div>
                <span className="text-command-muted block text-[10px]">DISTANCE</span>
                <span className="text-slate-300">{Math.round(ambulances[0].distance_to_junction || 0)}m</span>
              </div>
            </div>

            <div className="pt-1 text-[10px] text-command-muted flex items-center justify-between border-t border-command-border/50">
              <span>Status: <strong className="text-emerald-400">{ambulances[0].status}</strong></span>
              <span className="text-command-subtext">Leg {ambulances[0].current_leg_index + 1}/{ambulances[0].route?.length}</span>
            </div>
          </div>
        )}

        {/* Selected Junction Tactical Inspector Drawer */}
        {selectedJunction && (
          <div className="absolute bottom-4 right-4 z-20 w-84 bg-command-panel/95 backdrop-blur-md border border-command-border rounded-xl p-4 shadow-command-card space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <h4 className="font-bold text-xs text-slate-100">{selectedJunction.name}</h4>
                <p className="font-mono text-[10px] text-command-muted">ID: {selectedJunction.id} | Zone: {selectedJunction.zone}</p>
              </div>
              <button 
                onClick={() => setSelectedJunction(null)}
                className="text-command-muted hover:text-slate-100 p-1 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-2.5 bg-command-surface rounded-lg border border-command-border/70 space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-command-subtext">Signal State:</span>
                <span className={`font-mono font-bold ${
                  selectedJunction.signal_state === 'PRIORITY_ACTIVE' ? 'text-emerald-400' :
                  selectedJunction.signal_state === 'FAILSAFE_ALL_RED' ? 'text-rose-400' : 'text-sky-400'
                }`}>
                  {selectedJunction.signal_state}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-command-subtext">Current Priority:</span>
                <span className="font-mono text-slate-200">{selectedJunction.granted_to || 'None (Normal Cycle)'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-command-subtext">Queued Vehicles:</span>
                <span className="font-mono text-amber-400">
                  {Array.isArray(selectedJunction.queue) 
                    ? selectedJunction.queue.length 
                    : (typeof selectedJunction.queue === 'number' 
                        ? selectedJunction.queue 
                        : (selectedJunction.queue ? 1 : 0))}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-command-subtext">Gateway Status:</span>
                <span className={selectedJunction.is_online ? 'text-emerald-400 font-semibold' : 'text-rose-400 font-semibold'}>
                  {selectedJunction.is_online ? 'ESP8266 Online' : 'Heartbeat Lost'}
                </span>
              </div>
            </div>

            <div className="text-[10px] text-command-muted font-mono flex items-center justify-between">
              <span>GPS: {selectedJunction.lat?.toFixed(4)}, {selectedJunction.lon?.toFixed(4)}</span>
              <span className="text-sky-400">Interlocked Controller</span>
            </div>
          </div>
        )}

        {/* Selected Hospital Tactical Inspector Drawer */}
        {selectedHospital && (
          <div className="absolute bottom-4 left-4 z-20 w-84 bg-command-panel/95 backdrop-blur-md border border-command-border rounded-xl p-4 shadow-command-card space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center space-x-1.5">
                  <span className="text-base">🏥</span>
                  <h4 className="font-bold text-xs text-slate-100">{selectedHospital.name}</h4>
                </div>
                <p className="font-mono text-[10px] text-command-muted">ID: {selectedHospital.id} • At {selectedHospital.junction_id}</p>
              </div>
              <button 
                onClick={() => setSelectedHospital(null)}
                className="text-command-muted hover:text-slate-100 p-1 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-2.5 bg-command-surface rounded-lg border border-command-border/70 space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-command-subtext">Readiness Status:</span>
                <span className={`font-mono font-bold ${
                  selectedHospital.readiness_status === 'TRAUMA_READY' ? 'text-rose-400' : 'text-sky-400'
                }`}>
                  {selectedHospital.readiness_status}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-command-subtext">Available ICU Beds:</span>
                <span className="font-mono font-bold text-emerald-400">{selectedHospital.available_icu_beds} / {selectedHospital.total_icu_beds}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-command-subtext">Specialties:</span>
                <span className="text-slate-200 text-[11px] truncate max-w-[180px]" title={selectedHospital.specialties}>
                  {selectedHospital.specialties || 'Emergency Medicine'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-command-subtext">Patient Intake:</span>
                <span className={selectedHospital.is_accepting_emergencies ? 'text-emerald-400 font-semibold' : 'text-rose-400 font-semibold'}>
                  {selectedHospital.is_accepting_emergencies ? 'ACCEPTING PATIENTS' : 'DIVERTING'}
                </span>
              </div>
            </div>

            <div className="text-[10px] text-command-muted font-mono flex items-center justify-between">
              <span>GPS: {selectedHospital.latitude?.toFixed(4)}, {selectedHospital.longitude?.toFixed(4)}</span>
              <span className="text-sky-400">Receiving Trauma Hub</span>
            </div>
          </div>
        )}
      </div>

      {/* Attribution & Legend Footer Strip */}
      <div className="px-4 py-2 bg-command-panel/90 border-t border-command-border/60 flex flex-wrap items-center justify-between gap-2 text-[10px] text-command-muted z-20">
        <div className="flex items-center space-x-3">
          <span>
            {activeProvider === 'GOOGLE_MAPS' && 'Map data © Google Maps Platform • Midnight Obsidian Arterial Layer'}
            {activeProvider === 'LEAFLET_OSM' && (
              hasCartoKey && selectedProvider === 'CARTO'
                ? 'Basemap tiles © CARTO & OpenStreetMap contributors • Key Authenticated'
                : <>Map data &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" className="underline hover:text-slate-200">OpenStreetMap</a> contributors • RouteX Emergency GIS</>
            )}
            {activeProvider === 'SVG_VECTOR' && 'RouteX High-Precision Vector Canvas • Delhi NCR Arterial Testbed • Offline Fallback'}
          </span>
        </div>

        <div className="flex items-center space-x-4 font-mono">
          <span className="flex items-center space-x-1">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span>Priority Wave</span>
          </span>
          <span className="flex items-center space-x-1">
            <span className="w-2 h-2 rounded-full bg-rose-400"></span>
            <span>2s All-Red</span>
          </span>
          <span className="flex items-center space-x-1">
            <span className="w-2 h-2 rounded-full bg-sky-400"></span>
            <span>Normal Cycle</span>
          </span>
          <span className="text-sky-400 font-semibold uppercase">Authoritative Interlock</span>
        </div>
      </div>

      {/* Map Setup & Zero-Billing Modal */}
      {showSetupModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-command-panel border border-command-border rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-command-border">
              <div className="flex items-center space-x-2">
                <div className="p-2 bg-sky-500/10 border border-sky-500/20 rounded-lg text-sky-400">
                  <Globe className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-100">RouteX Zero-Billing GIS Architecture</h3>
                  <p className="text-[11px] text-command-muted">OpenStreetMap (Default) &amp; Google Maps Demo Key</p>
                </div>
              </div>
              <button 
                onClick={() => setShowSetupModal(false)}
                className="text-command-muted hover:text-slate-100 p-1 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs text-slate-300">
              <div className="p-3 bg-emerald-950/40 border border-emerald-800/40 rounded-xl space-y-1">
                <div className="flex items-center space-x-1.5 text-emerald-300 font-semibold">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Zero Billing Guarantee Active</span>
                </div>
                <p className="text-[11px] text-emerald-200/90 leading-relaxed">
                  RouteX operates completely free with official <strong>OpenStreetMap raster tiles (tile.openstreetmap.org)</strong>. You never need to add a payment method, credit card, or approve any billing.
                </p>
              </div>

              <div className="space-y-2">
                <h4 className="font-bold text-slate-200 text-xs flex items-center space-x-1.5">
                  <Key className="w-3.5 h-3.5 text-sky-400" />
                  <span>Want to try Google Maps without billing?</span>
                </h4>
                <p className="text-[11px] leading-relaxed text-slate-400">
                  Google provides an official <strong className="text-slate-200">Maps Demo Key</strong> for prototyping and learning without requiring any Google Cloud billing account or credit card:
                </p>

                <div className="p-3 bg-command-surface rounded-lg border border-command-border space-y-2 font-mono text-[11px]">
                  <div className="flex items-center justify-between">
                    <span className="text-sky-300 font-bold">1. Google Maps Demo Key Portal:</span>
                    <a 
                      href="https://developers.google.com/maps/documentation/javascript/demo-key" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-sky-400 hover:text-sky-300 flex items-center space-x-1 text-[10px] underline"
                    >
                      <span>Open Portal</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                  <p className="text-[10px] text-command-muted">
                    Sign in with any Google account, agree to terms, and obtain your free demo key.
                  </p>
                  <div>
                    <span className="text-slate-300 block mb-1">2. Add to <code className="text-amber-300">dashboard/.env.local</code>:</span>
                    <div className="bg-black/50 p-2 rounded text-emerald-300 select-all text-[10px]">
                      VITE_GOOGLE_MAPS_API_KEY=AIzaSy...your_demo_key
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-2.5 bg-sky-950/40 border border-sky-800/40 rounded-lg text-[10px] text-sky-300/90 flex items-center space-x-2">
                <Shield className="w-4 h-4 flex-shrink-0 text-sky-400" />
                <span>If no demo key is added, RouteX automatically continues running OpenStreetMap or the tactical SVG vector fallback seamlessly.</span>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setShowSetupModal(false)}
                className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-lg text-xs font-mono transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
