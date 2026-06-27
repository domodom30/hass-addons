import { defineStore } from "pinia";

const MAX_LOG_ENTRIES = 1000;
let _logId = 0;

// Application log buffer with level/text filtering, live toggle and a ring
// buffer. Ports app.js §10. Filtering is a reactive getter instead of manual
// re-render. The "live" toggle controls whether new entries are appended.
export const useLogsStore = defineStore("logs", {
  state: () => ({
    entries: [], // { id, ts, level, logger, message }
    levelFilter: "",
    search: "",
    live: true,
    autoScroll: true,
  }),
  getters: {
    filtered: (state) => {
      const search = state.search.toLowerCase();
      return state.entries.filter((e) => {
        if (state.levelFilter && e.level !== state.levelFilter) return false;
        if (
          search &&
          !e.message.toLowerCase().includes(search) &&
          !(e.logger || "").toLowerCase().includes(search)
        ) {
          return false;
        }
        return true;
      });
    },
  },
  actions: {
    add(data) {
      // Always buffer; the "live" toggle freezes the *view* (see LogsView),
      // it must not drop entries from the ring buffer.
      this.entries.push({ id: ++_logId, ...data });
      if (this.entries.length > MAX_LOG_ENTRIES) {
        this.entries = this.entries.slice(-MAX_LOG_ENTRIES);
      }
    },
  },
});
