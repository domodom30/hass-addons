import { describe, it, expect, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import { createPinia } from "pinia";
import CapabilityBadges from "@/components/CapabilityBadges.vue";
import { A2DP_SINK, AVRCP_TARGET } from "@/profiles.js";

let pinia;
beforeEach(() => {
  pinia = createPinia();
});

function mountWith(device) {
  return mount(CapabilityBadges, {
    props: { device },
    global: { plugins: [pinia] },
  });
}

describe("CapabilityBadges", () => {
  it("marks the active A2DP profile with a check when connected", () => {
    const w = mountWith({ connected: true, uuids: [A2DP_SINK] });
    expect(w.text()).toContain("A2DP ✓");
  });

  it("shows A2DP without a check when only discovered", () => {
    const w = mountWith({ connected: false, uuids: [A2DP_SINK] });
    expect(w.text()).toContain("A2DP");
    expect(w.text()).not.toContain("A2DP ✓");
  });

  it("flags disabled media buttons with a cross when connected", () => {
    const w = mountWith({
      connected: true,
      uuids: [AVRCP_TARGET],
      avrcp_enabled: false,
    });
    expect(w.text()).toContain("AVRCP ✗");
  });

  it("renders a hidden placeholder badge when no capabilities", () => {
    const w = mountWith({ connected: false, uuids: [] });
    expect(w.find(".cap-badge").exists()).toBe(true);
  });
});
