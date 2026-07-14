import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ItemModal } from "@/components/ItemModal";
import { useStore } from "@/lib/store";
import { makeCustomer, makeItem } from "./factory";

const ADD_NEW_ASSIGNEE_LABEL = "＋ เพิ่มรายชื่อใหม่…";
const ASSIGNEE_SELECT_LABEL = "ผู้รับผิดชอบงานย่อย";

describe("ItemModal — subtask 'เพิ่มรายชื่อใหม่' inline add-assignee flow", () => {
  function setUpItemWithOneSubtask() {
    const customer = makeCustomer({ id: "c1", name: "ลูกค้า A", salesOwner: "พี่ไซน์" });
    const item = makeItem({
      id: "i1",
      customerId: "c1",
      checklist: [
        { id: "ck1", title: "งานย่อย 1", description: "", done: false, assignee: "", startDate: "", dueDate: "" },
      ],
    });
    useStore.setState({
      customers: [customer],
      items: [item],
      members: ["พี่บอส"],
      teamRoster: ["พี่ก้อย", "พี่แนน"],
      settings: { currentUser: "พี่ไซน์" },
      modalItemId: "i1",
      isItemModalOpen: true,
      newItemPrefill: null,
    });
  }

  // Opens the assignee <select> for the (only) subtask and switches it to the
  // "+ เพิ่มรายชื่อใหม่…" sentinel option, which swaps the <select> for an
  // inline text input.
  function openAddAssigneeInput() {
    const select = screen.getByLabelText(ASSIGNEE_SELECT_LABEL) as HTMLSelectElement;
    const addOption = within(select).getByText(ADD_NEW_ASSIGNEE_LABEL) as HTMLOptionElement;
    fireEvent.change(select, { target: { value: addOption.value } });
    return screen.getByLabelText("ชื่อผู้รับผิดชอบใหม่") as HTMLInputElement;
  }

  afterEach(() => {
    cleanup();
    useStore.setState({
      customers: [],
      items: [],
      members: [],
      teamRoster: [],
      modalItemId: null,
      isItemModalOpen: false,
      newItemPrefill: null,
    });
  });

  it("confirming a brand-new name calls addMember and selects it as the assignee", () => {
    setUpItemWithOneSubtask();
    render(<ItemModal />);

    const input = openAddAssigneeInput();
    fireEvent.change(input, { target: { value: "พี่ใหม่" } });
    fireEvent.click(screen.getByLabelText("ยืนยันชื่อผู้รับผิดชอบใหม่"));

    // addMember was called: the central members list grew.
    expect(useStore.getState().members).toEqual(["พี่บอส", "พี่ใหม่"]);

    // The inline input closed and the <select> is back, now selecting the new name.
    const select = screen.getByLabelText(ASSIGNEE_SELECT_LABEL) as HTMLSelectElement;
    expect(select.value).toBe("พี่ใหม่");
    expect(screen.queryByLabelText("ชื่อผู้รับผิดชอบใหม่")).toBeNull();

    // The modal is still open — confirming an add must not close it.
    expect(useStore.getState().isItemModalOpen).toBe(true);
  });

  it("confirming a name that already exists in the option list does not add a duplicate to members", () => {
    setUpItemWithOneSubtask();
    render(<ItemModal />);

    // "พี่ก้อย" is already a registered teamRoster name, so it's already in
    // assigneeOptions — confirming it must select it without calling addMember.
    const input = openAddAssigneeInput();
    fireEvent.change(input, { target: { value: "พี่ก้อย" } });
    fireEvent.click(screen.getByLabelText("ยืนยันชื่อผู้รับผิดชอบใหม่"));

    expect(useStore.getState().members).toEqual(["พี่บอส"]); // unchanged, no duplicate

    const select = screen.getByLabelText(ASSIGNEE_SELECT_LABEL) as HTMLSelectElement;
    expect(select.value).toBe("พี่ก้อย");
  });

  it("pressing Escape in the new-name input cancels the add without closing the modal", () => {
    setUpItemWithOneSubtask();
    render(<ItemModal />);

    const input = openAddAssigneeInput();
    fireEvent.change(input, { target: { value: "ชื่อที่ยังไม่ยืนยัน" } });
    fireEvent.keyDown(input, { key: "Escape" });

    // Cancelled: back to the <select>, still unassigned — not the typed name.
    const select = screen.getByLabelText(ASSIGNEE_SELECT_LABEL) as HTMLSelectElement;
    expect(select.value).toBe("");
    expect(screen.queryByLabelText("ชื่อผู้รับผิดชอบใหม่")).toBeNull();
    expect(useStore.getState().members).toEqual(["พี่บอส"]); // addMember was not called

    // Escape inside the input must stay scoped to cancelling the add — the
    // modal's own window-level Escape handler must not also fire.
    expect(useStore.getState().isItemModalOpen).toBe(true);
    expect(screen.getByRole("dialog")).toBeTruthy();
  });
});
