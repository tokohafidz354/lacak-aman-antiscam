import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import {
  Activity, AlertTriangle, ArrowDownRight, ArrowUpRight, BadgeCheck, BookOpen,
  CheckCircle2, ChevronDown, CircleHelp, Clock3, ExternalLink, FileCheck2, FileSearch,
  Files, Globe, LayoutDashboard, LockKeyhole, MapPin, Menu, MessageSquareWarning,
  Navigation, Phone, Plus, Search, ShieldAlert, ShieldCheck, Smartphone, Trash2,
  Upload, X, Download, Eye, Ban,
} from "lucide-react";

type Page = "dashboard" | "numbers" | "cases" | "map" | "guide";
type CheckStatus = "Belum diperiksa" | "Ada laporan" | "Belum ditemukan pada sumber yang diperiksa" | "Gagal diperiksa";
type NumberRecord = { id: string; phone: string; label: string; status: CheckStatus; checkedAt?: string; source?: string; note?: string };
type Evidence = { id: string; name: string; size: number; type: string; hash: string; addedAt: string; url: string };
type CaseRecord = { id: string; title: string; kind: string; status: "Baru" | "Ditinjau" | "Dilaporkan" | "Selesai"; date: string; summary: string; phone: string; evidence: Evidence[] };
type GeoPoint = { latitude: number; longitude: number; accuracy: number; capturedAt: string };
type GeoSession = { point: GeoPoint; expiresAt: string } | null;

const SOURCES = [
  { name: "AduanNomor", desc: "Pemeriksaan dan pelaporan nomor seluler", url: "https://aduannomor.id/", icon: Phone },
  { name: "CekRekening", desc: "Pemeriksaan dan pelaporan rekening", url: "https://cekrekening.id/", icon: ShieldCheck },
  { name: "Indonesia Anti-Scam Centre", desc: "Pelaporan penipuan transaksi keuangan", url: "https://iasc.ojk.go.id/", icon: BadgeCheck },
];
const NAV: { id: Page; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "dashboard", label: "Ringkasan", icon: LayoutDashboard },
  { id: "numbers", label: "Pemeriksaan Nomor", icon: FileSearch },
  { id: "cases", label: "Kasus & Bukti", icon: Files },
  { id: "map", label: "Peta Lokasi", icon: MapPin },
  { id: "guide", label: "Panduan Pelaporan", icon: BookOpen },
];
const STORAGE_KEY = "lacak-aman-mvp-v1";
const nowId = () => globalThis.crypto?.randomUUID?.() ?? \`id-\${Date.now()}-\${Math.random().toString(16).slice(2)}\`;
const dateTime = (date: string) => new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(new Date(date));
const prettySize = (bytes: number) => bytes < 1024 ? \`\${bytes} B\` : bytes < 1024 ** 2 ? \`\${(bytes / 1024).toFixed(1)} KB\` : \`\${(bytes / (1024 ** 2)).toFixed(1)} MB\`;
function normalizePhone(raw: string) {
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("0062")) return "+" + digits.slice(2);
  if (digits.startsWith("62")) return "+" + digits;
  if (digits.startsWith("0")) return "+62" + digits.slice(1);
  if (digits.startsWith("8")) return "+62" + digits;
  return "+" + digits;
}
function validIndonesianPhone(value: string) { return /^\+628[1-9][0-9]{6,11}$/.test(value); }
function safeText(value: string, max = 4000) { return value.trim().slice(0, max); }

function useLocalStore() {
  const [numbers, setNumbers] = useState<NumberRecord[]>([]);
  const [cases, setCases] = useState<CaseRecord[]>([]);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { numbers?: NumberRecord[]; cases?: CaseRecord[] };
        setNumbers(Array.isArray(parsed.numbers) ? parsed.numbers : []);
        setCases(Array.isArray(parsed.cases) ? parsed.cases : []);
      }
    } catch { /* Invalid local data is ignored. */ }
    setLoaded(true);
  }, []);
  useEffect(() => {
    if (loaded) {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ numbers, cases })); } catch { /* Storage may be unavailable. */ }
    }
  }, [numbers, cases, loaded]);
  return { numbers, setNumbers, cases, setCases };
}

function IconButton({ children, onClick, title, className = "" }: { children: ReactNode; onClick?: () => void; title: string; className?: string }) {
  return <button className={\`icon-button \${className}\`} type="button" title={title} aria-label={title} onClick={onClick}>{children}</button>;
}
function Button({ children, onClick, type = "button", variant = "primary", disabled, className = "" }: { children: ReactNode; onClick?: () => void; type?: "button" | "submit"; variant?: "primary" | "outline" | "quiet" | "danger"; disabled?: boolean; className?: string }) {
  return <button type={type} onClick={onClick} disabled={disabled} className={\`btn btn-\${variant} \${className}\`}>{children}</button>;
}
function Pill({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "success" | "warning" | "danger" | "blue" }) {
  return <span className={\`pill pill-\${tone}\`}>{children}</span>;
}
function SectionHead({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description?: string; action?: ReactNode }) {
  return <div className="section-head"><div>{eyebrow && <div className="eyebrow">{eyebrow}</div>}<h1>{title}</h1>{description && <p>{description}</p>}</div>{action && <div className="section-action">{action}</div>}</div>;
}
function EmptyState({ icon: Icon = Files, title, body, action }: { icon?: typeof Files; title: string; body: string; action?: ReactNode }) {
  return <div className="empty-state"><div className="empty-icon"><Icon size={22}/></div><strong>{title}</strong><p>{body}</p>{action}</div>;
}
function ToneForStatus({ status }: { status: string }) {
  if (status === "Ada laporan" || status === "Dilaporkan") return <Pill tone="danger">{status}</Pill>;
  if (status === "Ditinjau" || status === "Belum diperiksa") return <Pill tone="warning">{status}</Pill>;
  if (status === "Selesai" || status === "Belum ditemukan pada sumber yang diperiksa") return <Pill tone="success">{status}</Pill>;
  if (status === "Gagal diperiksa") return <Pill tone="neutral">{status}</Pill>;
  return <Pill>{status}</Pill>;
}

export default function App() {
  const [page, setPage] = useState<Page>("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState("");
  const [showNumberForm, setShowNumberForm] = useState(false);
  const [showCaseForm, setShowCaseForm] = useState(false);
  const [gpsConsent, setGpsConsent] = useState(false);
  const store = useLocalStore();
  const [geoSession, setGeoSession] = useState<GeoSession>(null);
  const [geoError, setGeoError] = useState("");
  const [busyGps, setBusyGps] = useState(false);
  const notify = (message: string) => { setToast(message); window.setTimeout(() => setToast(""), 3600); };
  const pageTitle = NAV.find(n => n.id === page)?.label ?? "Ringkasan";
  const filteredNumbers = useMemo(() => store.numbers.filter(n => (n.phone + " " + n.label + " " + n.status).toLowerCase().includes(search.toLowerCase())), [store.numbers, search]);
  const filteredCases = useMemo(() => store.cases.filter(c => (c.title + " " + c.kind + " " + c.phone + " " + c.status).toLowerCase().includes(search.toLowerCase())), [store.cases, search]);
  const activeCases = store.cases.filter(c => c.status !== "Selesai").length;
  const reportedNumbers = store.numbers.filter(n => n.status === "Ada laporan").length;

  function navigate(next: Page) { setPage(next); setSidebarOpen(false); setSearch(""); }
  function saveNumber(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const phone = normalizePhone(String(form.get("phone") ?? ""));
    const label = safeText(String(form.get("label") ?? ""), 80);
    if (!validIndonesianPhone(phone)) { notify("Format nomor belum valid. Masukkan nomor seluler Indonesia yang benar."); return; }
    if (store.numbers.some(n => n.phone === phone)) { notify("Nomor ini sudah tercatat. Buka datanya untuk menambah pemeriksaan."); return; }
    store.setNumbers(prev => [{ id: nowId(), phone, label: label || "Nomor belum diberi label", status: "Belum diperiksa" }, ...prev]);
    setShowNumberForm(false);
    notify("Nomor ditambahkan. Periksa sumber resmi lalu catat hasilnya.");
  }
  function saveCheck(event: FormEvent<HTMLFormElement>, record: NumberRecord) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const source = String(form.get("source") ?? "");
    const status = String(form.get("status") ?? "Belum diperiksa") as CheckStatus;
    const note = safeText(String(form.get("note") ?? ""));
    store.setNumbers(prev => prev.map(n => n.id === record.id ? { ...n, source, status, note, checkedAt: new Date().toISOString() } : n));
    notify("Catatan pemeriksaan disimpan di browser ini.");
  }
  function saveCase(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const title = safeText(String(form.get("title") ?? ""), 120);
    const phoneRaw = safeText(String(form.get("phone") ?? ""), 80);
    const phone = phoneRaw ? normalizePhone(phoneRaw) : "";
    if (!title) { notify("Judul kasus wajib diisi."); return; }
    if (phone && !validIndonesianPhone(phone)) { notify("Nomor terkait belum dalam format yang valid."); return; }
    const record: CaseRecord = { id: nowId(), title, kind: String(form.get("kind") ?? "Penipuan online"), status: "Baru", date: String(form.get("date") || new Date().toISOString().slice(0, 10)), summary: safeText(String(form.get("summary") ?? "")), phone, evidence: [] };
    store.setCases(prev => [record, ...prev]);
    if (phone && !store.numbers.some(n => n.phone === phone)) store.setNumbers(prev => [{ id: nowId(), phone, label: "Terkait kasus: " + title, status: "Belum diperiksa" }, ...prev]);
    setShowCaseForm(false);
    notify("Kasus disimpan di penyimpanan lokal browser.");
  }
  async function addEvidence(caseId: string, file?: File) {
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp", "application/pdf", "text/plain"].includes(file.type)) { notify("Jenis file tidak didukung. Gunakan PNG, JPG, WEBP, PDF, atau TXT."); return; }
    if (file.size > 8 * 1024 * 1024) { notify("Ukuran file maksimum 8 MB."); return; }
    let hash = "Hash tidak tersedia";
    try { const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer()); hash = Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, "0")).join(""); } catch { /* optional */ }
    const item: Evidence = { id: nowId(), name: file.name, size: file.size, type: file.type, hash, addedAt: new Date().toISOString(), url: URL.createObjectURL(file) };
    store.setCases(prev => prev.map(c => c.id === caseId ? { ...c, evidence: [...c.evidence, item] } : c));
    notify("Bukti ditambahkan untuk sesi browser ini. File belum diunggah ke server.");
  }
  function removeEvidence(caseId: string, evidenceId: string) {
    store.setCases(prev => prev.map(c => c.id === caseId ? { ...c, evidence: c.evidence.filter(e => e.id !== evidenceId) } : c));
    notify("Referensi bukti dihapus dari daftar kasus lokal.");
  }
  function setCaseStatus(caseId: string, status: CaseRecord["status"]) { store.setCases(prev => prev.map(c => c.id === caseId ? { ...c, status } : c)); }
  function deleteCase(id: string) {
    if (!window.confirm("Hapus kasus dan metadata bukti dari browser ini? Tindakan ini tidak dapat dibatalkan.")) return;
    store.setCases(prev => prev.filter(c => c.id !== id));
    notify("Kasus dihapus dari penyimpanan lokal.");
  }
  function exportCase(record: CaseRecord) {
    const evidenceText = record.evidence.map((e, i) => \`\${i + 1}. \${e.name} | \${prettySize(e.size)} | SHA-256: \${e.hash} | ditambahkan: \${dateTime(e.addedAt)}\`).join("\\n") || "Belum ada lampiran.";
    const content = \`LAPORAN KASUS — LACAK AMAN\\n\\nID Kasus: \${record.id}\\nJudul: \${record.title}\\nJenis: \${record.kind}\\nStatus: \${record.status}\\nTanggal kejadian: \${record.date}\\nNomor terkait: \${record.phone || "Tidak dicatat"}\\n\\nKRONOLOGI / RINGKASAN\\n\${record.summary || "Belum ada kronologi."}\\n\\nBUKTI DIGITAL\\n\${evidenceText}\\n\\nCATATAN: Dokumen ini dibuat dari catatan lokal pengguna. Hash membantu memeriksa perubahan file, bukan jaminan keabsahan hukum. Status laporan bukan penetapan bahwa pihak tertentu bersalah.\\nDibuat: \${dateTime(new Date().toISOString())}\\n\`;
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = \`laporan-\${record.id.slice(0, 8)}.txt\`; a.click(); URL.revokeObjectURL(url);
  }
  function startGps() {
    setGeoError("");
    if (!gpsConsent) { setGeoError("Centang persetujuan terlebih dahulu sebelum mengambil lokasi perangkat ini."); return; }
    if (!("geolocation" in navigator)) { setGeoError("Browser ini tidak mendukung akses lokasi."); return; }
    setBusyGps(true);
    navigator.geolocation.getCurrentPosition(position => {
      const capturedAt = new Date(position.timestamp || Date.now()).toISOString();
      setGeoSession({ point: { latitude: position.coords.latitude, longitude: position.coords.longitude, accuracy: position.coords.accuracy, capturedAt }, expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString() });
      setBusyGps(false); notify("Koordinat perangkat ini dibaca setelah izin diberikan. Belum dibagikan ke server.");
    }, error => {
      const messages: Record<number, string> = { 1: "Izin lokasi ditolak. Aktifkan izin lokasi browser jika ingin mencoba kembali.", 2: "Posisi tidak tersedia. Periksa GPS dan koneksi perangkat.", 3: "Permintaan lokasi melewati batas waktu." };
      setGeoError(messages[error.code] ?? "Lokasi tidak berhasil dibaca."); setBusyGps(false);
    }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
  }

  return <div className="app-shell">
    {sidebarOpen && <button className="mobile-scrim" aria-label="Tutup menu" onClick={() => setSidebarOpen(false)} />}
    <aside className={\`sidebar \${sidebarOpen ? "sidebar-open" : ""}\`}>
      <div className="brand"><div className="brand-mark"><ShieldCheck size={22}/></div><div><div className="brand-name">lacak<span>aman</span></div><div className="brand-sub">ANTI-SCAM WORKSPACE</div></div><IconButton title="Tutup navigasi" className="mobile-close" onClick={() => setSidebarOpen(false)}><X size={18}/></IconButton></div>
      <div className="workspace-label">WORKSPACE</div>
      <nav className="nav-list" aria-label="Navigasi utama">{NAV.map(item => { const Icon = item.icon; return <button key={item.id} className={\`nav-item \${page === item.id ? "nav-active" : ""}\`} onClick={() => navigate(item.id)}><Icon size={18}/><span>{item.label}</span>{item.id === "cases" && store.cases.length > 0 && <span className="nav-count">{store.cases.length}</span>}</button>; })}</nav>
      <div className="sidebar-spacer"/>
      <div className="sidebar-notice"><div className="notice-icon"><LockKeyhole size={16}/></div><strong>Privasi pertama</strong><p>Data pada versi awal tersimpan di browser ini. Belum ada sinkronisasi server.</p></div>
      <div className="sidebar-bottom"><div className="avatar">LA</div><div className="user-info"><strong>Pengguna lokal</strong><span>Mode lokal · MVP</span></div><Pill tone="warning">Lokal</Pill></div>
      <div className="sidebar-version">LACAK AMAN <span>v0.1.0</span></div>
    </aside>
    <main className="main-area">
      <header className="topbar"><div className="topbar-left"><IconButton title="Buka navigasi" className="mobile-menu" onClick={() => setSidebarOpen(true)}><Menu size={19}/></IconButton><div className="breadcrumb">Workspace <span>/</span> <strong>{pageTitle}</strong></div></div><div className="topbar-right"><div className="connection-state"><span className="dot dot-amber"/><span>Data lokal</span></div><div className="topbar-divider"/><IconButton title="Informasi aplikasi" onClick={() => navigate("guide")}><CircleHelp size={18}/></IconButton><div className="top-avatar">LA</div></div></header>
      <div className="page-wrap">
        {page === "dashboard" && <Dashboard cases={store.cases} numbers={store.numbers} activeCases={activeCases} reportedNumbers={reportedNumbers} onNavigate={navigate} onNewCase={() => setShowCaseForm(true)} onNewNumber={() => setShowNumberForm(true)} />}
        {page === "numbers" && <NumbersPage numbers={filteredNumbers} allCount={store.numbers.length} search={search} setSearch={setSearch} onAdd={() => setShowNumberForm(true)} onSaveCheck={saveCheck} onDelete={id => { if (window.confirm("Hapus catatan nomor dari browser ini?")) store.setNumbers(prev => prev.filter(n => n.id !== id)); }} />}
        {page === "cases" && <CasesPage cases={filteredCases} allCount={store.cases.length} search={search} setSearch={setSearch} onAdd={() => setShowCaseForm(true)} onEvidence={addEvidence} onRemoveEvidence={removeEvidence} onStatus={setCaseStatus} onDelete={deleteCase} onExport={exportCase} />}
        {page === "map" && <MapPage consent={gpsConsent} setConsent={setGpsConsent} session={geoSession} error={geoError} busy={busyGps} onStart={startGps} onStop={() => { setGeoSession(null); setGpsConsent(false); setGeoError(""); notify("Sesi lokasi lokal dihentikan."); }} />}
        {page === "guide" && <GuidePage />}
        <footer className="page-footer"><span>© 2026 Lacak Aman · Alat bantu investigasi awal</span><span><LockKeyhole size={12}/> Jangan gunakan untuk memantau perangkat orang lain tanpa izin.</span></footer>
      </div>
    </main>
    {showNumberForm && <Modal title="Tambahkan nomor" subtitle="Catat nomor yang perlu diperiksa. Tidak ada pencarian otomatis." onClose={() => setShowNumberForm(false)}><form className="form-stack" onSubmit={saveNumber}><label>Nomor HP <span className="required">*</span><input name="phone" autoFocus placeholder="08xx atau +628xx" required maxLength={24}/><small>Nomor dinormalisasi ke format internasional +62.</small></label><label>Label / konteks<input name="label" placeholder="Contoh: nomor pengirim pesan mencurigakan" maxLength={80}/></label><div className="form-info"><AlertTriangle size={16}/> Menambahkan nomor bukan berarti nomor tersebut terbukti melakukan penipuan.</div><div className="form-actions"><Button variant="outline" onClick={() => setShowNumberForm(false)}>Batal</Button><Button type="submit"><Plus size={16}/> Simpan nomor</Button></div></form></Modal>}
    {showCaseForm && <Modal title="Buat kasus baru" subtitle="Dokumentasikan kejadian dengan data yang Anda ketahui." onClose={() => setShowCaseForm(false)}><form className="form-stack" onSubmit={saveCase}><label>Judul kasus <span className="required">*</span><input name="title" autoFocus required placeholder="Contoh: Pesan WhatsApp mengaku petugas bank" maxLength={120}/></label><div className="form-grid"><label>Jenis kejadian<select name="kind"><option>Penipuan online</option><option>Pengambilalihan WhatsApp</option><option>Penipuan transaksi</option><option>Phishing / tautan mencurigakan</option><option>Penyalahgunaan nomor</option><option>Lainnya</option></select></label><label>Tanggal kejadian<input name="date" type="date" defaultValue={new Date().toISOString().slice(0,10)}/></label></div><label>Nomor terkait (opsional)<input name="phone" placeholder="08xx atau +628xx" maxLength={24}/></label><label>Kronologi / ringkasan<textarea name="summary" rows={4} placeholder="Apa yang terjadi? Cantumkan waktu, media, dan tindakan yang telah dilakukan." maxLength={4000}/></label><div className="form-info"><LockKeyhole size={16}/> Catatan disimpan di penyimpanan lokal browser ini. Belum dicadangkan ke server.</div><div className="form-actions"><Button variant="outline" onClick={() => setShowCaseForm(false)}>Batal</Button><Button type="submit"><Plus size={16}/> Buat kasus</Button></div></form></Modal>}
    {toast && <div className="toast" role="status"><CheckCircle2 size={17}/>{toast}<button onClick={() => setToast("")} aria-label="Tutup pemberitahuan"><X size={15}/></button></div>}
  </div>;
}

function StatCard({label,value,detail,icon:Icon,tone,trend}: {label:string;value:number;detail:string;icon:typeof Files;tone:string;trend:string}) {
  return <div className="stat-card"><div className="stat-top"><span>{label}</span><span className={\`stat-icon stat-\${tone}\`}><Icon size={18}/></span></div><div className="stat-value">{value.toLocaleString("id-ID")}</div><div className="stat-bottom"><span>{detail}</span><span className="stat-trend">{trend}</span></div></div>;
}
function Dashboard({cases,numbers,activeCases,reportedNumbers,onNavigate,onNewCase,onNewNumber}: {cases:CaseRecord[];numbers:NumberRecord[];activeCases:number;reportedNumbers:number;onNavigate:(p:Page)=>void;onNewCase:()=>void;onNewNumber:()=>void}) {
 const recentCases=cases.slice(0,4), recentNumbers=numbers.slice(0,4);
 return <><SectionHead eyebrow="PUSAT KENDALI" title="Ringkasan investigasi" description="Pantau catatan kasus, hasil pemeriksaan, dan tindakan berikutnya." action={<Button onClick={onNewCase}><Plus size={16}/> Kasus baru</Button>}/>
 <div className="welcome-strip"><div className="welcome-symbol"><ShieldCheck size={24}/></div><div><strong>Selamat datang di Lacak Aman</strong><p>Gunakan bukti dan sumber tepercaya. Status pemeriksaan hanya berasal dari catatan yang Anda masukkan.</p></div><Pill tone="blue">MVP lokal</Pill></div>
 <div className="stats-grid"><StatCard label="Total kasus" value={cases.length} detail="Catatan di browser ini" icon={Files} tone="navy" trend="Semua status"/><StatCard label="Kasus aktif" value={activeCases} detail="Belum berstatus selesai" icon={Activity} tone="blue" trend="Perlu tindak lanjut"/><StatCard label="Nomor diperiksa" value={numbers.filter(n=>!!n.checkedAt).length} detail={\`Dari \${numbers.length} nomor tercatat\`} icon={Smartphone} tone="teal" trend="Pemeriksaan manual"/><StatCard label="Ada laporan" value={reportedNumbers} detail="Hasil catatan pengguna" icon={ShieldAlert} tone="amber" trend="Perlu verifikasi"/></div>
 <div className="dashboard-grid"><section className="panel recent-panel"><div className="panel-heading"><div><h2>Kasus terbaru</h2><p>Ringkasan catatan yang baru dibuat</p></div><Button variant="quiet" onClick={()=>onNavigate("cases")}>Lihat semua <ArrowUpRight size={15}/></Button></div>{recentCases.length===0?<EmptyState icon={Files} title="Belum ada kasus" body="Catat kejadian pertama agar kronologi dan bukti dapat dikelola dalam satu tempat." action={<Button variant="outline" onClick={onNewCase}><Plus size={15}/> Buat kasus pertama</Button>}/>:<div className="recent-list">{recentCases.map(c=><div className="recent-row" key={c.id}><div className="recent-icon"><MessageSquareWarning size={18}/></div><div className="recent-main"><strong>{c.title}</strong><span>{c.kind} · {c.date}</span></div><ToneForStatus status={c.status}/><span className="recent-arrow"><ArrowDownRight size={15}/></span></div>)}</div>}</section>
 <section className="panel source-panel"><div className="panel-heading"><div><h2>Sumber resmi</h2><p>Periksa dan laporkan melalui kanal resmi</p></div><ExternalLink size={17} className="muted-icon"/></div><div className="source-list">{SOURCES.map(source=>{const Icon=source.icon;return <a href={source.url} target="_blank" rel="noreferrer" className="source-row" key={source.name}><div className="source-icon"><Icon size={17}/></div><div><strong>{source.name}</strong><span>{source.desc}</span></div><ExternalLink size={14} className="source-link-icon"/></a>;})}</div><div className="source-disclaimer"><AlertTriangle size={15}/><span>Tidak ditemukannya laporan bukan bukti bahwa nomor aman.</span></div></section></div>
 <div className="dashboard-grid lower-grid"><section className="panel"><div className="panel-heading"><div><h2>Pemeriksaan nomor terbaru</h2><p>Nomor yang telah dicatat dalam aplikasi</p></div><Button variant="quiet" onClick={()=>onNavigate("numbers")}>Pemeriksaan <ArrowUpRight size={15}/></Button></div>{recentNumbers.length===0?<EmptyState icon={Phone} title="Belum ada nomor" body="Tambahkan nomor untuk merekam hasil pemeriksaan dari sumber eksternal." action={<Button variant="outline" onClick={onNewNumber}><Plus size={15}/> Tambahkan nomor</Button>}/>:<div className="table-wrap"><table><thead><tr><th>Nomor</th><th>Label</th><th>Status</th></tr></thead><tbody>{recentNumbers.map(n=><tr key={n.id}><td className="phone-cell">{n.phone}</td><td>{n.label}</td><td><ToneForStatus status={n.status}/></td></tr>)}</tbody></table></div>}</section>
 <section className="panel quick-panel"><div className="panel-heading"><div><h2>Tindakan cepat</h2><p>Langkah yang paling sering digunakan</p></div></div><button className="quick-action" onClick={onNewNumber}><div className="quick-icon quick-teal"><Phone size={17}/></div><div><strong>Catat nomor mencurigakan</strong><span>Tambah nomor dan konteks</span></div><ArrowUpRight size={15}/></button><button className="quick-action" onClick={onNewCase}><div className="quick-icon quick-blue"><FileCheck2 size={17}/></div><div><strong>Dokumentasikan kasus</strong><span>Buat kronologi dan kumpulkan bukti</span></div><ArrowUpRight size={15}/></button><button className="quick-action" onClick={()=>onNavigate("map")}><div className="quick-icon quick-violet"><MapPin size={17}/></div><div><strong>Bagikan GPS perangkat</strong><span>Dengan izin eksplisit pemilik</span></div><ArrowUpRight size={15}/></button></section></div>
 <div className="critical-note"><div className="critical-icon"><CircleHelp size={18}/></div><div><strong>Ketahui batas kemampuan alat</strong><p>Lacak Aman tidak bisa mendapatkan koordinat GPS atau waktu terakhir aktif WhatsApp hanya dari nomor HP. Fitur lokasi hanya membaca perangkat yang memberi izin melalui browser.</p></div></div></>;
}
function StatCard({label,value,detail,icon:Icon,tone,trend}: {label:string;value:number;detail:string;icon:typeof Files;tone:string;trend:string}) {
 return <div className="stat-card"><div className="stat-top"><span>{label}</span><span className={\`stat-icon stat-\${tone}\`}><Icon size={18}/></span></div><div className="stat-value">{value.toLocaleString("id-ID")}</div><div className="stat-bottom"><span>{detail}</span><span className="stat-trend">{trend}</span></div></div>;
}
function NumbersPage({numbers,allCount,search,setSearch,onAdd,onSaveCheck,onDelete}: {numbers:NumberRecord[];allCount:number;search:string;setSearch:(v:string)=>void;onAdd:()=>void;onSaveCheck:(event:FormEvent<HTMLFormElement>,record:NumberRecord)=>void;onDelete:(id:string)=>void}) {
 const [expanded,setExpanded]=useState<string|null>(null);
 return <><SectionHead eyebrow="INTELIJEN NOMOR" title="Pemeriksaan nomor" description="Catat hasil pemeriksaan dari situs atau kanal resmi. Pencarian eksternal otomatis belum tersedia." action={<Button onClick={onAdd}><Plus size={16}/> Tambah nomor</Button>}/><div className="critical-note compact-note"><AlertTriangle size={18}/><div><strong>Nomor HP bukan pelacak lokasi</strong><p>Halaman ini tidak mengetahui posisi perangkat atau status online/terakhir aktif WhatsApp. Sumber eksternal perlu diperiksa secara manual.</p></div></div>
 <div className="panel"><div className="list-toolbar"><div><strong>Daftar nomor</strong><span>{allCount} nomor tercatat di browser</span></div><div className="search-box"><Search size={16}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Cari nomor atau label..."/></div></div>{numbers.length===0?<EmptyState icon={FileSearch} title={allCount===0?"Belum ada nomor yang tercatat":"Tidak ada hasil"} body={allCount===0?"Tambahkan nomor, lalu buka sumber resmi untuk melakukan pemeriksaan manual.":"Ubah kata pencarian atau tambahkan nomor baru."} action={allCount===0?<Button onClick={onAdd}><Plus size={15}/> Tambah nomor</Button>:undefined}/>:<div className="number-list">{numbers.map(record=><div className="number-card" key={record.id}><div className="number-row"><div className="number-mark"><Phone size={18}/></div><div className="number-primary"><strong>{record.phone}</strong><span>{record.label}</span>{record.checkedAt&&<small>Diperiksa {dateTime(record.checkedAt)} · {record.source}</small>}</div><ToneForStatus status={record.status}/><IconButton title={expanded===record.id?"Tutup detail":"Buka detail pemeriksaan"} onClick={()=>setExpanded(expanded===record.id?null:record.id)}><ChevronDown size={17}/></IconButton><IconButton title="Hapus nomor" onClick={()=>onDelete(record.id)}><Trash2 size={16}/></IconButton></div>{expanded===record.id&&<form className="check-form" onSubmit={e=>onSaveCheck(e,record)}><div className="form-grid"><label>Sumber yang diperiksa<select name="source" defaultValue={record.source||""} required><option value="" disabled>Pilih sumber</option>{SOURCES.map(s=><option key={s.name} value={s.name}>{s.name}</option>)}</select></label><label>Hasil pemeriksaan<select name="status" defaultValue={record.status} required><option>Belum diperiksa</option><option>Ada laporan</option><option>Belum ditemukan pada sumber yang diperiksa</option><option>Gagal diperiksa</option></select></label></div><label>Catatan / URL hasil (opsional)<textarea name="note" rows={2} defaultValue={record.note||""} placeholder="Catat URL sumber dan ringkasan hasil; jangan masukkan kata sandi atau kode OTP."/></label><div className="form-actions check-actions"><span className="subtle-text">Simpan hasil yang benar-benar Anda periksa.</span><Button type="submit"><CheckCircle2 size={15}/> Simpan hasil</Button></div></form>}</div>)}</div>}</div><div className="official-links">{SOURCES.map(s=><a target="_blank" rel="noreferrer" href={s.url} key={s.name}>{s.name}<ExternalLink size={13}/></a>)}</div><p className="disclaimer-line">Hasil di atas adalah catatan yang dimasukkan pengguna, bukan hasil API resmi. “Belum ditemukan” hanya berlaku pada sumber yang diperiksa dan tidak menjamin nomor aman.</p></>;
}
function CasesPage({cases,allCount,search,setSearch,onAdd,onEvidence,onRemoveEvidence,onStatus,onDelete,onExport}: {cases:CaseRecord[];allCount:number;search:string;setSearch:(v:string)=>void;onAdd:()=>void;onEvidence:(caseId:string,file?:File)=>void;onRemoveEvidence:(caseId:string,evidenceId:string)=>void;onStatus:(id:string,s:CaseRecord["status"])=>void;onDelete:(id:string)=>void;onExport:(c:CaseRecord)=>void}) {
 const [expanded,setExpanded]=useState<string|null>(null);
 return <><SectionHead eyebrow="MANAJEMEN INVESTIGASI" title="Kasus & bukti" description="Dokumentasikan kejadian, kronologi, nomor terkait, dan berkas pendukung." action={<Button onClick={onAdd}><Plus size={16}/> Kasus baru</Button>}/><div className="critical-note compact-note"><LockKeyhole size={18}/><div><strong>Status penyimpanan: lokal</strong><p>Metadata tersimpan di browser ini. Lampiran belum diunggah ke private storage server; ekspor dan cadangkan dengan hati-hati.</p></div></div>
 <div className="panel"><div className="list-toolbar"><div><strong>Daftar kasus</strong><span>{allCount} kasus tercatat</span></div><div className="search-box"><Search size={16}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Cari kasus..."/></div></div>{cases.length===0?<EmptyState icon={Files} title={allCount===0?"Belum ada kasus":"Kasus tidak ditemukan"} body={allCount===0?"Mulai dengan mencatat judul, kronologi dan tanggal kejadian.":"Coba kata pencarian lain."} action={allCount===0?<Button onClick={onAdd}><Plus size={15}/> Buat kasus pertama</Button>:undefined}/>:<div className="case-list">{cases.map(c=><article className="case-card" key={c.id}><div className="case-top"><div className="case-symbol"><MessageSquareWarning size={19}/></div><div className="case-title"><strong>{c.title}</strong><span>{c.kind} · Kejadian {c.date}</span><span className="case-brief">{c.summary||"Belum ada kronologi yang dicatat."}</span></div><ToneForStatus status={c.status}/><IconButton title={expanded===c.id?"Tutup kasus":"Kelola kasus"} onClick={()=>setExpanded(expanded===c.id?null:c.id)}><ChevronDown size={17}/></IconButton></div><div className="case-meta"><span><Phone size={14}/>{c.phone||"Tidak ada nomor terkait"}</span><span><Files size={14}/>{c.evidence.length} lampiran</span><span><Clock3 size={14}/>{c.status}</span></div>{expanded===c.id&&<div className="case-details"><div className="case-detail-tools"><label>Status kasus<select value={c.status} onChange={e=>onStatus(c.id,e.target.value as CaseRecord["status"])}><option>Baru</option><option>Ditinjau</option><option>Dilaporkan</option><option>Selesai</option></select></label><label className="upload-button"><Upload size={15}/> Tambah bukti<input type="file" accept=".png,.jpg,.jpeg,.webp,.pdf,.txt" onChange={e=>{void onEvidence(c.id,e.target.files?.[0]);e.currentTarget.value="";}}/></label><Button variant="outline" onClick={()=>onExport(c)}><Download size={15}/> Ekspor laporan</Button><Button variant="danger" onClick={()=>onDelete(c.id)}><Trash2 size={15}/> Hapus</Button></div>{c.evidence.length===0?<div className="evidence-empty"><Files size={17}/><span>Belum ada bukti. File yang ditambahkan hanya tersedia di browser ini dan belum diunggah ke server.</span></div>:<div className="evidence-list">{c.evidence.map(e=><div className="evidence-row" key={e.id}><div className="evidence-icon"><FileCheck2 size={17}/></div><div className="evidence-info"><strong>{e.name}</strong><span>{prettySize(e.size)} · {dateTime(e.addedAt)}</span><code>SHA-256: {e.hash}</code></div>{e.type.startsWith("image/")&&<a className="icon-button" href={e.url} target="_blank" rel="noreferrer" title="Lihat bukti"><Eye size={15}/></a>}<IconButton title="Hapus lampiran" onClick={()=>onRemoveEvidence(c.id,e.id)}><Trash2 size={15}/></IconButton></div>)}</div>}<p className="subtle-text">Hash membantu mendeteksi perubahan file, bukan pengesahan hukum otomatis. Ekspor laporan berupa TXT, bukan PDF.</p></div>}</article>)}</div>}</div></>;
}
function MapPage({consent,setConsent,session,error,busy,onStart,onStop}: {consent:boolean;setConsent:(v:boolean)=>void;session:GeoSession;error:string;busy:boolean;onStart:()=>void;onStop:()=>void}) {
 const [mapTab,setMapTab]=useState<"device"|"limits">("device");
 return <><SectionHead eyebrow="LOKASI DENGAN PERSETUJUAN" title="Peta lokasi perangkat" description="Baca GPS perangkat yang sedang membuka aplikasi ini, hanya setelah pemiliknya memberi izin."/><div className="critical-note compact-note"><Navigation size={18}/><div><strong>Ini bukan pelacak nomor HP</strong><p>Koordinat berasal dari browser pada perangkat ini. MVP belum mengirim lokasi ke server atau membagikannya ke penerima lain.</p></div></div>
 <div className="map-layout"><div className="panel location-panel"><div className="panel-heading"><div><h2>Sesi berbagi lokasi</h2><p>Aktifkan secara sadar, hentikan kapan saja</p></div><Pill tone={session?"success":"neutral"}>{session?"Lokasi terbaca":"Tidak aktif"}</Pill></div><div className="consent-box"><label className="consent-label"><input type="checkbox" checked={consent} disabled={!!session} onChange={e=>setConsent(e.target.checked)}/><span><strong>Saya menyetujui pembacaan lokasi perangkat ini</strong><small>Lokasi dibaca satu kali setelah tombol mulai ditekan. Browser mungkin menampilkan dialog izin terpisah.</small></span></label></div>{error&&<div className="inline-error"><AlertTriangle size={16}/>{error}</div>}{!session?<div className="start-gps"><Button onClick={onStart} disabled={busy||!consent} className="wide-button">{busy?<><Activity size={16}/> Membaca GPS...</>:<><MapPin size={16}/> Mulai membaca lokasi</>}</Button><small>Memerlukan HTTPS atau localhost serta dukungan geolocation browser.</small></div>:<div className="location-result"><div className="location-result-head"><div className="result-pin"><MapPin size={20}/></div><div><strong>Koordinat perangkat diperoleh</strong><span>Diukur {dateTime(session.point.capturedAt)}</span></div><Pill tone="success">GPS dibaca</Pill></div><div className="coordinates"><div><span>Latitude</span><strong>{session.point.latitude.toFixed(6)}</strong></div><div><span>Longitude</span><strong>{session.point.longitude.toFixed(6)}</strong></div><div><span>Akurasi</span><strong>± {Math.round(session.point.accuracy)} meter</strong></div></div><div className="location-age"><Clock3 size={15}/>Waktu data: {dateTime(session.point.capturedAt)} · Sesi lokal hingga {dateTime(session.expiresAt)}</div><a className="external-map" href={\`https://www.openstreetmap.org/?mlat=\${session.point.latitude}&mlon=\${session.point.longitude}#map=17/\${session.point.latitude}/\${session.point.longitude}\`} target="_blank" rel="noreferrer">Buka titik ini di OpenStreetMap <ExternalLink size={14}/></a><Button variant="danger" onClick={onStop}><Ban size={15}/> Hentikan sesi lokasi</Button></div>}<div className="map-explainer"><LockKeyhole size={16}/><span>Koordinat disimpan di state aplikasi selama halaman terbuka. Data ini tidak dikirim ke server, tidak dibagikan otomatis, dan bukan lokasi ponsel lain.</span></div></div>
 <aside className="panel map-side"><div className="tab-strip"><button className={mapTab==="device"?"tab-active":""} onClick={()=>setMapTab("device")}>Perangkat</button><button className={mapTab==="limits"?"tab-active":""} onClick={()=>setMapTab("limits")}>Batasan</button></div>{mapTab==="device"?<div className="side-content"><div className="device-illustration"><Smartphone size={34}/><span className={session?"device-dot active":"device-dot"}/></div><h3>Perangkat saat ini</h3><p>Web browser yang Anda gunakan sekarang.</p><div className="side-detail"><span>Status izin</span><strong>{session?"Lokasi berhasil dibaca":consent?"Persetujuan dicentang":"Belum diminta"}</strong></div><div className="side-detail"><span>Berbagi server</span><Pill tone="warning">Belum tersedia</Pill></div><div className="side-detail"><span>GPS latar belakang</span><Pill>Belum tersedia</Pill></div></div>:<div className="side-content limits-list"><div><CheckCircle2 size={17}/><span>Lokasi dibaca setelah aksi pengguna dan izin browser.</span></div><div><CheckCircle2 size={17}/><span>Waktu pengukuran dan estimasi akurasi ditampilkan.</span></div><div><Ban size={17}/><span>Tidak dapat mencari posisi ponsel dari nomor HP.</span></div><div><Ban size={17}/><span>Tidak ada pemantauan lokasi orang lain atau mode tersembunyi.</span></div></div>}</aside></div>
 <div className="panel map-preview"><div className="panel-heading"><div><h2>Pratinjau peta</h2><p>{session?"Titik berasal dari GPS perangkat ini.":"Peta menunggu izin lokasi; tidak ada koordinat contoh yang ditampilkan."}</p></div><Globe size={19} className="muted-icon"/></div>{session?<div className="map-real-point"><div className="map-visual-pin"><MapPin size={24}/></div><strong>Titik lokasi perangkat saat ini</strong><p>{session.point.latitude.toFixed(5)}, {session.point.longitude.toFixed(5)}</p><a href={\`https://www.openstreetmap.org/?mlat=\${session.point.latitude}&mlon=\${session.point.longitude}#map=16/\${session.point.latitude}/\${session.point.longitude}\`} target="_blank" rel="noreferrer">Lihat peta interaktif <ExternalLink size={14}/></a></div>:<div className="map-empty"><div className="map-grid"><div className="map-placeholder-icon"><MapPin size={25}/></div></div><strong>Belum ada koordinat perangkat</strong><p>Izinkan akses lokasi untuk menampilkan titik yang benar-benar diperoleh. Peta tidak menggunakan lokasi simulasi.</p></div>}</div></>;
}
function GuidePage() {
 return <><SectionHead eyebrow="RESPONS INSIDEN" title="Panduan pelaporan" description="Gunakan jalur resmi, simpan bukti asli, dan hindari tindakan yang dapat membahayakan akun atau perangkat."/><div className="guide-alert"><ShieldAlert size={22}/><div><strong>Jika akun WhatsApp Anda diambil alih</strong><p>Jangan membagikan kode OTP/PIN kepada siapa pun. Ikuti alur pemulihan di aplikasi dan Pusat Bantuan WhatsApp. Periksa perangkat tertaut sesudah akun kembali dikuasai.</p><a href="https://faq.whatsapp.com/" target="_blank" rel="noreferrer">Buka Pusat Bantuan WhatsApp <ExternalLink size={14}/></a></div></div><div className="guide-grid">{SOURCES.map((s,i)=>{const Icon=s.icon;return <article className="guide-card" key={s.name}><div className="guide-card-top"><div className="guide-source-icon"><Icon size={20}/></div><Pill>{\`KANAL 0\${i+1}\`}</Pill></div><h2>{s.name}</h2><p>{s.desc}. Buka layanan resminya untuk mengikuti proses pemeriksaan atau pengaduan yang tersedia.</p><a className="btn btn-outline guide-link" href={s.url} target="_blank" rel="noreferrer">Buka situs resmi <ExternalLink size={15}/></a></article>;})}</div><div className="panel evidence-guide"><div className="panel-heading"><div><h2>Checklist bukti digital</h2><p>Kumpulkan hanya bukti yang relevan dengan kejadian.</p></div><FileCheck2 size={19} className="muted-icon"/></div>{[["Simpan percakapan asli","Ambil screenshot lengkap dengan konteks, nomor, tanggal dan waktu jika tersedia."],["Catat kronologi","Tuliskan urutan kejadian berdasarkan apa yang benar-benar diketahui. Bedakan fakta dan dugaan."],["Simpan bukti transaksi","Catat nomor referensi, waktu dan bukti dari kanal resmi bank atau dompet digital."],["Pertahankan file asli","Jangan mengedit berkas sumber. Buat salinan untuk anotasi jika diperlukan."],["Catat sumber dan hasil","Tulis URL, waktu pemeriksaan, serta apakah hasilnya belum diverifikasi."]].map(([title,body],i)=><div className="checklist-row" key={title}><div className="checklist-num">{String(i+1).padStart(2,"0")}</div><div><strong>{title}</strong><p>{body}</p></div></div>)}</div><div className="critical-note"><CircleHelp size={18}/><div><strong>Ingat batasan investigasi</strong><p>Aplikasi ini membantu menata informasi. Aplikasi tidak mengakses database rahasia operator, tidak memantau aktivitas WhatsApp, dan tidak menetapkan seseorang bersalah.</p></div></div></>;
}
function Modal({title,subtitle,onClose,children}: {title:string;subtitle:string;onClose:()=>void;children:ReactNode}) {
 useEffect(()=>{const onKey=(e:KeyboardEvent)=>{if(e.key==="Escape")onClose();};window.addEventListener("keydown",onKey);return ()=>window.removeEventListener("keydown",onKey);},[onClose]);
 return <div className="modal-backdrop" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}><section className="modal" role="dialog" aria-modal="true" aria-label={title}><div className="modal-head"><div><h2>{title}</h2><p>{subtitle}</p></div><IconButton title="Tutup dialog" onClick={onClose}><X size={18}/></IconButton></div>{children}</section></div>;
}
