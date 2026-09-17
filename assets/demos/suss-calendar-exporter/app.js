(() => {
  const TZID = "Asia/Singapore";

  const monthMap = {
    JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6,
    JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12
  };

  const pad2 = (n) => String(n).padStart(2, "0");

  function toICSDateTimeLocal({ y, m, d, hh, mm }) {
    return `${y}${pad2(m)}${pad2(d)}T${pad2(hh)}${pad2(mm)}00`;
  }

  function toICSStampUTC(date = new Date()) {
    const y = date.getUTCFullYear();
    const m = date.getUTCMonth() + 1;
    const d = date.getUTCDate();
    const hh = date.getUTCHours();
    const mm = date.getUTCMinutes();
    const ss = date.getUTCSeconds();
    return `${y}${pad2(m)}${pad2(d)}T${pad2(hh)}${pad2(mm)}${pad2(ss)}Z`;
  }

  function escapeICS(text) {
    return String(text ?? "")
      .replace(/\\/g, "\\\\")
      .replace(/\n/g, "\\n")
      .replace(/\r/g, "")
      .replace(/,/g, "\\,")
      .replace(/;/g, "\\;");
  }

  function foldLine(line) {
    const max = 74;
    if (line.length <= max) return line;
    let out = "";
    let i = 0;
    while (i < line.length) {
      const chunk = line.slice(i, i + max);
      out += (i === 0 ? "" : "\r\n ") + chunk;
      i += max;
    }
    return out;
  }

  function parseDate(dstr) {
    const m = dstr.trim().toUpperCase().match(/^(\d{1,2})\s+([A-Z]{3})\s+(\d{4})$/);
    if (!m) return null;
    const d = parseInt(m[1], 10);
    const mon = monthMap[m[2]];
    const y = parseInt(m[3], 10);
    if (!mon) return null;
    return { y, m: mon, d };
  }

  function parseTime(tstr) {
    const m = tstr.trim().toUpperCase().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/);
    if (!m) return null;
    let hh = parseInt(m[1], 10);
    const mm = parseInt(m[2], 10);
    const ap = m[3];
    if (hh === 12) hh = 0;
    if (ap === "PM") hh += 12;
    return { hh, mm };
  }

  function buildVTimezoneAsiaSingapore() {
    return [
      "BEGIN:VTIMEZONE",
      "TZID:Asia/Singapore",
      "X-LIC-LOCATION:Asia/Singapore",
      "BEGIN:STANDARD",
      "TZOFFSETFROM:+0800",
      "TZOFFSETTO:+0800",
      "TZNAME:SGT",
      "DTSTART:19700101T000000",
      "END:STANDARD",
      "END:VTIMEZONE"
    ].join("\r\n");
  }

  function stripRecordedNotice(text) {
    return String(text ?? "").replace(
      /\[\s*Lesson\s+is\s+recorded[\s\S]*?attendance-?management\s+purposes\.\s*\]\s*/gi,
      ""
    ).trim();
  }

  // --- MODE HELPERS ---
  function getMode() {
    return document.getElementById("modeSingle").checked ? "single" : "full";
  }

  function getSingleMeta() {
    const course = (document.getElementById("singleCourse").value || "").trim().toUpperCase();
    const group = (document.getElementById("singleGroup").value || "").trim().toUpperCase();
    const semType = (document.getElementById("singleSemType").value || "").trim();

    return { course, group, semType };
  }

  // --- PARSERS ---
  function parseTimetableFull(raw) {
    const lines = raw
      .replace(/\r/g, "")
      .split("\n")
      .map(l => l.trim())
      .filter(Boolean);

    const events = [];
    const errors = [];

    for (const line of lines) {
      if (/^S\/N\s+COURSE\s+CODE/i.test(line)) continue;
      if (/^TIMETABLE\s+DETAILS/i.test(line)) continue;
      if (!/^\d+\t/.test(line)) continue;

      const parts0 = line.split("\t").map(s => s.trim());
      if (parts0.length < 10) {
        errors.push(`Not enough columns (full mode): ${line}`);
        continue;
      }

      const parts = parts0.slice(0, 9);
      parts.push(parts0.slice(9).join(" | "));

      const [sn, course, group, semType, dateStr, dayStr, timeFromStr, timeToStr, venueRaw, remarksRaw] = parts;

      const date = parseDate(dateStr);
      const tFrom = parseTime(timeFromStr);
      const tTo = parseTime(timeToStr);

      if (!date || !tFrom || !tTo) {
        errors.push(`Bad date/time (full mode): ${line}`);
        continue;
      }

      const venue = (venueRaw && venueRaw !== "-" ? venueRaw : "");
      const remarks = remarksRaw || "";

      events.push({ sn, course, group, semType, dateStr, dayStr, date, tFrom, tTo, venue, remarks });
    }

    return { events, errors };
  }

  function parseTimetableSingle(raw, meta) {
    const lines = raw
      .replace(/\r/g, "")
      .split("\n")
      .map(l => l.trim())
      .filter(Boolean);

    const events = [];
    const errors = [];

    // expected columns:
    // S/N | Date | Day | Time (From) | Time (To) | Venue | Remarks
    for (const line of lines) {
      if (/^S\/N\s+DATE/i.test(line)) continue;
      if (/^TIMETABLE\s+DETAILS/i.test(line)) continue;
      if (!/^\d+\t/.test(line)) continue;

      const parts0 = line.split("\t").map(s => s.trim());
      if (parts0.length < 7) {
        errors.push(`Not enough columns (single mode): ${line}`);
        continue;
      }

      const parts = parts0.slice(0, 6);
      parts.push(parts0.slice(6).join(" | ")); // merge extra into remarks

      const [sn, dateStr, dayStr, timeFromStr, timeToStr, venueRaw, remarksRaw] = parts;

      const date = parseDate(dateStr);
      const tFrom = parseTime(timeFromStr);
      const tTo = parseTime(timeToStr);

      if (!date || !tFrom || !tTo) {
        errors.push(`Bad date/time (single mode): ${line}`);
        continue;
      }

      const venue = (venueRaw && venueRaw !== "-" ? venueRaw : "");
      const remarks = remarksRaw || "";

      events.push({
        sn,
        course: meta.course,
        group: meta.group,
        semType: meta.semType,
        dateStr, dayStr, date, tFrom, tTo, venue, remarks
      });
    }

    return { events, errors };
  }

  function parseTimetableByMode(raw) {
    const mode = getMode();
    if (mode === "full") return parseTimetableFull(raw);

    const meta = getSingleMeta();
    if (!meta.course) {
      return {
        events: [],
        errors: ["Single module mode: please fill in Module Code (e.g. ICT162) above the preview."]
      };
    }
    return parseTimetableSingle(raw, meta);
  }

  function buildICS(events, opts) {
    const dtstamp = toICSStampUTC(new Date());

    const lines = [];
    lines.push("BEGIN:VCALENDAR");
    lines.push("VERSION:2.0");
    lines.push("PRODID:-//SUSS Timetable to ICS//EN");
    lines.push("CALSCALE:GREGORIAN");
    lines.push("METHOD:PUBLISH");
    lines.push(buildVTimezoneAsiaSingapore());

    for (const ev of events) {
      const uid = `${ev.course || "MODULE"}-${ev.group || "NA"}-${ev.date.y}${pad2(ev.date.m)}${pad2(ev.date.d)}-${pad2(ev.tFrom.hh)}${pad2(ev.tFrom.mm)}-${Math.random().toString(16).slice(2)}@suss-timetable`;

      const dtstart = toICSDateTimeLocal({ ...ev.date, hh: ev.tFrom.hh, mm: ev.tFrom.mm });
      const dtend   = toICSDateTimeLocal({ ...ev.date, hh: ev.tTo.hh,   mm: ev.tTo.mm });

      let summary = ev.course || "Lesson";
      if (opts.groupInTitle && ev.group) summary += ` (${ev.group})`;
      if (opts.venueInTitle && ev.venue) summary += ` @ ${ev.venue}`;

      let remarksClean = ev.remarks || "";
      if (opts.stripRecorded) remarksClean = stripRecordedNotice(remarksClean);

      const descLines = [
        `Course: ${ev.course || ""}`.trim(),
        ev.group ? `Group: ${ev.group}` : "",
        ev.semType ? `Semester Type: ${ev.semType}` : "",
        `Date: ${ev.dateStr} (${ev.dayStr})`,
        `Time: ${pad2(ev.tFrom.hh)}:${pad2(ev.tFrom.mm)} - ${pad2(ev.tTo.hh)}:${pad2(ev.tTo.mm)}`
      ].filter(Boolean);

      if (ev.venue) descLines.push(`Venue: ${ev.venue}`);
      if (remarksClean) descLines.push(`Remarks: ${remarksClean}`);

      lines.push("BEGIN:VEVENT");
      lines.push(foldLine(`UID:${escapeICS(uid)}`));
      lines.push(`DTSTAMP:${dtstamp}`);
      lines.push(foldLine(`SUMMARY:${escapeICS(summary)}`));
      lines.push(foldLine(`DTSTART;TZID=${TZID}:${dtstart}`));
      lines.push(foldLine(`DTEND;TZID=${TZID}:${dtend}`));
      if (ev.venue) lines.push(foldLine(`LOCATION:${escapeICS(ev.venue)}`));
      lines.push(foldLine(`DESCRIPTION:${escapeICS(descLines.join("\n"))}`));

      if (opts.alarm) {
        lines.push("BEGIN:VALARM");
        lines.push("TRIGGER:-PT15M");
        lines.push("ACTION:DISPLAY");
        lines.push(foldLine(`DESCRIPTION:${escapeICS("Reminder: " + summary)}`));
        lines.push("END:VALARM");
      }

      lines.push("END:VEVENT");
    }

    lines.push("END:VCALENDAR");
    return lines.join("\r\n") + "\r\n";
  }

  // Cross-device: Share Sheet (mobile) → download (desktop) → open tab fallback
  async function saveICS(filename, text) {
    const blob = new Blob([text], { type: "text/calendar;charset=utf-8" });

    try {
      if (navigator.share) {
        const file = new File([blob], filename, { type: blob.type });
        const canShareFiles = navigator.canShare ? navigator.canShare({ files: [file] }) : true;
        if (canShareFiles) {
          await navigator.share({ files: [file], title: filename });
          return;
        }
      }
    } catch {
      // user cancelled / not supported -> fallback
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();

    setTimeout(() => {
      try { window.open(url, "_blank", "noopener"); } catch {}
      setTimeout(() => URL.revokeObjectURL(url), 8000);
    }, 350);
  }

  function toPrettyTime(t) {
    const hh24 = t.hh;
    const mm = pad2(t.mm);
    const ap = hh24 >= 12 ? "PM" : "AM";
    let hh12 = hh24 % 12;
    if (hh12 === 0) hh12 = 12;
    return `${hh12}:${mm} ${ap}`;
  }

  function renderPreview(events, errors, opts) {
    const previewPanel = document.getElementById("previewPanel");
    const errorPanel = document.getElementById("errorPanel");
    const summary = document.getElementById("summary");
    const errBox = document.getElementById("errors");
    const table = document.getElementById("previewTable");
    const downloadBtn = document.getElementById("download");

    if (!events.length) {
      previewPanel.style.display = "none";
      downloadBtn.disabled = true;

      errorPanel.style.display = "block";
      errBox.textContent =
        "No events parsed.\n\n" +
        (errors.length ? ("Notes:\n- " + errors.join("\n- ")) : "Try copying the timetable table again from the portal.");
      return;
    }

    const venuesMissing = events.filter(e => !e.venue).length;

    summary.textContent =
      `✅ Parsed ${events.length} event(s)\n` +
      `📍 Missing venue: ${venuesMissing}\n` +
      `🧹 Remove “Lesson is recorded…”: ${opts.stripRecorded ? "on" : "off"}\n` +
      `🧾 Mode: ${getMode() === "full" ? "Entire timetable" : "Single module"}\n` +
      `🕒 Timezone: ${TZID}`;

    const header = `
      <thead>
        <tr>
          <th>Date</th>
          <th>Day</th>
          <th>Time</th>
          <th>Course</th>
          <th>Group</th>
          <th>Venue</th>
          <th>Remarks (short)</th>
        </tr>
      </thead>
    `;

    const rows = events.map(e => {
      const time = `${toPrettyTime(e.tFrom)} – ${toPrettyTime(e.tTo)}`;
      const venue = e.venue ? e.venue : `<span class="pill">TBC</span>`;

      let rem = e.remarks || "";
      if (opts.stripRecorded) rem = stripRecordedNotice(rem);
      const remarksShort = rem.slice(0, 80) + (rem.length > 80 ? "…" : "");

      return `
        <tr>
          <td>${e.dateStr}</td>
          <td>${e.dayStr}</td>
          <td>${time}</td>
          <td><b>${e.course || ""}</b></td>
          <td>${e.group || ""}</td>
          <td>${venue}</td>
          <td>${remarksShort}</td>
        </tr>
      `;
    }).join("");

    table.innerHTML = header + `<tbody>${rows}</tbody>`;
    previewPanel.style.display = "block";

    if (errors.length) {
      errorPanel.style.display = "block";
      errBox.textContent = `Notes (${errors.length}):\n- ${errors.join("\n- ")}`;
    } else {
      errorPanel.style.display = "none";
      errBox.textContent = "";
    }

    downloadBtn.disabled = false;
  }

  let lastParsed = { events: [], errors: [] };

  function currentOpts() {
    return {
      alarm: document.getElementById("alarm").checked,
      groupInTitle: document.getElementById("groupInTitle").checked,
      venueInTitle: document.getElementById("venueInTitle").checked,
      stripRecorded: document.getElementById("stripRecorded").checked
    };
  }

  const input = document.getElementById("input");

  async function doPreview() {
    lastParsed = parseTimetableByMode(input.value || "");
    renderPreview(lastParsed.events, lastParsed.errors, currentOpts());
  }

  // Show mobile hint on touch devices
  const isTouch = ("ontouchstart" in window) || navigator.maxTouchPoints > 0;
  if (isTouch) document.getElementById("mobileHint").style.display = "block";

  // Toggle meta box
  function updateModeUI() {
    const show = getMode() === "single";
    document.getElementById("singleMeta").style.display = show ? "flex" : "none";
  }
  updateModeUI();

  document.getElementById("modeFull").addEventListener("change", () => {
    updateModeUI();
    if (document.getElementById("previewPanel").style.display !== "none") doPreview();
  });
  document.getElementById("modeSingle").addEventListener("change", () => {
    updateModeUI();
    if (document.getElementById("previewPanel").style.display !== "none") doPreview();
  });

  // Re-preview when meta changes (only matters in single mode)
  ["singleCourse","singleGroup","singleSemType"].forEach(id => {
    document.getElementById(id).addEventListener("input", () => {
      if (getMode() === "single" && document.getElementById("previewPanel").style.display !== "none") doPreview();
    });
  });

  document.getElementById("paste").addEventListener("click", async () => {
    try {
      const text = await navigator.clipboard.readText();
      input.value = text;
      await doPreview();
    } catch {
      const errorPanel = document.getElementById("errorPanel");
      const errBox = document.getElementById("errors");
      errorPanel.style.display = "block";
      errBox.textContent = "Clipboard paste was blocked by your browser. Tap the textbox and paste manually.";
    }
  });

  document.getElementById("preview").addEventListener("click", doPreview);

  ["alarm","groupInTitle","venueInTitle","stripRecorded"].forEach(id => {
    document.getElementById(id).addEventListener("change", () => {
      if (document.getElementById("previewPanel").style.display !== "none") doPreview();
    });
  });

  document.getElementById("download").addEventListener("click", async () => {
    lastParsed = parseTimetableByMode(input.value || "");
    if (!lastParsed.events.length) {
      renderPreview(lastParsed.events, lastParsed.errors, currentOpts());
      return;
    }

    const opts = currentOpts();
    const ics = buildICS(lastParsed.events, opts);

    const now = new Date();
    const fname = `suss-timetable-${now.getFullYear()}${pad2(now.getMonth()+1)}${pad2(now.getDate())}.ics`;

    await saveICS(fname, ics);
  });
})();
