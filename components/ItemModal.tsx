"use client";

import { Check, ChevronDown, ClipboardCheck, Copy, Plus, Save, Trash2, X } from "lucide-react";
import type { FormEvent, MouseEvent, SyntheticEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  cardClass,
  ghostBtnClass,
  inputClass,
  primaryBtnClass,
  sectionLabelClass,
  tintedBtnClass,
} from "@/components/ui";
import { CHANNEL, EXEC_STATUS, PRIORITY, RENEWAL_STATUS, REPORT_STATUS, RESULT_STATUS } from "@/lib/constants";
import { rankedItemTypeOptions } from "@/lib/itemTypeOptions";
import { execToProgress } from "@/lib/normalize";
import { useStore } from "@/lib/store";
import { useFocusTrap } from "@/lib/useFocusTrap";
import type {
  ChannelKey,
  Customer,
  ExecStatus,
  Item,
  PriorityKey,
  RenewalStatus,
  ReportStatus,
  ResultStatus,
} from "@/lib/types";

const NEW_CUSTOMER_VALUE = "__new__";

// Rating input options: 0 clears/leaves the rating unset (same semantics as
// the old star widget at 0 stars), 1-5 mirror the previous star values.
const RATING_OPTIONS: { value: number; label: string }[] = [
  { value: 0, label: "ไม่ระบุ" },
  { value: 1, label: "1" },
  { value: 2, label: "2" },
  { value: 3, label: "3" },
  { value: 4, label: "4" },
  { value: 5, label: "5" },
];

const fieldClass = inputClass;
// Same chrome as inputClass, sized for multi-line text (inputClass is a fixed
// h-10 for <input>/<select>, which would clip a <textarea>).
const textareaClass =
  "min-h-20 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-ink outline-none transition placeholder:text-muted focus-visible:border-brand-600 focus-visible:ring-2 focus-visible:ring-brand-100";
const labelClass = "mb-1.5 block text-sm font-medium text-muted";
const errorClass = "mt-1 text-xs font-semibold text-error-dark";
const primaryButtonClass = primaryBtnClass;
const secondaryButtonClass = ghostBtnClass;
const destructiveButtonClass =
  "inline-flex h-10 items-center gap-2 rounded-lg px-3 text-sm font-medium text-error-dark transition hover:bg-error-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error/30";

type FormState = {
  customerId: string;
  newCustomerName: string;
  newCustomerProvince: string;
  newCustomerSalesOwner: string;
  qtNo: string;
  invNo: string;
  channel: ChannelKey;
  itemType: string;
  detail: string;
  price: string;
  execStatus: ExecStatus;
  resultStatus: ResultStatus;
  reportStatus: ReportStatus;
  renewalStatus: RenewalStatus;
  target: string;
  actual: string;
  metricName: string;
  metricUnit: string;
  targetValue: string;
  actualValue: string;
  reportSentDate: string;
  rating: number;
  link: string;
  deadline: string;
  publishDate: string;
  finishedDate: string;
  notes: string;
  followUpDate: string;
  followUpNote: string;
  priority: PriorityKey;
  progress: number;
  checklist: Item["checklist"];
};

type FormErrors = {
  customer?: string;
  itemType?: string;
  price?: string;
};

function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3 pt-6 first:pt-0">
      <h3 className={sectionLabelClass}>{title}</h3>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}

export function ItemModal() {
  const isOpen = useStore((state) => state.isItemModalOpen);
  const modalItemId = useStore((state) => state.modalItemId);
  const newItemPrefill = useStore((state) => state.newItemPrefill);
  const customers = useStore((state) => state.customers);
  const items = useStore((state) => state.items);
  const currentUser = useStore((state) => state.settings.currentUser);

  const editingItem = useMemo(
    () => items.find((item) => item.id === modalItemId),
    [items, modalItemId],
  );
  const sortedCustomers = useMemo(
    () => [...customers].sort((a, b) => a.name.localeCompare(b.name, "th")),
    [customers],
  );

  if (!isOpen) return null;

  return (
    <ItemModalContent
      // editing an item keys on its id (so switching items remounts); a new
      // item always keys on "new-item" plus the prefill it carries, so a
      // contextual add (different customer/QT/channel) also gets a fresh
      // form instead of reusing a stale mounted instance.
      key={modalItemId || `new-item-${prefillKey(newItemPrefill)}`}
      modalItemId={modalItemId}
      editingItem={editingItem}
      sortedCustomers={sortedCustomers}
      currentUser={currentUser}
      newItemPrefill={newItemPrefill}
    />
  );
}

function ItemModalContent({
  modalItemId,
  editingItem,
  sortedCustomers,
  currentUser,
  newItemPrefill,
}: {
  modalItemId: string | null;
  editingItem: Item | undefined;
  sortedCustomers: Customer[];
  currentUser: string;
  newItemPrefill: Partial<Item> | null;
}) {
  const customers = useStore((state) => state.customers);
  const items = useStore((state) => state.items);
  const members = useStore((state) => state.members);
  const addItem = useStore((state) => state.addItem);
  const updateItem = useStore((state) => state.updateItem);
  const deleteItem = useStore((state) => state.deleteItem);
  const duplicateItem = useStore((state) => state.duplicateItem);
  const upsertCustomer = useStore((state) => state.upsertCustomer);
  const closeItemModal = useStore((state) => state.closeItemModal);

  const firstFieldRef = useRef<HTMLSelectElement>(null);
  const detailFieldRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLFormElement>(null);
  const ownerOptions = useMemo(
    () => [...new Set([...members, currentUser].filter(Boolean))].sort((a, b) => a.localeCompare(b, "th")),
    [members, currentUser],
  );

  const [form, setForm] = useState<FormState>(() =>
    createFormState(editingItem, sortedCustomers, currentUser, newItemPrefill),
  );
  const [errors, setErrors] = useState<FormErrors>({});

  const isNewCustomer = form.customerId === NEW_CUSTOMER_VALUE;
  const selectedCustomerId = isNewCustomer ? "" : form.customerId;
  const existingCustomerMatch = useMemo(() => {
    const name = form.newCustomerName.trim().toLowerCase();
    if (!isNewCustomer || !name) return undefined;
    return customers.find((customer) => customer.name.trim().toLowerCase() === name);
  }, [isNewCustomer, form.newCustomerName, customers]);
  const qtOptions = useMemo(
    () =>
      [
        ...new Set(
          items
            .filter((item) => item.customerId === selectedCustomerId)
            .map((item) => item.qtNo)
            .filter(Boolean),
        ),
      ].sort((a, b) => a.localeCompare(b, "th")),
    [items, selectedCustomerId],
  );
  const itemTypeOptions = useMemo(
    () => rankedItemTypeOptions(items, form.channel),
    [items, form.channel],
  );

  const isCloseout = form.execStatus === "published" || form.execStatus === "done";
  // Collapsed for a brand-new, not-yet-closeout item so the create flow shows
  // only the core fields; expanded by default when editing (never hide
  // close-out data) and auto-expanded once execStatus reaches close-out.
  const [resultsExpanded, setResultsExpanded] = useState(() => Boolean(editingItem) || isCloseout);
  // Adjust state while rendering (React's documented pattern for reacting to
  // a derived value changing) instead of an effect, so reaching close-out
  // forces the section open in the same render — no extra effect/render
  // pass, and no fight with the user's own manual toggle beforehand.
  const [previousIsCloseout, setPreviousIsCloseout] = useState(isCloseout);
  if (isCloseout !== previousIsCloseout) {
    setPreviousIsCloseout(isCloseout);
    if (isCloseout && !resultsExpanded) setResultsExpanded(true);
  }
  const handleResultsToggle = (event: SyntheticEvent<HTMLDetailsElement>) => {
    setResultsExpanded(event.currentTarget.open);
  };
  const targetActualPct = useMemo(() => {
    const target = Number(form.targetValue.replace(/,/g, ""));
    const actual = Number(form.actualValue.replace(/,/g, ""));
    if (!form.targetValue.trim() || !form.actualValue.trim()) return null;
    if (!Number.isFinite(target) || !Number.isFinite(actual) || target === 0) return null;
    return Math.round((actual / target) * 100);
  }, [form.targetValue, form.actualValue]);

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
      if (event.key === "Escape") closeItemModal();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [closeItemModal]);

  const title = editingItem ? "แก้ไขชิ้นงาน" : "เพิ่มชิ้นงาน";

  const updateField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    if (key === "customerId" || key === "newCustomerName") {
      setErrors((current) => ({ ...current, customer: undefined }));
    }
    if (key === "itemType") {
      setErrors((current) => ({ ...current, itemType: undefined }));
    }
    if (key === "price") {
      setErrors((current) => ({ ...current, price: undefined }));
    }
  };

  const handleExecStatusChange = (execStatus: ExecStatus) => {
    setForm((current) => ({
      ...current,
      execStatus,
      progress:
        current.progress === execToProgress(current.execStatus)
          ? execToProgress(execStatus)
          : current.progress,
    }));
  };

  const updateChecklistEntry = (id: string, patch: Partial<Item["checklist"][number]>) => {
    setForm((current) => ({
      ...current,
      checklist: current.checklist.map((entry) =>
        entry.id === id ? { ...entry, ...patch, id: entry.id } : entry,
      ),
    }));
  };

  const addChecklistEntry = () => {
    setForm((current) => ({
      ...current,
      checklist: [...current.checklist, createChecklistEntry()],
    }));
  };

  const removeChecklistEntry = (id: string) => {
    setForm((current) => ({
      ...current,
      checklist: current.checklist.filter((entry) => entry.id !== id),
    }));
  };

  const handleCustomerChange = (value: string) => {
    setForm((current) => ({
      ...current,
      customerId: value,
      newCustomerName: "",
      newCustomerProvince: "",
      newCustomerSalesOwner: currentUser,
    }));
    setErrors((current) => ({ ...current, customer: undefined }));
  };

  // Shared by normal submit and "save & add another" — validates, resolves
  // the customer, persists the item, and reports back which customer the
  // item ended up under. Returns null (after setting field errors) when
  // validation fails, so callers can bail out without closing/resetting.
  const saveForm = (): { customerId: string } | null => {
    const nextErrors = validateForm(form, customers.map((customer) => customer.id));
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      return null;
    }

    const customerId = isNewCustomer
      ? upsertCustomer({
          name: form.newCustomerName.trim(),
          province: form.newCustomerProvince.trim(),
          salesOwner: form.newCustomerSalesOwner.trim(),
        })
      : form.customerId;

    const payload: Partial<Item> & { customerId: string; itemType: string } = {
      customerId,
      qtNo: form.qtNo.trim(),
      invNo: form.invNo.trim(),
      channel: form.channel,
      itemType: form.itemType.trim(),
      detail: form.detail.trim(),
      price: parsePriceInput(form.price),
      execStatus: form.execStatus,
      resultStatus: form.resultStatus,
      reportStatus: form.reportStatus,
      renewalStatus: form.renewalStatus,
      target: form.target.trim(),
      actual: form.actual.trim(),
      metricName: form.metricName.trim(),
      metricUnit: form.metricUnit.trim(),
      targetValue: parseNumberInput(form.targetValue),
      actualValue: parseNumberInput(form.actualValue),
      reportSentDate:
        form.reportStatus === "sent" && !form.reportSentDate
          ? new Date().toISOString().slice(0, 10)
          : form.reportSentDate,
      rating: form.rating,
      link: form.link.trim(),
      deadline: form.deadline,
      publishDate: form.publishDate,
      finishedDate: form.finishedDate,
      notes: form.notes.trim(),
      followUpDate: form.followUpDate,
      followUpNote: form.followUpNote.trim(),
      priority: form.priority,
      progress: clampPercentInput(form.progress),
      checklist: form.checklist.map((entry) => ({ ...entry })),
    };

    if (editingItem && modalItemId) {
      updateItem(modalItemId, payload);
    } else {
      addItem(payload);
    }

    return { customerId };
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saveForm()) closeItemModal();
  };

  // Create-only: saves the current item, then resets the form for the next
  // line on the same quotation instead of closing the modal — keeps
  // customer/QT/channel/itemType so reps can keep adding lines quickly.
  const handleSaveAndAddAnother = () => {
    const result = saveForm();
    if (!result) return;

    setForm((current) => createResetFormState(current, result.customerId, sortedCustomers, currentUser));
    setErrors({});
    setResultsExpanded(false);
    detailFieldRef.current?.focus();
  };

  const handleOverlayClick = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) closeItemModal();
  };

  const handleDelete = () => {
    if (!editingItem || !modalItemId) return;
    if (!window.confirm("ลบชิ้นงานนี้?")) return;

    deleteItem(modalItemId);
    closeItemModal();
  };

  const handleDuplicate = () => {
    if (!editingItem || !modalItemId) return;

    duplicateItem(modalItemId);
    closeItemModal();
  };

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto overscroll-contain bg-black/50 px-3 py-4 backdrop-blur-sm sm:px-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="item-modal-title"
      onMouseDown={handleOverlayClick}
    >
      <form
        ref={containerRef}
        noValidate
        onSubmit={handleSubmit}
        className={`mx-auto flex max-h-[calc(100vh-2rem)] w-full max-w-3xl flex-col overflow-hidden ${cardClass}`}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border-soft px-5 py-4 sm:px-6">
          <h2 id="item-modal-title" className="text-lg font-semibold text-ink">
            {title}
          </h2>
          <button
            type="button"
            onClick={closeItemModal}
            className="grid size-9 shrink-0 place-items-center rounded-lg text-muted transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-100"
            aria-label="ปิด"
            title="ปิด"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 sm:px-6">
          <div className="divide-y divide-border-soft">
            <FormSection title="ข้อมูลลูกค้า">
              <label className="block">
                <span className={labelClass}>
                  ลูกค้า <span className="text-error-dark">*</span>
                </span>
                <select
                  ref={firstFieldRef}
                  value={form.customerId}
                  onChange={(event) => handleCustomerChange(event.target.value)}
                  className={fieldClass}
                  aria-invalid={Boolean(errors.customer)}
                  aria-describedby={errors.customer ? "item-modal-customer-error" : undefined}
                >
                  <option value="">เลือกลูกค้า</option>
                  {sortedCustomers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.name}
                    </option>
                  ))}
                  <option value={NEW_CUSTOMER_VALUE}>＋ ลูกค้าใหม่</option>
                </select>
                {errors.customer ? (
                  <p id="item-modal-customer-error" className={errorClass}>
                    {errors.customer}
                  </p>
                ) : null}
              </label>

              {isNewCustomer ? (
                <div className="grid gap-4 rounded-lg border border-brand-100 bg-primary-light p-3 sm:col-span-2 sm:grid-cols-3">
                  <label className="block">
                    <span className={labelClass}>
                      ลูกค้าใหม่ <span className="text-error-dark">*</span>
                    </span>
                    <input
                      value={form.newCustomerName}
                      onChange={(event) => updateField("newCustomerName", event.target.value)}
                      className={fieldClass}
                      placeholder="ชื่อลูกค้า"
                    />
                    {existingCustomerMatch ? (
                      <p className="mt-1 text-xs font-medium text-warning-dark">
                        มีลูกค้าชื่อนี้อยู่แล้ว
                        {existingCustomerMatch.province ? ` (${existingCustomerMatch.province})` : ""} —
                        จะใช้อันเดิม ไม่สร้างซ้ำ
                      </p>
                    ) : null}
                  </label>
                  <label className="block">
                    <span className={labelClass}>จังหวัด</span>
                    <input
                      value={form.newCustomerProvince}
                      onChange={(event) => updateField("newCustomerProvince", event.target.value)}
                      className={fieldClass}
                      placeholder="จังหวัด"
                    />
                  </label>
                  <label className="block">
                    <span className={labelClass}>เจ้าของงานขาย</span>
                    <input
                      value={form.newCustomerSalesOwner}
                      onChange={(event) => updateField("newCustomerSalesOwner", event.target.value)}
                      className={fieldClass}
                      list="item-modal-owner-list"
                      placeholder="เลือกหรือพิมพ์ชื่อ"
                    />
                    <datalist id="item-modal-owner-list">
                      {ownerOptions.map((owner) => (
                        <option key={owner} value={owner} />
                      ))}
                    </datalist>
                  </label>
                </div>
              ) : null}
            </FormSection>

            <FormSection title="รายละเอียดชิ้นงาน">
              <label className="block">
                <span className={labelClass}>เลขใบเสนอราคา (QT)</span>
                <input
                  value={form.qtNo}
                  onChange={(event) => updateField("qtNo", event.target.value)}
                  className={fieldClass}
                  list="item-modal-qt-list"
                  placeholder="QO-..."
                />
                <datalist id="item-modal-qt-list">
                  {qtOptions.map((qtNo) => (
                    <option key={qtNo} value={qtNo} />
                  ))}
                </datalist>
              </label>

              <label className="block">
                <span className={labelClass}>เลขที่ใบวางบิล (INV)</span>
                <input
                  value={form.invNo}
                  onChange={(event) => updateField("invNo", event.target.value)}
                  className={fieldClass}
                  placeholder="IV-..."
                />
              </label>

              <label className="block">
                <span className={labelClass}>ช่องทาง</span>
                <select
                  value={form.channel}
                  onChange={(event) => updateField("channel", event.target.value as ChannelKey)}
                  className={fieldClass}
                >
                  {CHANNEL.map((channel) => (
                    <option key={channel.key} value={channel.key}>
                      {channel.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className={labelClass}>
                  รายการ <span className="text-error-dark">*</span>
                </span>
                <input
                  value={form.itemType}
                  onChange={(event) => updateField("itemType", event.target.value)}
                  className={fieldClass}
                  list="item-modal-item-type-list"
                  placeholder="เช่น บทความ AIO, Top Ads"
                  aria-invalid={Boolean(errors.itemType)}
                  aria-describedby={errors.itemType ? "item-modal-item-type-error" : undefined}
                />
                <datalist id="item-modal-item-type-list">
                  {itemTypeOptions.map((itemType) => (
                    <option key={itemType} value={itemType} />
                  ))}
                </datalist>
                {errors.itemType ? (
                  <p id="item-modal-item-type-error" className={errorClass}>
                    {errors.itemType}
                  </p>
                ) : null}
              </label>

              <label className="block sm:col-span-2">
                <span className={labelClass}>รายละเอียด</span>
                <textarea
                  ref={detailFieldRef}
                  value={form.detail}
                  onChange={(event) => updateField("detail", event.target.value)}
                  rows={2}
                  className={textareaClass}
                  placeholder="รายละเอียดชิ้นงาน"
                />
              </label>

              <label className="block">
                <span className={labelClass}>ราคา VAT7%</span>
                <input
                  value={form.price}
                  onChange={(event) => updateField("price", event.target.value)}
                  className={`${fieldClass} tnum`}
                  inputMode="decimal"
                  placeholder="0"
                  aria-invalid={Boolean(errors.price)}
                  aria-describedby={errors.price ? "item-modal-price-error" : undefined}
                />
                {errors.price ? (
                  <p id="item-modal-price-error" className={errorClass}>
                    {errors.price}
                  </p>
                ) : null}
              </label>
            </FormSection>

            <FormSection title="สถานะและผลลัพธ์">
              {isCloseout ? (
                <div className="rounded-lg border border-warning/30 bg-warning-light p-3 sm:col-span-2">
                  <p className="flex items-center gap-1.5 text-sm font-semibold text-warning-dark">
                    <ClipboardCheck className="size-4 shrink-0" aria-hidden="true" />
                    ปิดงาน (Close-out) — งานเผยแพร่แล้ว เก็บผลให้ครบ
                  </p>
                  <ul className="mt-2 grid gap-1 text-xs sm:grid-cols-2">
                    <CloseoutCheck done={form.resultStatus !== "not_collected"} label="บันทึกสถานะผลลัพธ์" />
                    <CloseoutCheck done={Boolean(form.actualValue.trim())} label="กรอกตัวเลขผลจริง" />
                    <CloseoutCheck done={form.rating > 0} label="ให้คะแนน ⭐" />
                    <CloseoutCheck done={form.reportStatus === "sent"} label="ส่งรีพอร์ตให้ลูกค้า" />
                  </ul>
                </div>
              ) : null}

              <label className="block">
                <span className={labelClass}>การดำเนินการ</span>
                <select
                  value={form.execStatus}
                  onChange={(event) => handleExecStatusChange(event.target.value as ExecStatus)}
                  className={fieldClass}
                >
                  {EXEC_STATUS.map((status) => (
                    <option key={status.key} value={status.key}>
                      {status.label}
                    </option>
                  ))}
                </select>
              </label>

              <details
                open={resultsExpanded}
                onToggle={handleResultsToggle}
                className="group rounded-lg border border-border bg-slate-50/70 px-4 py-3 open:pb-4 sm:col-span-2"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-sm font-semibold text-ink [&::-webkit-details-marker]:hidden">
                  <span>บันทึกผลลัพธ์ (ตอนปิดงาน)</span>
                  <ChevronDown
                    className="size-4 shrink-0 text-muted transition-transform duration-200 group-open:rotate-180"
                    aria-hidden="true"
                  />
                </summary>
                <div className="mt-3 grid gap-4 border-t border-border pt-4 sm:grid-cols-2">
                  <label className="block">
                    <span className={labelClass}>ผลลัพธ์</span>
                    <select
                      value={form.resultStatus}
                      onChange={(event) => updateField("resultStatus", event.target.value as ResultStatus)}
                      className={fieldClass}
                    >
                      {RESULT_STATUS.map((status) => (
                        <option key={status.key} value={status.key}>
                          {status.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block">
                    <span className={labelClass}>รีพอร์ต</span>
                    <select
                      value={form.reportStatus}
                      onChange={(event) => updateField("reportStatus", event.target.value as ReportStatus)}
                      className={fieldClass}
                    >
                      {REPORT_STATUS.map((status) => (
                        <option key={status.key} value={status.key}>
                          {status.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block">
                    <span className={labelClass}>การต่ออายุ</span>
                    <select
                      value={form.renewalStatus}
                      onChange={(event) => updateField("renewalStatus", event.target.value as RenewalStatus)}
                      className={fieldClass}
                    >
                      {RENEWAL_STATUS.map((status) => (
                        <option key={status.key} value={status.key}>
                          {status.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block">
                    <span className={labelClass}>เป้าหมาย ที่ต้องการ</span>
                    <input
                      value={form.target}
                      onChange={(event) => updateField("target", event.target.value)}
                      className={fieldClass}
                    />
                  </label>

                  <label className="block">
                    <span className={labelClass}>ผลลัพธ์ที่เกิดขึ้น</span>
                    <input
                      value={form.actual}
                      onChange={(event) => updateField("actual", event.target.value)}
                      className={fieldClass}
                    />
                  </label>

                  <label className="block">
                    <span className={labelClass}>ตัวชี้วัด (metric)</span>
                    <input
                      value={form.metricName}
                      onChange={(event) => updateField("metricName", event.target.value)}
                      className={fieldClass}
                      placeholder="เช่น ยอดเข้าถึง / ยอดวิว / ยอดจอง"
                    />
                  </label>

                  <label className="block">
                    <span className={labelClass}>หน่วย</span>
                    <input
                      value={form.metricUnit}
                      onChange={(event) => updateField("metricUnit", event.target.value)}
                      className={fieldClass}
                      placeholder="ครั้ง / % / คน"
                    />
                  </label>

                  <label className="block">
                    <span className={labelClass}>เป้าหมาย (ตัวเลข)</span>
                    <input
                      inputMode="numeric"
                      value={form.targetValue}
                      onChange={(event) => updateField("targetValue", event.target.value)}
                      className={fieldClass}
                      placeholder="0"
                    />
                  </label>

                  <label className="block">
                    <span className={labelClass}>ผลจริง (ตัวเลข)</span>
                    <input
                      inputMode="numeric"
                      value={form.actualValue}
                      onChange={(event) => updateField("actualValue", event.target.value)}
                      className={fieldClass}
                      placeholder="0"
                    />
                    {targetActualPct !== null ? (
                      <span
                        className={`mt-1 block text-xs font-semibold ${
                          targetActualPct >= 100 ? "text-success-dark" : "text-warning-dark"
                        }`}
                      >
                        {targetActualPct.toLocaleString("th-TH")}% ของเป้าหมาย
                      </span>
                    ) : null}
                  </label>

                  {form.reportStatus === "sent" ? (
                    <label className="block">
                      <span className={labelClass}>วันที่ส่งรีพอร์ต</span>
                      <input
                        type="date"
                        value={form.reportSentDate}
                        onChange={(event) => updateField("reportSentDate", event.target.value)}
                        className={fieldClass}
                      />
                    </label>
                  ) : null}

                  <fieldset className="m-0 min-w-0 border-0 p-0">
                    <legend className={`${labelClass} p-0`}>ให้คะแนน</legend>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {RATING_OPTIONS.map((option) => {
                        const checked = form.rating === option.value;
                        return (
                          <label
                            key={option.value}
                            className={`inline-flex h-8 min-w-8 cursor-pointer items-center justify-center rounded-full border px-2.5 text-sm font-medium transition has-[:focus-visible]:outline-none has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-100 has-[:focus-visible]:ring-offset-1 ${
                              checked
                                ? "border-brand-600 bg-brand-600 text-white"
                                : "border-slate-300 text-slate-600 hover:bg-slate-50"
                            }`}
                          >
                            <input
                              type="radio"
                              name="rating"
                              value={option.value}
                              checked={checked}
                              onChange={() => updateField("rating", option.value)}
                              className="sr-only"
                            />
                            {option.label}
                          </label>
                        );
                      })}
                    </div>
                  </fieldset>
                </div>
              </details>
            </FormSection>

            <FormSection title="ลิงก์ กำหนดการ และโน้ต">
              <label className="block sm:col-span-2">
                <span className={labelClass}>Link งาน</span>
                <input
                  value={form.link}
                  onChange={(event) => updateField("link", event.target.value)}
                  type="url"
                  inputMode="url"
                  className={fieldClass}
                  placeholder="https://..."
                />
              </label>

              <div className="grid grid-cols-1 gap-4 sm:col-span-2 sm:grid-cols-3">
                <label className="block">
                  <span className={labelClass}>Deadline</span>
                  <input
                    value={form.deadline}
                    onChange={(event) => updateField("deadline", event.target.value)}
                    type="date"
                    className={fieldClass}
                  />
                </label>

                <label className="block">
                  <span className={labelClass}>Publish</span>
                  <input
                    value={form.publishDate}
                    onChange={(event) => updateField("publishDate", event.target.value)}
                    type="date"
                    className={fieldClass}
                  />
                </label>

                <label className="block">
                  <span className={labelClass}>Finished</span>
                  <input
                    value={form.finishedDate}
                    onChange={(event) => updateField("finishedDate", event.target.value)}
                    type="date"
                    className={fieldClass}
                  />
                </label>
              </div>

              <label className="block">
                <span className={labelClass}>วันติดตามครั้งถัดไป</span>
                <input
                  value={form.followUpDate}
                  onChange={(event) => updateField("followUpDate", event.target.value)}
                  type="date"
                  className={fieldClass}
                />
              </label>

              <label className="block">
                <span className={labelClass}>โน้ตติดตาม</span>
                <input
                  value={form.followUpNote}
                  onChange={(event) => updateField("followUpNote", event.target.value)}
                  className={fieldClass}
                  placeholder="เช่น โทรกลับศุกร์นี้"
                />
              </label>

              <label className="block sm:col-span-2">
                <span className={labelClass}>โน้ต</span>
                <textarea
                  value={form.notes}
                  onChange={(event) => updateField("notes", event.target.value)}
                  rows={2}
                  className={textareaClass}
                  placeholder="รายละเอียดเพิ่มเติม"
                />
              </label>
            </FormSection>

            <div className="pt-6">
              <details className="group rounded-lg border border-border bg-slate-50/70 px-4 py-3 open:pb-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-sm font-semibold text-ink [&::-webkit-details-marker]:hidden">
                  <span>ตัวเลือกเพิ่มเติม</span>
                  <ChevronDown
                    className="size-4 shrink-0 text-muted transition-transform duration-200 group-open:rotate-180"
                    aria-hidden="true"
                  />
                </summary>
                <div className="mt-3 grid gap-4 border-t border-border pt-4 sm:grid-cols-2">
                  <label className="block">
                    <span className={labelClass}>ความสำคัญ</span>
                    <select
                      value={form.priority}
                      onChange={(event) => updateField("priority", event.target.value as PriorityKey)}
                      className={fieldClass}
                    >
                      {PRIORITY.map((priority) => (
                        <option key={priority.key} value={priority.key}>
                          {priority.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block">
                    <span className={labelClass}>ความคืบหน้า</span>
                    <span className="flex items-center gap-2">
                      <input
                        value={form.progress}
                        onChange={(event) =>
                          updateField("progress", clampPercentInput(event.target.value))
                        }
                        type="number"
                        min={0}
                        max={100}
                        className={`${fieldClass} tnum`}
                      />
                      <span className="text-sm font-medium text-muted">%</span>
                    </span>
                  </label>

                  <div className="sm:col-span-2">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-muted">เช็คลิสต์</span>
                      <button
                        type="button"
                        onClick={addChecklistEntry}
                        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-100"
                      >
                        <Plus className="size-4" aria-hidden="true" />
                        เพิ่ม
                      </button>
                    </div>

                    {form.checklist.length ? (
                      <div className="space-y-2">
                        {form.checklist.map((entry) => (
                          <div
                            key={entry.id}
                            className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2"
                          >
                            <input
                              type="checkbox"
                              checked={entry.done}
                              onChange={(event) =>
                                updateChecklistEntry(entry.id, { done: event.target.checked })
                              }
                              className="size-4 rounded border-slate-300 text-brand-600 focus-visible:ring-brand-100"
                              aria-label="ทำรายการเช็คลิสต์เสร็จแล้ว"
                            />
                            <input
                              value={entry.text}
                              onChange={(event) =>
                                updateChecklistEntry(entry.id, { text: event.target.value })
                              }
                              className={fieldClass}
                              placeholder="รายการเช็คลิสต์"
                            />
                            <button
                              type="button"
                              onClick={() => removeChecklistEntry(entry.id)}
                              className="grid size-10 place-items-center rounded-lg text-muted transition hover:bg-error-light hover:text-error-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error/30"
                              aria-label="ลบรายการเช็คลิสต์"
                              title="ลบรายการเช็คลิสต์"
                            >
                              <Trash2 className="size-4" aria-hidden="true" />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="rounded-lg border border-dashed border-border bg-white px-3 py-2 text-xs text-muted">
                        ยังไม่มีเช็คลิสต์
                      </p>
                    )}
                  </div>
                </div>
              </details>
            </div>
          </div>
        </div>

        <footer className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-border-soft px-5 py-4 sm:px-6">
          {editingItem ? (
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={handleDelete} className={destructiveButtonClass}>
                <Trash2 className="size-4" aria-hidden="true" />
                ลบ
              </button>
              <button type="button" onClick={handleDuplicate} className={secondaryButtonClass}>
                <Copy className="size-4" aria-hidden="true" />
                ทำซ้ำ
              </button>
            </div>
          ) : (
            <span />
          )}
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={closeItemModal} className={secondaryButtonClass}>
              ยกเลิก
            </button>
            {!editingItem ? (
              <button type="button" onClick={handleSaveAndAddAnother} className={tintedBtnClass}>
                บันทึก & เพิ่มอีก
              </button>
            ) : null}
            <button type="submit" className={primaryButtonClass}>
              <Save className="size-4" aria-hidden="true" />
              บันทึก
            </button>
          </div>
        </footer>
      </form>
    </div>
  );
}

// Fields a contextual "add item" prefill (see `openNewItem` in the store) can
// carry onto a brand-new item's defaults. Only meaningful when there is no
// `editingItem` — edit-mode always keeps the existing item's own values.
function createFormState(
  item: Item | undefined,
  customers: { id: string }[],
  currentUser: string,
  prefill?: Partial<Item> | null,
): FormState {
  return {
    customerId: item
      ? item.customerId
      : prefill?.customerId || customers[0]?.id || NEW_CUSTOMER_VALUE,
    newCustomerName: "",
    newCustomerProvince: "",
    newCustomerSalesOwner: currentUser,
    qtNo: item ? item.qtNo || "" : prefill?.qtNo || "",
    invNo: item?.invNo || "",
    channel: item ? item.channel || "web" : prefill?.channel || "web",
    itemType: item?.itemType || "",
    detail: item?.detail || "",
    price: item?.price === null || item?.price === undefined ? "" : String(item.price),
    execStatus: item?.execStatus || "not_started",
    resultStatus: item?.resultStatus || "not_collected",
    reportStatus: item?.reportStatus || "not_sent",
    renewalStatus: item?.renewalStatus || "pending",
    target: item?.target || "",
    actual: item?.actual || "",
    metricName: item?.metricName || "",
    metricUnit: item?.metricUnit || "",
    targetValue: item?.targetValue != null ? String(item.targetValue) : "",
    actualValue: item?.actualValue != null ? String(item.actualValue) : "",
    reportSentDate: item?.reportSentDate || "",
    rating: item?.rating || 0,
    link: item?.link || "",
    deadline: item?.deadline || "",
    publishDate: item?.publishDate || "",
    finishedDate: item?.finishedDate || "",
    notes: item?.notes || "",
    followUpDate: item?.followUpDate || "",
    followUpNote: item?.followUpNote || "",
    priority: item?.priority || "medium",
    progress: clampPercentInput(item?.progress ?? execToProgress(item?.execStatus || "not_started")),
    checklist: item?.checklist.map((entry) => ({ ...entry })) || [],
  };
}

// Used by "save & add another" (create-only): starts from a fresh blank
// item, then carries over the fields worth repeating across lines of the
// same quotation — everything else (detail, price, dates, statuses,
// metrics, rating, notes, checklist, ...) goes back to its default so the
// rep isn't looking at stale close-out data for the next item.
function createResetFormState(
  previous: FormState,
  resolvedCustomerId: string,
  sortedCustomers: { id: string }[],
  currentUser: string,
): FormState {
  const blank = createFormState(undefined, sortedCustomers, currentUser);
  return {
    ...blank,
    customerId: resolvedCustomerId || blank.customerId,
    qtNo: previous.qtNo.trim(),
    channel: previous.channel,
    itemType: previous.itemType.trim(),
  };
}

// Distinguishes one contextual prefill from another (or from a truly blank
// add) so the modal's `key` remounts and re-initializes the form instead of
// reusing a stale instance when the prefill changes.
function prefillKey(prefill: Partial<Item> | null): string {
  if (!prefill) return "blank";
  return [prefill.customerId, prefill.qtNo, prefill.channel].filter(Boolean).join("|") || "blank";
}

function CloseoutCheck({ done, label }: { done: boolean; label: string }) {
  return (
    <li className={`flex items-center gap-1.5 ${done ? "text-success-dark" : "text-warning-dark"}`}>
      <span
        className={`grid size-4 shrink-0 place-items-center rounded-full ${
          done ? "bg-success text-white" : "border border-warning text-transparent"
        }`}
      >
        <Check className="size-3" aria-hidden="true" />
      </span>
      {label}
    </li>
  );
}

function parseNumberInput(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed.replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function createChecklistEntry(): Item["checklist"][number] {
  return {
    id: `ck_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    text: "",
    done: false,
  };
}

function validateForm(form: FormState, customerIds: string[]): FormErrors {
  const errors: FormErrors = {};
  const isNewCustomer = form.customerId === NEW_CUSTOMER_VALUE;

  if (!form.customerId) {
    errors.customer = "กรุณาเลือกลูกค้า";
  } else if (isNewCustomer && !form.newCustomerName.trim()) {
    errors.customer = "กรุณากรอกชื่อลูกค้าใหม่";
  } else if (!isNewCustomer && !customerIds.includes(form.customerId)) {
    errors.customer = "กรุณาเลือกลูกค้า";
  }

  if (!form.itemType.trim()) {
    errors.itemType = "กรุณากรอกรายการ";
  }

  if (form.price.trim() && parsePriceInput(form.price) === null) {
    errors.price = "กรุณากรอกราคาเป็นตัวเลข";
  }

  return errors;
}

function parsePriceInput(value: string) {
  const normalized = value.replace(/,/g, "").trim();
  if (!normalized) return null;

  const price = Number(normalized);
  return Number.isFinite(price) && price >= 0 ? price : null;
}

function clampPercentInput(value: unknown) {
  const progress = Number.parseInt(String(value), 10);
  if (Number.isNaN(progress)) return 0;
  return Math.max(0, Math.min(100, progress));
}
