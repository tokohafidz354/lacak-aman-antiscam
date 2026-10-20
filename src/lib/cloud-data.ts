import { supabase } from "./supabase";

export type CloudNumber = {
  id: string;
  phone: string;
  label: string;
  status: "Belum diperiksa" | "Ada laporan" | "Belum ditemukan pada sumber yang diperiksa" | "Gagal diperiksa";
  checkedAt?: string;
  source?: string;
  note?: string;
};

export type CloudEvidence = {
  id: string;
  name: string;
  size: number;
  type: string;
  hash: string;
  addedAt: string;
  url: string;
  storagePath?: string;
};

export type CloudCase = {
  id: string;
  title: string;
  kind: string;
  status: "Baru" | "Ditinjau" | "Dilaporkan" | "Selesai";
  date: string;
  summary: string;
  phone: string;
  evidence: CloudEvidence[];
};

function client() {
  if (!supabase) throw new Error("Supabase belum dikonfigurasi. Isi VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY.");
  return supabase;
}

export async function loadCloudData(): Promise<{ numbers: CloudNumber[]; cases: CloudCase[] }> {
  const db = client();
  const [caseResult, phoneResult, checkResult, evidenceResult] = await Promise.all([
    db.from("cases").select("*").order("created_at", { ascending: false }),
    db.from("phone_subjects").select("*").is("case_id", null).order("created_at", { ascending: false }),
    db.from("number_checks").select("*").order("checked_at", { ascending: false }),
    db.from("evidence_files").select("*").order("uploaded_at", { ascending: false }),
  ]);
  const failure = [caseResult.error, phoneResult.error, checkResult.error, evidenceResult.error].find(Boolean);
  if (failure) throw failure;

  const caseRows = caseResult.data ?? [];
  const phoneRows = phoneResult.data ?? [];
  const checkRows = checkResult.data ?? [];
  const evidenceRows = evidenceResult.data ?? [];

  const evidence = await Promise.all(evidenceRows.map(async (row) => {
    const signed = await db.storage.from("case-evidence").createSignedUrl(row.storage_path, 300);
    return {
      id: row.id,
      caseId: row.case_id as string,
      name: row.original_name,
      size: Number(row.size_bytes),
      type: row.mime_type,
      hash: row.sha256 || "Hash tidak tersedia",
      addedAt: row.uploaded_at,
      url: signed.error ? "" : signed.data.signedUrl,
      storagePath: row.storage_path,
    };
  }));

  const numbers: CloudNumber[] = phoneRows.map((row) => {
    const check = checkRows.find((item) => item.phone_subject_id === row.id);
    return {
      id: row.id,
      phone: row.phone_e164,
      label: row.label || "Nomor belum diberi label",
      status: check?.result_status || "Belum diperiksa",
      checkedAt: check?.checked_at,
      source: check?.source_name,
      note: check?.note,
    };
  });

  const cases: CloudCase[] = caseRows.map((row) => {
    const related = (db as any).__not_used;
    const casePhone = (phoneResult.data ?? []).find((phoneRow) => phoneRow.case_id === row.id);
    return {
      id: row.id,
      title: row.title,
      kind: row.incident_type,
      status: row.status,
      date: row.incident_date || String(row.created_at).slice(0, 10),
      summary: row.summary || "",
      phone: casePhone?.phone_e164 || "",
      evidence: evidence.filter((item) => item.caseId === row.id).map(({ caseId: _caseId, ...item }) => item),
    };
  });

  return { numbers, cases };
}

export async function cloudCreateNumber(ownerId: string, phone: string, label: string) {
  const { data, error } = await client().from("phone_subjects")
    .insert({ owner_id: ownerId, phone_e164: phone, label })
    .select("*").single();
  if (error) throw error;
  return data;
}

export async function cloudSaveCheck(ownerId: string, subjectId: string, source: string, sourceUrl: string, status: string, note: string) {
  const { error } = await client().from("number_checks").insert({
    owner_id: ownerId, phone_subject_id: subjectId, source_name: source,
    source_url: sourceUrl || null, result_status: status, note, checked_at: new Date().toISOString(),
  });
  if (error) throw error;
}

export async function cloudCreateCase(ownerId: string, input: {
  title: string; incident_type: string; status: string; incident_date: string; summary: string; phone: string;
}) {
  const db = client();
  const { data, error } = await db.from("cases").insert({
    owner_id: ownerId, title: input.title, incident_type: input.incident_type,
    status: input.status, incident_date: input.incident_date || null, summary: input.summary,
  }).select("*").single();
  if (error) throw error;

  if (input.phone) {
    const { error: phoneError } = await db.from("phone_subjects").insert({
      owner_id: ownerId, case_id: data.id, phone_e164: input.phone, label: "Terkait kasus: " + input.title,
    });
    if (phoneError) {
      await db.from("cases").delete().eq("id", data.id);
      throw phoneError;
    }
  }
  return {
    id: data.id, title: data.title, kind: data.incident_type, status: data.status,
    date: data.incident_date || String(data.created_at).slice(0, 10),
    summary: data.summary || "", phone: input.phone, evidence: [],
  } satisfies CloudCase;
}

export async function cloudUpdateCaseStatus(caseId: string, status: string) {
  const { error } = await client().from("cases").update({ status, updated_at: new Date().toISOString() }).eq("id", caseId);
  if (error) throw error;
}

export async function cloudDeleteCase(caseId: string) {
  const db = client();
  const { data: files, error: listError } = await db.from("evidence_files").select("storage_path").eq("case_id", caseId);
  if (listError) throw listError;
  const paths = (files ?? []).map((item) => item.storage_path as string);
  if (paths.length) {
    const { error } = await db.storage.from("case-evidence").remove(paths);
    if (error) throw error;
  }
  const { error } = await db.from("cases").delete().eq("id", caseId);
  if (error) throw error;
}

export async function cloudUploadEvidence(ownerId: string, caseId: string, file: File, hash: string): Promise<CloudEvidence> {
  const db = client();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-120) || "evidence";
  const storagePath = ownerId + "/" + caseId + "/" + crypto.randomUUID() + "-" + safeName;
  const { error: uploadError } = await db.storage.from("case-evidence").upload(storagePath, file, {
    contentType: file.type, upsert: false,
  });
  if (uploadError) throw uploadError;

  const { data, error } = await db.from("evidence_files").insert({
    owner_id: ownerId, case_id: caseId, storage_path: storagePath,
    original_name: file.name.slice(0, 255), mime_type: file.type, size_bytes: file.size,
    sha256: /^[a-f0-9]{64}$/.test(hash) ? hash : null,
  }).select("*").single();

  if (error) {
    await db.storage.from("case-evidence").remove([storagePath]);
    throw error;
  }
  const signed = await db.storage.from("case-evidence").createSignedUrl(storagePath, 300);
  return {
    id: data.id, name: data.original_name, size: Number(data.size_bytes), type: data.mime_type,
    hash: data.sha256 || hash, addedAt: data.uploaded_at,
    url: signed.error ? "" : signed.data.signedUrl, storagePath,
  };
}

export async function cloudDeleteEvidence(evidenceId: string, storagePath?: string) {
  const db = client();
  if (storagePath) {
    const { error } = await db.storage.from("case-evidence").remove([storagePath]);
    if (error) throw error;
  }
  const { error } = await db.from("evidence_files").delete().eq("id", evidenceId);
  if (error) throw error;
}
