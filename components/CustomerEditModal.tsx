"use client";

import {
  AlertTriangle,
  GitMerge,
  Mail,
  MessageCircle,
  Phone,
  Plus,
  Save,
  StickyNote,
  Trash2,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import type { FormEvent, MouseEvent, RefObject } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { useFocusTrap } from "@/lib/useFocusTrap";
import type { Customer, InteractionType } from "@/lib/types";
import { PROVINCES_SORTED_TH } from "@/lib/provinces";
import { cardClass, ghostBtnClass, inputClass, primaryBtnClass, sectionLabelClass } from "@/components/ui";
import { can, type AppRole } from "@/lib/auth/permissions";
import { isSupabaseConfigured } from "@/lib/supabase/config";

const CUSTOM_OWNER_VALUE = "__custom_owner__";

const INTERACTION_TYPE_OPTIONS: { value: InteractionType; label: string; icon: LucideIcon }[] = [
  { value: "call", label: "โทร", icon: Phone },
  { value: "meeting", label: "ประชุม", icon: Users },
  { value: "line", label: "LINE", icon: MessageCircle },
  { value: "email", label: "อีเมล", icon: Mail },
  { value: "note", label: "โน้ต", icon: StickyNote },
];

const INTERACTION_TYPE_MAP = Object.fromEntries(
  INTERACTION_TYPE_OPTIONS.map((option) => [option.value, option]),
) as Record<InteractionType, (typeof INTERACTION_TYPE_OPTIONS)[number]>;

const INTERACTION_DATE_FORMATTER = new Intl.DateTimeFormat("th-TH", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

function formatInteractionDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return value;
  return INTERACTION_DATE_FORMATTER.format(new Date(year, month - 1, day));
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

const labelClass = "mb-1.5 block text-sm font-medium text-muted";
const errorClass = "mt-1 text-xs font-semibold text-error-dark";
const destructiveButtonClass =
  "inline-flex h-10 items-center gap-2 rounded-lg border border-error/30 px-3 text-sm font-medium text-error-dark transition-colors duration-150 hover:border-error/50 hover:bg-error-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error/20";

type FormState = {
  name: string;
  provinceCode: string;
  salesOwner: string;
  contactPerson: string;
  phone: string;
  email: string;
  lineId: string;
  color: string;
};

type FormErrors = {
  name?: string;
  color?: string;
  mergeTarget?: string;
};

type OwnerMode = "select" | "custom";

// customerId === null reuses this same modal for "add customer" (mirrors how
// ItemModal already reuses one modal for create+edit) — a thin CREATE variant
// renders instead of the EDIT content, sharing the field-grid markup via
// CustomerFormFields but keeping its own (much smaller) submit/close logic.
export function CustomerEditModal({
  customerId,
  onClose,
  role,
}: {
  customerId: string | null;
  onClose: () => void;
  role: AppRole | null;
}) {
  const customers = useStore((state) => state.customers);
  const customer = useMemo(
    () => (customerId === null ? undefined : customers.find((candidate) => candidate.id === customerId)),
    [customers, customerId],
  );

  if (customerId === null) {
    return <CustomerCreateModalContent onClose={onClose} />;
  }

  if (!customer) return null;

  return (
    <CustomerEditModalContent
      key={customer.id}
      customer={customer}
      customers={customers}
      onClose={onClose}
      role={role}
    />
  );
}

function CustomerEditModalContent({
  customer,
  customers,
  onClose,
  role,
}: {
  customer: Customer;
  customers: Customer[];
  onClose: () => void;
  role: AppRole | null;
}) {
  const items = useStore((state) => state.items);
  const members = useStore((state) => state.members);
  const updateCustomer = useStore((state) => state.updateCustomer);
  const deleteCustomer = useStore((state) => state.deleteCustomer);
  const mergeCustomers = useStore((state) => state.mergeCustomers);
  const addInteraction = useStore((state) => state.addInteraction);
  const deleteInteraction = useStore((state) => state.deleteInteraction);

  const firstFieldRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLFormElement>(null);
  const [form, setForm] = useState<FormState>(() => createFormState(customer));
  const [errors, setErrors] = useState<FormErrors>({});
  const [ownerMode, setOwnerMode] = useState<OwnerMode>("select");
  const [mergeTargetId, setMergeTargetId] = useState("");
  const [interactionType, setInteractionType] = useState<InteractionType>("call");
  const [interactionDate, setInteractionDate] = useState(() => todayIsoDate());
  const [interactionNote, setInteractionNote] = useState("");

  const itemCount = useMemo(
    () => items.filter((item) => item.customerId === customer.id).length,
    [items, customer.id],
  );
  // RLS only allows customer deletes for admin/manager — standalone mode (no
  // Supabase, no RLS) keeps delete available exactly as it works today, same
  // rule shape as ReportView's owner-quota gate.
  const canDelete = !isSupabaseConfigured() || can(role, "customers.delete");
  const ownerOptions = useMemo(
    () =>
      [...new Set([...members, customer.salesOwner].map((member) => member.trim()).filter(Boolean))].sort(
        (a, b) => a.localeCompare(b, "th"),
      ),
    [members, customer.salesOwner],
  );
  const otherCustomers = useMemo(
    () =>
      customers
        .filter((candidate) => candidate.id !== customer.id)
        .sort((a, b) => a.name.localeCompare(b.name, "th")),
    [customers, customer.id],
  );
  const selectedMergeTarget = otherCustomers.find((candidate) => candidate.id === mergeTargetId);

  // useFocusTrap must run BEFORE the initial-focus effect below so its effect
  // captures the real trigger (document.activeElement at mount) — if it ran
  // after, focus would already have moved to firstFieldRef by the time it
  // captured `previouslyFocused`, so closing the modal would restore focus to
  // the (unmounted) field instead of the trigger, dropping it to <body>.
  useFocusTrap(containerRef);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    firstFieldRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  const updateField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    if (key === "name") setErrors((current) => ({ ...current, name: undefined }));
    if (key === "color") setErrors((current) => ({ ...current, color: undefined }));
  };

  const handleOwnerSelect = (value: string) => {
    if (value === CUSTOM_OWNER_VALUE) {
      setOwnerMode("custom");
      setForm((current) => ({ ...current, salesOwner: "" }));
      return;
    }

    setOwnerMode("select");
    setForm((current) => ({ ...current, salesOwner: value }));
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const nextErrors = validateForm(form);
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      return;
    }

    updateCustomer(customer.id, {
      name: form.name,
      provinceCode: form.provinceCode,
      salesOwner: form.salesOwner,
      contactPerson: form.contactPerson,
      phone: form.phone,
      email: form.email,
      lineId: form.lineId,
      color: form.color,
    });
    onClose();
  };

  const handleOverlayClick = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) onClose();
  };

  const handleDelete = () => {
    if (
      !window.confirm(
        `ลูกค้านี้มี ${itemCount.toLocaleString("th-TH")} ชิ้นงาน — ลบทั้งลูกค้าและงานทั้งหมด?`,
      )
    ) {
      return;
    }

    deleteCustomer(customer.id);
    onClose();
  };

  const handleMerge = () => {
    if (!selectedMergeTarget) {
      setErrors((current) => ({ ...current, mergeTarget: "กรุณาเลือกลูกค้าที่ต้องการรวม" }));
      return;
    }

    if (
      !window.confirm(
        `ย้าย ${itemCount.toLocaleString("th-TH")} ชิ้นงานไปรวมกับ ${selectedMergeTarget.name} แล้วลบลูกค้านี้?`,
      )
    ) {
      return;
    }

    mergeCustomers(customer.id, selectedMergeTarget.id);
    onClose();
  };

  const handleAddInteraction = () => {
    if (!interactionNote.trim()) return;

    addInteraction(customer.id, {
      type: interactionType,
      date: interactionDate,
      note: interactionNote,
    });
    setInteractionNote("");
  };

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto overscroll-contain bg-black/50 px-3 py-4 backdrop-blur-sm sm:px-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="customer-edit-modal-title"
      onMouseDown={handleOverlayClick}
    >
      <form
        ref={containerRef}
        noValidate
        onSubmit={handleSubmit}
        className={`mx-auto flex max-h-[calc(100vh-2rem)] w-full max-w-2xl flex-col overflow-hidden ${cardClass}`}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border-soft px-5 py-4 sm:px-6">
          <h2 id="customer-edit-modal-title" className="text-lg font-semibold text-ink">
            แก้ไขลูกค้า
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="grid size-9 shrink-0 place-items-center rounded-lg text-muted transition-colors duration-150 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-100"
            aria-label="ปิด"
            title="ปิด"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 sm:px-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <CustomerFormFields
              form={form}
              errors={errors}
              ownerMode={ownerMode}
              ownerOptions={ownerOptions}
              firstFieldRef={firstFieldRef}
              onUpdateField={updateField}
              onOwnerSelect={handleOwnerSelect}
            />

            <div className="rounded-lg border border-warning/30 bg-warning-light/50 p-4 sm:col-span-2">
              <div className="mb-3 flex items-start gap-2">
                <AlertTriangle className="size-4 shrink-0 text-warning-dark" aria-hidden="true" />
                <div>
                  <p className="text-sm font-semibold text-warning-dark">รวมกับลูกค้าอื่น</p>
                  <p className="mt-0.5 text-xs text-muted">
                    ย้ายชิ้นงานทั้งหมดไปยังลูกค้าที่เลือก แล้วลบลูกค้านี้ทิ้ง — ทำย้อนกลับไม่ได้
                  </p>
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                <label className="block">
                  <span className="sr-only">เลือกลูกค้าที่ต้องการรวม</span>
                  <select
                    value={mergeTargetId}
                    onChange={(event) => {
                      setMergeTargetId(event.target.value);
                      setErrors((current) => ({ ...current, mergeTarget: undefined }));
                    }}
                    className={inputClass}
                    disabled={!otherCustomers.length}
                    aria-invalid={Boolean(errors.mergeTarget)}
                    aria-describedby={errors.mergeTarget ? "customer-edit-merge-error" : undefined}
                  >
                    <option value="">
                      {otherCustomers.length ? "เลือกลูกค้าที่ต้องการรวม" : "ไม่มีลูกค้าอื่นให้รวม"}
                    </option>
                    {otherCustomers.map((candidate) => (
                      <option key={candidate.id} value={candidate.id}>
                        {customerOptionLabel(candidate)}
                      </option>
                    ))}
                  </select>
                  {errors.mergeTarget ? (
                    <p id="customer-edit-merge-error" className={errorClass}>
                      {errors.mergeTarget}
                    </p>
                  ) : null}
                </label>
                <button
                  type="button"
                  onClick={handleMerge}
                  disabled={!otherCustomers.length}
                  className="inline-flex h-10 items-center justify-center gap-2 self-start rounded-lg border border-warning/40 bg-white px-3 text-sm font-medium text-warning-dark transition-colors duration-150 hover:bg-warning-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-warning/30 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400 disabled:hover:bg-white"
                >
                  <GitMerge className="size-4" aria-hidden="true" />
                  รวมกับลูกค้าอื่น
                </button>
              </div>
            </div>

            <div className="border-t border-border-soft pt-4 sm:col-span-2">
              <h3 className={`${sectionLabelClass} mb-3`}>ประวัติการติดต่อ</h3>

              {customer.id ? (
                <div className="mb-4 grid gap-2 sm:grid-cols-[auto_auto_1fr_auto] sm:items-start">
                  <label className="block">
                    <span className="sr-only">ประเภทการติดต่อ</span>
                    <select
                      value={interactionType}
                      onChange={(event) => setInteractionType(event.target.value as InteractionType)}
                      className={inputClass}
                    >
                      {INTERACTION_TYPE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block">
                    <span className="sr-only">วันที่ติดต่อ</span>
                    <input
                      type="date"
                      value={interactionDate}
                      onChange={(event) => setInteractionDate(event.target.value)}
                      className={inputClass}
                    />
                  </label>

                  <label className="block">
                    <span className="sr-only">บันทึกการติดต่อ</span>
                    <input
                      value={interactionNote}
                      onChange={(event) => setInteractionNote(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          handleAddInteraction();
                        }
                      }}
                      className={inputClass}
                      placeholder="เช่น โทรคุยเรื่องต่ออายุ"
                    />
                  </label>

                  <button
                    type="button"
                    onClick={handleAddInteraction}
                    disabled={!interactionNote.trim()}
                    className={`${ghostBtnClass} disabled:cursor-not-allowed disabled:text-slate-400`}
                  >
                    <Plus className="size-4" aria-hidden="true" />
                    เพิ่ม
                  </button>
                </div>
              ) : (
                <p className="mb-4 text-sm text-muted">บันทึกลูกค้าก่อนจึงเพิ่มประวัติได้</p>
              )}

              {customer.interactions.length ? (
                <ul className="space-y-2">
                  {customer.interactions.map((entry) => {
                    const meta = INTERACTION_TYPE_MAP[entry.type];
                    const Icon = meta.icon;
                    return (
                      <li
                        key={entry.id}
                        className="flex items-start gap-3 rounded-lg border border-border-soft bg-slate-100/60 px-3 py-2"
                      >
                        <Icon className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden="true" />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted">
                            <span className="font-medium text-ink">{meta.label}</span>
                            <span>{formatInteractionDate(entry.date)}</span>
                          </div>
                          <p className="mt-0.5 break-words text-sm text-ink">{entry.note}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => deleteInteraction(customer.id, entry.id)}
                          className="shrink-0 rounded-lg p-1.5 text-muted transition-colors duration-150 hover:bg-error-light hover:text-error-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error/20"
                          aria-label={`ลบประวัติการติดต่อ ${meta.label} วันที่ ${formatInteractionDate(entry.date)}`}
                          title="ลบ"
                        >
                          <Trash2 className="size-4" aria-hidden="true" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="text-sm text-muted">ยังไม่มีประวัติการติดต่อ</p>
              )}
            </div>
          </div>
        </div>

        <footer className="flex shrink-0 items-center justify-between gap-2 border-t border-border-soft px-5 py-4 sm:px-6">
          {canDelete ? (
            <button type="button" onClick={handleDelete} className={destructiveButtonClass}>
              <Trash2 className="size-4" aria-hidden="true" />
              ลบลูกค้า
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className={ghostBtnClass}>
              ยกเลิก
            </button>
            <button type="submit" className={primaryBtnClass}>
              <Save className="size-4" aria-hidden="true" />
              บันทึก
            </button>
          </div>
        </footer>
      </form>
    </div>
  );
}

// "Add customer" variant — a lighter-weight sibling of CustomerEditModalContent:
// no delete/merge/interaction-history sections (there is nothing to delete,
// merge, or log history against yet), and submits via upsertCustomer instead
// of updateCustomer. Shares the same field markup via CustomerFormFields so
// the two variants can never drift out of visual sync.
function CustomerCreateModalContent({ onClose }: { onClose: () => void }) {
  const members = useStore((state) => state.members);
  const upsertCustomer = useStore((state) => state.upsertCustomer);

  const firstFieldRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLFormElement>(null);
  const [form, setForm] = useState<FormState>(() => createEmptyFormState());
  const [errors, setErrors] = useState<FormErrors>({});
  const [ownerMode, setOwnerMode] = useState<OwnerMode>("select");

  const ownerOptions = useMemo(
    () =>
      [...new Set(members.map((member) => member.trim()).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b, "th"),
      ),
    [members],
  );

  useFocusTrap(containerRef);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    firstFieldRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  const updateField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    if (key === "name") setErrors((current) => ({ ...current, name: undefined }));
    if (key === "color") setErrors((current) => ({ ...current, color: undefined }));
  };

  const handleOwnerSelect = (value: string) => {
    if (value === CUSTOM_OWNER_VALUE) {
      setOwnerMode("custom");
      setForm((current) => ({ ...current, salesOwner: "" }));
      return;
    }

    setOwnerMode("select");
    setForm((current) => ({ ...current, salesOwner: value }));
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const nextErrors = validateForm(form);
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      return;
    }

    upsertCustomer({
      name: form.name,
      provinceCode: form.provinceCode,
      salesOwner: form.salesOwner,
      contactPerson: form.contactPerson,
      phone: form.phone,
      email: form.email,
      lineId: form.lineId,
      color: form.color,
    });
    onClose();
  };

  const handleOverlayClick = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto overscroll-contain bg-black/50 px-3 py-4 backdrop-blur-sm sm:px-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="customer-create-modal-title"
      onMouseDown={handleOverlayClick}
    >
      <form
        ref={containerRef}
        noValidate
        onSubmit={handleSubmit}
        className={`mx-auto flex max-h-[calc(100vh-2rem)] w-full max-w-2xl flex-col overflow-hidden ${cardClass}`}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border-soft px-5 py-4 sm:px-6">
          <h2 id="customer-create-modal-title" className="text-lg font-semibold text-ink">
            เพิ่มลูกค้าใหม่
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="grid size-9 shrink-0 place-items-center rounded-lg text-muted transition-colors duration-150 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-100"
            aria-label="ปิด"
            title="ปิด"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 sm:px-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <CustomerFormFields
              form={form}
              errors={errors}
              ownerMode={ownerMode}
              ownerOptions={ownerOptions}
              firstFieldRef={firstFieldRef}
              onUpdateField={updateField}
              onOwnerSelect={handleOwnerSelect}
            />
          </div>
        </div>

        <footer className="flex shrink-0 items-center justify-end gap-2 border-t border-border-soft px-5 py-4 sm:px-6">
          <button type="button" onClick={onClose} className={ghostBtnClass}>
            ยกเลิก
          </button>
          <button type="submit" className={primaryBtnClass}>
            <Save className="size-4" aria-hidden="true" />
            เพิ่มลูกค้า
          </button>
        </footer>
      </form>
    </div>
  );
}

// Shared field markup for both the EDIT and CREATE variants above — returns a
// Fragment (not its own wrapping element) because both callers place these
// fields as direct items inside their own `grid gap-4 sm:grid-cols-2` grid
// (the EDIT variant has additional sm:col-span-2 sections as siblings after
// it; the CREATE variant has only these fields in its grid).
function CustomerFormFields({
  form,
  errors,
  ownerMode,
  ownerOptions,
  firstFieldRef,
  onUpdateField,
  onOwnerSelect,
}: {
  form: FormState;
  errors: FormErrors;
  ownerMode: OwnerMode;
  ownerOptions: string[];
  firstFieldRef: RefObject<HTMLInputElement | null>;
  onUpdateField: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
  onOwnerSelect: (value: string) => void;
}) {
  return (
    <>
      <label className="block">
        <span className={labelClass}>
          ชื่อลูกค้า <span className="text-error-dark">*</span>
        </span>
        <input
          ref={firstFieldRef}
          value={form.name}
          onChange={(event) => onUpdateField("name", event.target.value)}
          className={inputClass}
          aria-invalid={Boolean(errors.name)}
          aria-describedby={errors.name ? "customer-edit-name-error" : undefined}
        />
        {errors.name ? (
          <p id="customer-edit-name-error" className={errorClass}>
            {errors.name}
          </p>
        ) : null}
      </label>

      <label className="block">
        <span className={labelClass}>จังหวัด</span>
        <select
          value={form.provinceCode}
          onChange={(event) => onUpdateField("provinceCode", event.target.value)}
          className={inputClass}
        >
          <option value="">ไม่ระบุจังหวัด</option>
          {PROVINCES_SORTED_TH.map((province) => (
            <option key={province.code} value={province.code}>
              {province.th}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className={labelClass}>เจ้าของงานขาย</span>
        <select
          value={ownerMode === "custom" ? CUSTOM_OWNER_VALUE : form.salesOwner}
          onChange={(event) => onOwnerSelect(event.target.value)}
          className={inputClass}
        >
          <option value="">ไม่ระบุเจ้าของงานขาย</option>
          {ownerOptions.map((owner) => (
            <option key={owner} value={owner}>
              {owner}
            </option>
          ))}
          <option value={CUSTOM_OWNER_VALUE}>พิมพ์ชื่อใหม่</option>
        </select>
      </label>

      {ownerMode === "custom" ? (
        <label className="block">
          <span className={labelClass}>ชื่อเจ้าของงานขายใหม่</span>
          <input
            value={form.salesOwner}
            onChange={(event) => onUpdateField("salesOwner", event.target.value)}
            className={inputClass}
            placeholder="พิมพ์ชื่อ"
          />
        </label>
      ) : null}

      <label className="block">
        <span className={labelClass}>ผู้ติดต่อ</span>
        <input
          value={form.contactPerson}
          onChange={(event) => onUpdateField("contactPerson", event.target.value)}
          className={inputClass}
          placeholder="ชื่อผู้ติดต่อ"
        />
      </label>

      <label className="block">
        <span className={labelClass}>เบอร์โทร</span>
        <input
          value={form.phone}
          onChange={(event) => onUpdateField("phone", event.target.value)}
          className={inputClass}
          inputMode="tel"
          placeholder="08x-xxx-xxxx"
        />
      </label>

      <label className="block">
        <span className={labelClass}>LINE ID</span>
        <input
          value={form.lineId}
          onChange={(event) => onUpdateField("lineId", event.target.value)}
          className={inputClass}
          placeholder="@lineid"
        />
      </label>

      <label className="block">
        <span className={labelClass}>อีเมล</span>
        <input
          value={form.email}
          onChange={(event) => onUpdateField("email", event.target.value)}
          className={inputClass}
          type="email"
          inputMode="email"
          placeholder="name@company.com"
        />
      </label>

      <label className="block">
        <span className={labelClass}>สี</span>
        <div className="flex items-center gap-2">
          <span
            className="size-10 shrink-0 rounded-lg border border-slate-300"
            style={{ backgroundColor: isHexColor(form.color) ? form.color : "#5d87ff" }}
            aria-hidden="true"
          />
          <input
            value={form.color}
            onChange={(event) => onUpdateField("color", event.target.value)}
            className={inputClass}
            placeholder="#5d87ff"
            aria-invalid={Boolean(errors.color)}
            aria-describedby={errors.color ? "customer-edit-color-error" : undefined}
          />
        </div>
        {errors.color ? (
          <p id="customer-edit-color-error" className={errorClass}>
            {errors.color}
          </p>
        ) : null}
      </label>
    </>
  );
}

function createFormState(customer: Customer): FormState {
  return {
    name: customer.name,
    provinceCode: customer.provinceCode,
    salesOwner: customer.salesOwner,
    contactPerson: customer.contactPerson,
    phone: customer.phone,
    email: customer.email,
    lineId: customer.lineId,
    color: customer.color,
  };
}

function createEmptyFormState(): FormState {
  return {
    name: "",
    provinceCode: "",
    salesOwner: "",
    contactPerson: "",
    phone: "",
    email: "",
    lineId: "",
    color: "",
  };
}

function validateForm(form: FormState): FormErrors {
  const errors: FormErrors = {};
  if (!form.name.trim()) errors.name = "กรุณากรอกชื่อลูกค้า";
  if (form.color.trim() && !isHexColor(form.color.trim())) {
    errors.color = "กรุณาใช้รหัสสีรูปแบบ #RRGGBB";
  }
  return errors;
}

function isHexColor(value: string) {
  return /^#[0-9a-fA-F]{6}$/.test(value.trim());
}

function customerOptionLabel(customer: Customer) {
  return customer.province ? `${customer.name} (${customer.province})` : customer.name;
}
