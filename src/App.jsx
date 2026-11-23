import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { isSupabaseConfigured, supabase } from "./lib/supabaseClient";
import "./App.css";

const staffQueueCache = new Map();
const announcementsCache = new Map();

const STAFF_PAGES = ["dashboard", "appointments", "patients", "reports", "announcements"];
const ADMIN_PAGES = ["overview", "users", "doctors", "settings", "announcements", "reports"];
const PATIENT_PAGES = ["home", "appointments", "book", "profile", "assistant"];

const navItems = [
  { id: "home", label: "Home", icon: "⌂" },
  { id: "appointments", label: "Appointments", icon: "▣" },
  { id: "book", label: "Book", icon: "+" },
  { id: "assistant", label: "Assistant", icon: "✦" },
  { id: "profile", label: "Profile", icon: "♙" },
];

const ACADEMIC_PROGRAMS = [
  {
    key: "CAFFS",
    label: "College of Agriculture, Forestry, and Food Science (CAFFS)",
    courses: [
      "Bachelor of Science in Agriculture (BSA)",
      "Bachelor of Science in Food Technology (BSFT)",
      "Bachelor of Science in Forestry (BSF)",
      "Bachelor of Agricultural Technology (BAT)",
      "Bachelor of Science in Agri-Business (BSAgrib)",
    ],
  },
  {
    key: "CTE",
    label: "College of Teacher Education (CTE)",
    courses: [
      "Bachelor of Secondary Education (BSED)",
      "Bachelor of Technology and Livelihood Education (BTLEd)",
    ],
  },
  {
    key: "CCIS",
    label: "College of Computing and Information Sciences (CCIS)",
    courses: ["Bachelor of Science in Computer Science (BSCS)"],
  },
];

const ACADEMIC_MAJORS = {
  CAFFS: {
    BSA: ["N/A", "CS (Crop Science)", "AS (Animal Science)"],
  },
  CCIS: {
    BSCS: ["N/A", "INS", "SE"],
  },
  CTE: {
    BTLED: ["Agri-Fishery Arts (AFA)", "Home Economics (HE)"],
  },
};

const YEAR_LEVEL_OPTIONS = [
  ["1", "1st Year"],
  ["2", "2nd Year"],
  ["3", "3rd Year"],
  ["4", "4th Year"],
];
const SECTION_OPTIONS = ["A", "B", "C", "D"];

function BrandMark({ type }) {
  const logo = type === "uahc"
    ? { src: "/university-of-antique-logo.png", alt: "University of Antique seal" }
    : { src: "/uahc-hamtic-clinic-logo-512.png", alt: "UAHC Hamtic Campus Clinic logo" };
  return (
    <div className={`brand-mark ${type} logo-mark`}>
      <img src={logo.src} alt={logo.alt} />
    </div>
  );
}

function getFirstName(profile, user) {
  return (
    profile?.full_name?.trim()?.split(/\s+/)[0] ||
    user?.user_metadata?.full_name?.trim()?.split(/\s+/)[0] ||
    user?.email?.split("@")[0] ||
    "there"
  );
}

function getTimeGreeting(date = new Date()) {
  const hour = date.getHours();
  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 17) return "Good afternoon";
  return "Good evening";
}

function getDepartmentForCourse(course = "") {
  const normalized = String(course || "").trim().toUpperCase();
  const departmentMap = [
    { key: "CAFFS", patterns: ["BSA", "BSFT", "BSF", "BAT", "BSAGRIB"] },
    { key: "CTE", patterns: ["BSED", "BTLED"] },
    { key: "CCIS", patterns: ["BSCS"] },
  ];

  const match = departmentMap.find(({ patterns }) =>
    patterns.some((pattern) => normalized.includes(pattern)),
  );

  return match ? match.key : "OTHER";
}

function getAcademicProgram(department) {
  return ACADEMIC_PROGRAMS.find((program) => program.key === department);
}

function getMajorOptions(department, course) {
  const courseText = String(course || "");
  const courseCode = (courseText.match(/\(([^)]+)\)$/)?.[1] || courseText.trim()).toUpperCase();
  return ACADEMIC_MAJORS[department]?.[courseCode] || [];
}

function getDepartmentLabel(department) {
  return getAcademicProgram(department)?.label || (department === "OTHER" ? "Other" : "Other");
}

function getCourseLabel(course) {
  const normalized = String(course || "").trim().toUpperCase();
  if (!normalized) return "Course not provided";
  for (const program of ACADEMIC_PROGRAMS) {
    const match = program.courses.find((item) =>
      item.toUpperCase().endsWith(`(${normalized})`),
    );
    if (match) return match;
  }
  return String(course).trim();
}

function getYearSectionLabel(record) {
  const year = String(record?.year_level || "").trim();
  const section = String(record?.section || "").trim();
  if (!year && !section) return "Year and section not provided";
  return [year, section].filter(Boolean).join(" · ");
}

function groupStudentRecords(records) {
  const grouped = ACADEMIC_PROGRAMS.reduce((departments, program) => {
    departments[program.label] = Object.fromEntries(
      program.courses.map((course) => [course, {}]),
    );
    return departments;
  }, { Other: {} });

  return records.reduce((departments, record) => {
    const department = record.department
      ? getDepartmentLabel(record.department)
      : record.course
        ? getDepartmentLabel(getDepartmentForCourse(record.course))
      : "Other";
    const course = getCourseLabel(record.course);
    const yearSection = getYearSectionLabel(record);
    departments[department] ||= {};
    departments[department][course] ||= {};
    departments[department][course][yearSection] ||= [];
    departments[department][course][yearSection].push(record);
    return departments;
  }, grouped);
}

function groupAdminCourseRecords(yearSections) {
  const majors = new Map();
  Object.values(yearSections).flat().forEach((record) => {
    const major = String(record.major || "Major not provided").trim();
    const yearSection = getYearSectionLabel(record);
    if (!majors.has(major)) majors.set(major, new Map());
    const sections = majors.get(major);
    if (!sections.has(yearSection)) sections.set(yearSection, []);
    sections.get(yearSection).push(record);
  });

  return [...majors.entries()]
    .sort(([first], [second]) => first.localeCompare(second))
    .map(([major, sections]) => ({
      major,
      sections: [...sections.entries()]
        .sort(([, firstRecords], [, secondRecords]) =>
          sortStudentRecords(firstRecords[0], secondRecords[0]),
        )
        .map(([label, records]) => ({
          label,
          records: records.sort((first, second) =>
            String(first.full_name || "").localeCompare(String(second.full_name || "")),
          ),
        })),
    }));
}

function getYearRank(value) {
  if (!value) return 999;
  const numeric = Number.parseInt(String(value).replace(/[^0-9]/g, ""), 10);
  return Number.isFinite(numeric) ? numeric : 999;
}

function sortStudentRecords(a, b) {
  const departmentOrder = {
    CAFFS: 0,
    CTE: 1,
    CCIS: 2,
    OTHER: 3,
  };

  const departmentA = getDepartmentForCourse(a?.course || "");
  const departmentB = getDepartmentForCourse(b?.course || "");
  const departmentCompare = (departmentOrder[departmentA] ?? 99) - (departmentOrder[departmentB] ?? 99);
  if (departmentCompare !== 0) return departmentCompare;

  const courseCompare = String(a?.course || "").localeCompare(String(b?.course || ""));
  if (courseCompare !== 0) return courseCompare;

  const yearCompare = getYearRank(a?.year_level) - getYearRank(b?.year_level);
  if (yearCompare !== 0) return yearCompare;

  const sectionCompare = String(a?.section || "").localeCompare(String(b?.section || ""));
  if (sectionCompare !== 0) return sectionCompare;

  return String(a?.full_name || "").localeCompare(String(b?.full_name || ""));
}

function getDayKey(date) {
  return date.toLocaleDateString("en-US", { weekday: "long" }).toLowerCase();
}

function parseTimeRange(value) {
  if (!value) return null;
  if (typeof value === "object") {
    return value.open && value.close
      ? { open: value.open, close: value.close }
      : null;
  }
  const [open, close] = value.split("-");
  return open && close ? { open, close } : null;
}

function buildTimeSlots(schedule, intervalMinutes = 30) {
  const range = parseTimeRange(schedule);
  if (!range) return [];
  const [openHour, openMinute] = range.open.split(":").map(Number);
  const [closeHour, closeMinute] = range.close.split(":").map(Number);
  const start = openHour * 60 + openMinute;
  const end = closeHour * 60 + closeMinute;
  return Array.from(
    { length: Math.max(Math.floor((end - start) / intervalMinutes), 0) },
    (_, index) => {
      const minutes = start + index * intervalMinutes;
      return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
    },
  );
}

function clinicDateTime(date, time) {
  return new Date(`${date}T${time}:00+08:00`);
}

function timeToMinutes(time) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function appointmentTimesOverlap(firstStart, firstDuration, secondStart, secondDuration) {
  const firstStartMinutes = timeToMinutes(firstStart);
  const secondStartMinutes = timeToMinutes(secondStart);
  return firstStartMinutes < secondStartMinutes + secondDuration
    && secondStartMinutes < firstStartMinutes + firstDuration;
}

async function fetchNotifications(userId) {
  const { data } = await supabase
    .from("notifications")
    .select(
      "id, appointment_id, title, message, notification_type, delivery_status, read_at, created_at",
    )
    .eq("recipient_id", userId)
    .order("created_at", { ascending: false })
    .limit(20);
  return data || [];
}

async function createAppointmentReminderNotification(appointment) {
  if (!appointment?.patient?.id || !appointment?.scheduled_at) return null;

  const scheduledAt = new Date(appointment.scheduled_at);
  const title = "Appointment reminder";
  const message = `Your clinic visit with ${appointment.doctor?.full_name || "the clinic team"} is scheduled for ${scheduledAt.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })}. Please arrive 10 minutes early.`;

  const { error } = await supabase.from("notifications").insert({
    recipient_id: appointment.patient.id,
    appointment_id: appointment.id,
    notification_type: "appointment_reminder",
    title,
    message,
    delivery_status: "queued",
  });

  return error;
}

function NotificationCenter({ user, portal }) {
  const [notifications, setNotifications] = useState([]);
  const [open, setOpen] = useState(false);

  async function loadNotifications() {
    setNotifications(await fetchNotifications(user.id));
  }

  useEffect(() => {
    if (!user?.id) return undefined;
    function closeOnOutsideClick(event) {
      if (!event.target.closest(".notification-center")) setOpen(false);
    }
    document.addEventListener("click", closeOnOutsideClick);
    return () => document.removeEventListener("click", closeOnOutsideClick);
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id || !supabase) return undefined;
    async function createPatientReminder() {
      if (portal !== "patient") return;
      const now = new Date();
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      const { data: appointments } = await supabase
        .from("appointments")
        .select("id, scheduled_at, doctor:doctors(full_name)")
        .eq("patient_id", user.id)
        .in("status", ["pending", "approved", "rescheduled"])
        .gte("scheduled_at", now.toISOString())
        .lte("scheduled_at", tomorrow.toISOString());
      await Promise.all(
        (appointments || []).map((appointment) =>
          supabase.from("notifications").insert({
            recipient_id: user.id,
            appointment_id: appointment.id,
            notification_type: "appointment_reminder",
            title: "Appointment reminder",
            message: `Your appointment with ${appointment.doctor?.full_name || "the clinic"} is within 24 hours.`,
          }),
        ),
      );
    }
    createPatientReminder().finally(async () => {
      setNotifications(await fetchNotifications(user.id));
    });
  }, [portal, user?.id]);

  if (!user?.id) return null;

  async function markAsRead(id) {
    const notification = notifications.find((item) => item.id === id);
    await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", id)
      .eq("recipient_id", user.id);
    setNotifications((current) => current.map((item) => item.id === id ? { ...item, read_at: new Date().toISOString() } : item));
    setOpen(false);
    if (notification?.appointment_id) {
      const { data: appointment } = await supabase
        .from("appointments")
        .select("id, scheduled_at, status")
        .eq("id", notification.appointment_id)
        .maybeSingle();
      window.dispatchEvent(new CustomEvent(`${portal}-notification-appointment`, { detail: appointment || { id: notification.appointment_id } }));
    }
  }

  async function markAllAsRead() {
    const unreadIds = notifications.filter((notification) => !notification.read_at).map((notification) => notification.id);
    if (unreadIds.length) {
      const readAt = new Date().toISOString();
      await supabase.from("notifications").update({ read_at: readAt }).in("id", unreadIds).eq("recipient_id", user.id);
      setNotifications((current) => current.map((notification) => unreadIds.includes(notification.id) ? { ...notification, read_at: readAt } : notification));
    }
    setOpen(false);
  }

  const unreadCount = notifications.filter(
    (notification) => !notification.read_at,
  ).length;
  return (
    <div className="notification-center">
      <button
        className="notification-button"
        type="button"
        aria-label={`${unreadCount} unread notifications`}
        onClick={() => setOpen(!open)}
      >
        ♧
        {unreadCount > 0 && <b>{unreadCount > 9 ? "9+" : unreadCount}</b>}
      </button>
      {open && (
        <section className="notification-panel">
          <div className="notification-panel-header">
            <h2>Notifications</h2>
            <div className="notification-panel-actions">
              <button type="button" onClick={markAllAsRead}>Mark all read</button>
              <button type="button" onClick={() => { setOpen(false); loadNotifications(); }}>Refresh</button>
            </div>
          </div>
          {notifications.length === 0 ? (
            <p className="notification-empty">You&apos;re all caught up.</p>
          ) : (
            notifications.map((notification) => (
              <button
                type="button"
                className={`notification-item ${notification.read_at ? "read" : "unread"}`}
                key={notification.id}
                onClick={() => markAsRead(notification.id)}
              >
                <strong>{notification.title}</strong>
                <span>{notification.message}</span>
                <small>{new Date(notification.created_at).toLocaleString()}</small>
              </button>
            ))
          )}
        </section>
      )}
    </div>
  );
}

function Announcements({ user, compact = false, refreshKey = 0 }) {
  const [items, setItems] = useState([]);
  const [readIds, setReadIds] = useState(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadAnnouncements() {
      const cacheKey = `${user.id}:${compact ? "compact" : "full"}`;
      if (refreshKey === 0 && announcementsCache.has(cacheKey)) {
        const cached = announcementsCache.get(cacheKey);
        setItems(cached.items);
        setReadIds(new Set(cached.readIds));
        setLoading(false);
        return;
      }
      const [{ data: announcements }, { data: reads }] = await Promise.all([
        supabase
          .from("announcements")
          .select("id, title, message, category, published_at, expires_at")
          .order("published_at", { ascending: false })
          .limit(compact ? 3 : 10),
        supabase
          .from("announcement_reads")
          .select("announcement_id")
          .eq("reader_id", user.id),
      ]);
      const nextItems = announcements || [];
      const nextReadIds = (reads || []).map((read) => read.announcement_id);
      announcementsCache.set(cacheKey, { items: nextItems, readIds: nextReadIds });
      setItems(nextItems);
      setReadIds(new Set(nextReadIds));
      setLoading(false);
    }
    loadAnnouncements();
  }, [compact, refreshKey, user.id]);

  async function markRead(id) {
    await supabase.from("announcement_reads").upsert({
      announcement_id: id,
      reader_id: user.id,
    });
    setReadIds(new Set([...readIds, id]));
    for (const [cacheKey, cached] of announcementsCache) {
      if (cacheKey.startsWith(`${user.id}:`)) {
        announcementsCache.set(cacheKey, { ...cached, readIds: [...new Set([...cached.readIds, id])] });
      }
    }
  }
  if (loading) return null;
  return (
    <section className={`announcements-board ${compact ? "compact" : ""}`}>
      <div className="announcements-heading">
        <div>
          <p className="eyebrow">Clinic updates</p>
          <h2>Announcements</h2>
        </div>
        {items.length > 0 && <span>{items.length} active</span>}
      </div>
      {items.length === 0 ? (
        <p className="announcement-empty">No active clinic announcements.</p>
      ) : (
        <div className="announcement-list">
          {items.map((item) => (
            <article className={`announcement-item ${readIds.has(item.id) ? "read" : "unread"}`} key={item.id}>
              <div className="announcement-item-heading">
                <span className={`announcement-category ${item.category}`}>{item.category}</span>
                {!readIds.has(item.id) && <b>New</b>}
              </div>
              <h3>{item.title}</h3>
              <p>{item.message}</p>
              <small>Published {new Date(item.published_at).toLocaleDateString()}</small>
              {!readIds.has(item.id) && <button type="button" onClick={() => markRead(item.id)}>Mark as read</button>}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function StaffAnnouncementComposer({ user, onPublished }) {
  const [form, setForm] = useState({ title: "", message: "", category: "general", expires_at: "" });
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);

  async function publish(event) {
    event.preventDefault();
    setSaving(true);
    setStatus("");
    const { error } = await supabase.from("announcements").insert({
      ...form,
      expires_at: form.expires_at || null,
      created_by: user.id,
    });
    setSaving(false);
    if (error) {
      setStatus(error.message);
      return;
    }
    setForm({ title: "", message: "", category: "general", expires_at: "" });
    setStatus("Clinic update published.");
    onPublished();
  }

  return (
    <section className="staff-announcement-composer">
      <div className="panel-head">
        <div>
          <p className="eyebrow">Staff communication</p>
          <h3>Publish a clinic update</h3>
        </div>
      </div>
      <form onSubmit={publish}>
        <input
          placeholder="Update title"
          value={form.title}
          onChange={(event) => setForm({ ...form, title: event.target.value })}
          required
        />
        <textarea
          placeholder="Write the clinic update..."
          value={form.message}
          onChange={(event) => setForm({ ...form, message: event.target.value })}
          required
        />
        <div className="staff-announcement-fields">
          <label>Category
            <select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}>
              <option value="general">General</option>
              <option value="closure">Closure</option>
              <option value="event">Event</option>
              <option value="vaccination">Vaccination</option>
              <option value="deadline">Deadline</option>
            </select>
          </label>
          <label>Expires<input type="datetime-local" value={form.expires_at} onChange={(event) => setForm({ ...form, expires_at: event.target.value })} /></label>
        </div>
        <button type="submit" disabled={saving}>{saving ? "Publishing..." : "Publish update"}</button>
      </form>
      {status && <p className={status.includes("published") ? "success-message" : "error-message"}>{status}</p>}
    </section>
  );
}

function ViewModeControl({ portal, mode, onChange }) {
  if (!["staff", "admin"].includes(portal)) return null;
  return (
    <div className="view-mode-control" aria-label="Portal view mode">
      <span className="view-mode-label">View</span>
      <button type="button" className={mode === "mobile" ? "active" : ""} onClick={() => onChange("mobile")}>Mobile</button>
      <button type="button" className={mode === "desktop" ? "active" : ""} onClick={() => onChange("desktop")}>Desktop</button>
    </div>
  );
}

function PortalControls({ onLogout, portal, viewMode, onViewModeChange }) {
  const [controlsOpen, setControlsOpen] = useState(false);
  return (
    <div className="portal-controls-anchor">
      <button
        type="button"
        className="toolbar-toggle"
        title={controlsOpen ? "Hide controls" : "Show controls"}
        aria-label={controlsOpen ? "Hide controls" : "Show controls"}
        aria-haspopup="true"
        aria-expanded={controlsOpen}
        onClick={() => setControlsOpen((isOpen) => !isOpen)}
      >
        <span aria-hidden="true">⋮</span>
      </button>
      {controlsOpen && (
        <div className="portal-controls-panel">
          <ViewModeControl
            portal={portal}
            mode={viewMode}
            onChange={(mode) => {
              onViewModeChange?.(mode);
              setControlsOpen(false);
            }}
          />
          <button type="button" className="logout" onClick={onLogout}>
            Log out
          </button>
        </div>
      )}
    </div>
  );
}

function StaffPageTools({ user, onLogout, viewMode, onViewModeChange }) {
  return (
    <div className="staff-page-tools-row">
      <div className="staff-hero-tools">
        <NotificationCenter user={user} portal="staff" />
        <PortalControls portal="staff" viewMode={viewMode} onViewModeChange={onViewModeChange} onLogout={onLogout} />
      </div>
    </div>
  );
}

function PatientPageTools({ user, onLogout }) {
  return (
    <div className="patient-page-tools">
      <NotificationCenter user={user} portal="patient" />
      <PortalControls portal="patient" onLogout={onLogout} />
    </div>
  );
}

function Header({ onLogout, user, portal = "patient", viewMode, onViewModeChange, showControls = true }) {
  const managementPortal = portal === "staff" || portal === "admin";
  const controls = <PortalControls onLogout={onLogout} portal={portal} viewMode={viewMode} onViewModeChange={onViewModeChange} />;
  return (
    <>
      <header className={`topbar ${portal}-topbar${managementPortal ? " management-brand-header" : ""}`}>
        <div className="brand-identity">
          <BrandMark type="uahc" />
          <div className="brand-copy">
            <strong>University of Antique</strong>
            <span>Hamtic Campus Clinic</span>
            {portal === "admin" && <small>Administrator</small>}
            {portal === "staff" && <small>Staff Portal</small>}
          </div>
          <BrandMark type="clinic" />
        </div>
        {!managementPortal && showControls && controls}
        {!managementPortal && showControls && <NotificationCenter user={user} portal={portal} />}
      </header>
      {portal === "staff" && showControls && (
        <div className={`portal-toolbar ${portal}-portal-toolbar`}>
          {controls}
          <NotificationCenter user={user} portal={portal} />
        </div>
      )}
    </>
  );
}

function Home({ setView, profile, user }) {
  const [nextAppointment, setNextAppointment] = useState(null);
  const [clinicSettings, setClinicSettings] = useState({});
  const [homeLoading, setHomeLoading] = useState(true);
  const [homeError, setHomeError] = useState("");
  const [pendingRequest, setPendingRequest] = useState(false);
  useEffect(() => {
    async function loadHomeData() {
      const [{ data: appointments, error: appointmentError }, { data: settings, error: settingsError }] = await Promise.all([
        supabase
          .from("appointments")
          .select("scheduled_at, status, doctor:doctors(full_name)")
          .eq("patient_id", user.id)
          .in("status", ["pending", "approved", "rescheduled"])
          .gte("scheduled_at", new Date().toISOString())
          .order("scheduled_at")
          .limit(1),
        supabase.from("clinic_settings").select("setting_key, setting_value"),
      ]);
      setNextAppointment(appointments?.[0] || null);
      const { data: pendingAppointments } = await supabase
        .from("appointments")
        .select("id")
        .eq("patient_id", user.id)
        .eq("status", "pending");
      setPendingRequest((pendingAppointments || []).length > 0);
      setClinicSettings(
        Object.fromEntries(
          (settings || []).map((item) => [
            item.setting_key,
            item.setting_value,
          ]),
        ),
      );
      setHomeError(appointmentError?.message || settingsError?.message || "");
      setHomeLoading(false);
    }
    loadHomeData();
  }, [user.id]);
  const clinicProfile = clinicSettings.clinic_profile || {};
  const clinicHours = clinicSettings.clinic_hours || {};
  return (
    <main className="content home-view">
      <section className="welcome-panel">
        <div className="welcome-panel-header">
          <p className="eyebrow">
            {new Date().toLocaleDateString(undefined, {
              weekday: "long",
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
          </p>
        </div>
        <h1>{getTimeGreeting()}, {profile?.full_name?.split(" ")[0] || "there"}</h1>
        <p>Let&apos;s take care of your health today.</p>
      </section>
      {nextAppointment && (
        <button className="next-visit" onClick={() => setView("appointments")}>
          <span>
            <p className="eyebrow">Next appointment</p>
            <b>{nextAppointment.doctor?.full_name || "Clinic visit"}</b>
            <small>
              {new Date(nextAppointment.scheduled_at).toLocaleString()}
            </small>
          </span>
          <span>→</span>
        </button>
      )}
      <Announcements user={user} compact />
      {homeLoading && <p className="dashboard-loading">Loading your clinic summary...</p>}
      {homeError && <p className="dashboard-error">Unable to load some clinic details.</p>}
      {pendingRequest && <button className="pending-request" onClick={() => setView("appointments")}>Your appointment request is waiting for clinic review. <span>View appointments →</span></button>}
      <div className="section-heading">
        <h2>Quick actions</h2>
        <span>Manage your care</span>
      </div>
      <button className="action-card primary" onClick={() => setView("book")}>
        <span className="action-icon">＋</span>
        <span>
          <b>Book an appointment</b>
          <small>Schedule a clinic visit</small>
        </span>
        <span className="arrow">→</span>
      </button>
      <button className="action-card" onClick={() => setView("appointments")}>
        <span className="action-icon blue">▣</span>
        <span>
          <b>View appointments</b>
          <small>Check your schedule</small>
        </span>
        <span className="arrow">→</span>
      </button>
      <button className="action-card" onClick={() => setView("profile")}>
        <span className="action-icon mint">♡</span>
        <span>
          <b>Patient information</b>
          <small>Access your health profile</small>
        </span>
        <span className="arrow">→</span>
      </button>
      <section className="info-strip">
        <span className="info-icon">i</span>
        <div>
          <b>Need help?</b>
          <p>Clinic office · {clinicProfile.phone || "(033) 555 0142"}</p>
        </div>
        <span>→</span>
      </section>
      <section className="hours">
        <p className="eyebrow">Clinic hours</p>
        <b>Monday – Friday</b>
        <span>{clinicHours.monday || "8:30 AM – 4:30 PM"}</span>
        <small>Closed on weekends and public holidays</small>
      </section>
    </main>
  );
}

function Appointments({ setView, user }) {
  const [filter, setFilter] = useState("Upcoming");
  const [appointments, setAppointments] = useState([]);
  const [statusHistory, setStatusHistory] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    async function loadAppointments() {
      setLoading(true);
      const { data, error: queryError } = await supabase
        .from("appointments")
        .select(
          "id, appointment_type, scheduled_at, status, reason, staff_notes, room_assignment, created_at, doctor:doctors(full_name, specialty)",
        )
        .eq("patient_id", user.id)
        .order("scheduled_at", { ascending: true });
      const appointmentIds = (data || []).map((appointment) => appointment.id);
      const { data: history, error: historyError } = appointmentIds.length
        ? await supabase
            .from("appointment_status_history")
            .select("id, appointment_id, status, note, created_at")
            .in("appointment_id", appointmentIds)
            .order("created_at", { ascending: true })
        : { data: [], error: null };
      if (active) {
        setAppointments(data || []);
        setStatusHistory(
          (history || []).reduce((result, item) => {
            result[item.appointment_id] = [
              ...(result[item.appointment_id] || []),
              item,
            ];
            return result;
          }, {}),
        );
        setError(queryError?.message || historyError?.message || "");
        setLoading(false);
      }
    }
    loadAppointments();
    return () => {
      active = false;
    };
  }, [user.id]);

  useEffect(() => {
    function openNotificationAppointment(event) {
      if (!event.detail?.id) return;
      setFilter("all");
      window.setTimeout(() => document.querySelector(`[data-appointment-id="${event.detail.id}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 0);
    }
    window.addEventListener("patient-notification-appointment", openNotificationAppointment);
    return () => window.removeEventListener("patient-notification-appointment", openNotificationAppointment);
  }, []);

  const visibleAppointments = appointments.filter((appointment) => {
    if (filter === "Upcoming")
      return !["completed", "cancelled", "no_show"].includes(
        appointment.status,
      );
    if (filter === "Past")
      return ["completed", "cancelled", "no_show"].includes(appointment.status);
    return true;
  });
  async function cancelAppointment(id) {
    const { error: cancelError } = await supabase
      .from("appointments")
      .update({ status: "cancelled", updated_by: user.id })
      .eq("id", id)
      .eq("patient_id", user.id);
    if (cancelError) setError(cancelError.message);
    else
      setAppointments(
        appointments.map((appointment) =>
          appointment.id === id
            ? { ...appointment, status: "cancelled" }
            : appointment,
        ),
      );
  }
  async function requestReschedule(id) {
    setMessage("");
    const { error: rescheduleError } = await supabase
      .from("appointments")
      .update({ reschedule_requested: true, updated_by: user.id })
      .eq("id", id)
      .eq("patient_id", user.id);
    if (rescheduleError) setError(rescheduleError.message);
    else {
      setAppointments(
        appointments.map((appointment) =>
          appointment.id === id
            ? { ...appointment, reschedule_requested: true }
            : appointment,
        ),
      );
      setMessage("Reschedule request sent to the clinic.");
    }
  }
  function downloadSummary(appointment) {
    const history = statusHistory[appointment.id] || [];
    const summary = [
      "UAHC Hamtic Campus Clinic Appointment Summary",
      `Doctor: ${appointment.doctor?.full_name || "Assigned doctor"}`,
      `Specialty: ${appointment.doctor?.specialty || "Not specified"}`,
      `Date: ${new Date(appointment.scheduled_at).toLocaleDateString()}`,
      `Time: ${new Date(appointment.scheduled_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`,
      `Type: ${appointment.appointment_type}`,
      `Reason: ${appointment.reason || "Not provided"}`,
      ...(appointment.room_assignment ? [`Waiting room: ${appointment.room_assignment}`] : []),
      `Status: ${appointment.status}`,
      "Status history:",
      ...history.map(
        (item) =>
          `- ${new Date(item.created_at).toLocaleString()}: ${item.status}${item.note ? ` (${item.note})` : ""}`,
      ),
    ].join("\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([summary], { type: "text/plain" }));
    link.download = `appointment-${appointment.id.slice(0, 8)}.txt`;
    link.click();
    URL.revokeObjectURL(link.href);
  }
  return (
    <main className="content appointment-view">
      <button
        className="patient-back"
        type="button"
        onClick={() => setView("home")}
      >
        ← <span>Back</span>
      </button>
      <PageIntro
        title="My Appointments"
        subtitle="Keep track of your clinic visits."
      />
      <div className="segmented">
        {["Upcoming", "Past", "All"].map((item) => (
          <button
            className={filter === item ? "selected" : ""}
            key={item}
            onClick={() => setFilter(item)}
          >
            {item}
          </button>
        ))}
      </div>
      {message && <p className="success-message">{message}</p>}
      {loading && (
        <div className="empty-state">
          <p>Loading appointments...</p>
        </div>
      )}
      {!loading && error && (
        <div className="error-message">
          Unable to load appointments: {error}
        </div>
      )}
      {!loading && !error && visibleAppointments.length === 0 && (
        <div className="empty-state">
          <span>✓</span>
          <h3>No {filter.toLowerCase()} appointments</h3>
          <p>Your appointment history will appear here.</p>
        </div>
      )}
      {!loading &&
        !error &&
        visibleAppointments.map((appointment) => (
            <details className="appointment-card" data-appointment-id={appointment.id} key={appointment.id}>
            <summary className="appointment-card-summary">
            <div className="appointment-top">
              <div>
                <p className="eyebrow">
                  {filter === "Past" ? "Previous visit" : "Clinic visit"}
                </p>
                <h3>{appointment.doctor?.full_name || "Assigned doctor"}</h3>
                <span>
                  {appointment.doctor?.specialty ||
                    appointment.appointment_type}
                </span>
              </div>
              <strong className="status">{appointment.status}</strong>
            </div>
            <div className="appointment-quick-meta">
              <span>▣ {new Date(appointment.scheduled_at).toLocaleDateString()}</span>
              <span>◷ {new Date(appointment.scheduled_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span>
              <span>♧ {appointment.appointment_type}</span>
            </div>
            <span className="appointment-expand-hint">View visit details <b>＋</b></span>
            </summary>
            <div className="appointment-details">
              <span>
                ▣{" "}
                <b>{new Date(appointment.scheduled_at).toLocaleDateString()}</b>
              </span>
              <span>
                ◷{" "}
                <b>
                  {new Date(appointment.scheduled_at).toLocaleTimeString([], {
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </b>
              </span>
              <span>
                ⌖ <b>University Clinic</b>
              </span>
              {appointment.room_assignment && ["checked_in", "in_consultation"].includes(appointment.status) && (
                <span>
                  ◷ <b>Waiting room: {appointment.room_assignment}</b>
                </span>
              )}
              <span>
                ♧ <b>{appointment.appointment_type}</b>
              </span>
              <span>
                ✎ <b>{appointment.reason || "No reason provided"}</b>
              </span>
            </div>
            {appointment.staff_notes && (
              <p className="appointment-note">
                Clinic note: {appointment.staff_notes}
              </p>
            )}
            {(statusHistory[appointment.id] || []).length > 0 && (
              <div className="appointment-history">
                <b>Status history</b>
                {(statusHistory[appointment.id] || []).map((item) => (
                  <div key={item.id}>
                    <span>{item.status.replace("_", " ")}</span>
                    <small>{new Date(item.created_at).toLocaleString()}</small>
                    {item.note && <p>{item.note}</p>}
                  </div>
                ))}
              </div>
            )}
            <div className="appointment-summary-actions">
              <button type="button" onClick={() => window.print()}>
                Print summary
              </button>
              <button type="button" onClick={() => downloadSummary(appointment)}>
                Download summary
              </button>
            </div>
            {!['completed', 'cancelled', 'no_show', 'rescheduled'].includes(
              appointment.status,
            ) && !appointment.reschedule_requested && (
              <div className="appointment-actions">
                <button onClick={() => requestReschedule(appointment.id)}>
                  Request reschedule
                </button>
                <button
                  className="cancel"
                  onClick={() => cancelAppointment(appointment.id)}
                >
                  Cancel
                </button>
              </div>
            )}
          </details>
        ))}
      <button className="wide-button" onClick={() => setView("book")}>
        Book new appointment <span>→</span>
      </button>
    </main>
  );
}

function PageIntro({ title, subtitle }) {
  return (
    <div className="page-intro">
      <p className="eyebrow">Patient portal</p>
      <h1>{title}</h1>
      <p>{subtitle}</p>
    </div>
  );
}

function getAttendanceSummary(appointments) {
  const completed = appointments.filter((item) => item.status === "completed").length;
  const noShows = appointments.filter((item) => item.status === "no_show").length;
  const cancelled = appointments.filter((item) => item.status === "cancelled").length;
  const eligibleVisits = completed + noShows;
  return {
    total: appointments.length,
    completed,
    noShows,
    cancelled,
    eligibleVisits,
    attendanceRate: eligibleVisits ? Math.round((completed / eligibleVisits) * 100) : null,
    noShowRate: eligibleVisits ? Math.round((noShows / eligibleVisits) * 100) : null,
  };
}

function getClinicDateKey(value) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(value));
  const year = parts.find((part) => part.type === "year").value;
  const month = parts.find((part) => part.type === "month").value;
  const day = parts.find((part) => part.type === "day").value;
  return `${year}-${month}-${day}`;
}

function getClinicMonthKey(value) {
  return getClinicDateKey(value).slice(0, 7);
}

function getMonthlyAppointmentSummaries(appointments, monthCount = 6) {
  const currentParts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "numeric",
  }).formatToParts(new Date());
  const year = Number(currentParts.find((part) => part.type === "year").value);
  const month = Number(currentParts.find((part) => part.type === "month").value) - 1;
  const currentMonth = new Date(year, month, 1);

  return Array.from({ length: monthCount }, (_, index) => {
    const date = new Date(year, month - (monthCount - index - 1), 1);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const summary = getAttendanceSummary(
      appointments.filter((item) => getClinicMonthKey(item.scheduled_at) === monthKey),
    );
    return {
      ...summary,
      key: monthKey,
      label: date.toLocaleDateString(undefined, { month: "short", year: "numeric" }),
      isCurrentMonth: date.getFullYear() === currentMonth.getFullYear() && date.getMonth() === currentMonth.getMonth(),
    };
  });
}

function Booking({ user, profile }) {
  const [step, setStep] = useState(1);
  const [doctor, setDoctor] = useState("");
  const [type, setType] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [reason, setReason] = useState("");
  const [urgency, setUrgency] = useState("Routine");
  const [medicalHistory, setMedicalHistory] = useState("");
  const [allergies, setAllergies] = useState(profile?.allergies || "");
  const [emergencyContactName, setEmergencyContactName] = useState("");
  const [emergencyContactPhone, setEmergencyContactPhone] = useState("");
  const [insuranceStatus, setInsuranceStatus] = useState("");
  const [insuranceProvider, setInsuranceProvider] = useState("");
  const [insuranceMemberId, setInsuranceMemberId] = useState("");
  const [treatmentConsent, setTreatmentConsent] = useState(false);
  const [privacyNoticeAcknowledged, setPrivacyNoticeAcknowledged] = useState(false);
  const [dataSharingConsent, setDataSharingConsent] = useState(false);
  const [doctors, setDoctors] = useState([]);
  const [clinicHours, setClinicHours] = useState({});
  const [clinicClosures, setClinicClosures] = useState([]);
  const [bookedAppointments, setBookedAppointments] = useState([]);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [availabilityError, setAvailabilityError] = useState("");
  const [message, setMessage] = useState("");
  const [showBookingSuccess, setShowBookingSuccess] = useState(false);
  useEffect(() => {
    async function loadBookingSettings() {
      const [{ data: doctorData, error: doctorError }, { data: settings }] =
        await Promise.all([
          supabase
            .from("doctors")
            .select("id, full_name, specialty, availability, appointment_duration_minutes")
            .eq("is_active", true)
            .order("full_name"),
          supabase
            .from("clinic_settings")
            .select("setting_key, setting_value")
            .in("setting_key", ["clinic_hours", "clinic_closures"]),
        ]);
      setDoctors(doctorData || []);
      const settingsMap = Object.fromEntries(
        (settings || []).map((item) => [item.setting_key, item.setting_value]),
      );
      setClinicHours(settingsMap.clinic_hours || {});
      setClinicClosures(settingsMap.clinic_closures?.dates || settingsMap.clinic_closures || []);
      if (doctorError) setMessage(`Unable to load booking settings: ${doctorError.message}`);
    }
    loadBookingSettings();
  }, []);
  useEffect(() => {
    let active = true;
    async function loadBookedSlots() {
      if (!doctor || !date) {
        setBookedAppointments([]);
        setAvailabilityError("");
        setAvailabilityLoading(false);
        return;
      }
      setAvailabilityLoading(true);
      setBookedAppointments([]);
      setAvailabilityError("");
      const selectedDay = clinicDateTime(date, "00:00");
      const nextDay = new Date(selectedDay);
      nextDay.setUTCDate(nextDay.getUTCDate() + 1);
      const { data, error } = await supabase
        .from("appointments")
        .select("scheduled_at")
        .eq("doctor_id", doctor)
        .gte("scheduled_at", selectedDay.toISOString())
        .lt("scheduled_at", nextDay.toISOString())
        .not("status", "in", "(cancelled,no_show)");
      if (!active) return;
      if (error) {
        setAvailabilityError(error.message);
        setMessage(`Unable to check availability: ${error.message}`);
      } else setBookedAppointments(data || []);
      setAvailabilityLoading(false);
    }
    loadBookedSlots();
    return () => {
      active = false;
    };
  }, [date, doctor]);
  useEffect(() => {
    if (!showBookingSuccess) return undefined;
    const timeoutId = window.setTimeout(() => setShowBookingSuccess(false), 3000);
    return () => window.clearTimeout(timeoutId);
  }, [showBookingSuccess]);
  const ready = doctor && type;
  const selectedDoctor = doctors.find((item) => item.id === doctor);
  const selectedDate = date ? parseDateInput(date) : null;
  const dayKey = selectedDate ? getDayKey(selectedDate) : "";
  const doctorSchedule = selectedDoctor?.availability?.[dayKey];
  const schedule = doctorSchedule ?? clinicHours[dayKey];
  const isClosedDate = clinicClosures.includes(date);
  const appointmentDuration = selectedDoctor?.appointment_duration_minutes || 30;
  const hasBookedConflict = (slot, booked = bookedAppointments) => booked.some((appointment) => {
    const appointmentTime = new Date(appointment.scheduled_at).toLocaleTimeString("en-GB", {
      timeZone: "Asia/Manila",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    return appointmentTimesOverlap(
      slot,
      appointmentDuration,
      appointmentTime,
      appointmentDuration,
    );
  });
  const availableSlots = (availabilityError ? [] : buildTimeSlots(schedule, appointmentDuration))
    .filter((slot) => !hasBookedConflict(slot));
  function proceedToIntake() {
    setMessage("");
    if (!date) {
      setMessage("Please select an appointment date.");
      return;
    }
    if (!time) {
      setMessage("Please select an available appointment time.");
      return;
    }
    if (!availableSlots.includes(time)) {
      setMessage("That date or time is unavailable. Please choose another slot.");
      return;
    }
    setStep(3);
  }
  async function submitAppointment() {
    setMessage("");
    const scheduledAt = clinicDateTime(date, time);
    if (!schedule || isClosedDate || availabilityLoading || availabilityError || !availableSlots.includes(time)) {
      setMessage("That date or time is unavailable. Please choose another slot.");
      return;
    }
    if (!reason.trim() || !medicalHistory.trim() || !allergies.trim() || !emergencyContactName.trim() || !emergencyContactPhone.trim()) {
      setMessage("Complete the symptom, medical history, allergy, and emergency contact fields before booking.");
      return;
    }
    if (!insuranceStatus || (insuranceStatus === "insured" && (!insuranceProvider.trim() || !insuranceMemberId.trim()))) {
      setMessage("Select your insurance status and complete the insurance details if covered.");
      return;
    }
    if (!treatmentConsent || !privacyNoticeAcknowledged) {
      setMessage("Confirm the treatment consent and privacy notice before booking.");
      return;
    }
    const selectedDay = clinicDateTime(date, "00:00");
    const nextDay = new Date(selectedDay);
    nextDay.setUTCDate(nextDay.getUTCDate() + 1);
    const { data: conflicts, error: conflictError } = await supabase
      .from("appointments")
      .select("scheduled_at")
      .eq("doctor_id", doctor)
      .gte("scheduled_at", selectedDay.toISOString())
      .lt("scheduled_at", nextDay.toISOString())
      .not("status", "in", "(cancelled,no_show)");
    if (conflictError) {
      setMessage(conflictError.message);
      return;
    }
    if (hasBookedConflict(time, conflicts || [])) {
      setMessage("That time is already booked. Please choose another slot.");
      return;
    }
    const { error } = await supabase
      .from("appointments")
      .insert({
        patient_id: user.id,
        doctor_id: doctor,
        appointment_type: type,
        scheduled_at: scheduledAt.toISOString(),
        reason: `Urgency: ${urgency} | Symptoms: ${reason.trim()}`,
        urgency,
        intake_symptoms: reason.trim(),
        intake_medical_history: medicalHistory.trim(),
        intake_allergies: allergies.trim(),
        emergency_contact_name: emergencyContactName.trim(),
        emergency_contact_phone: emergencyContactPhone.trim(),
        insurance_status: insuranceStatus,
        insurance_provider: insuranceStatus === "insured" ? insuranceProvider.trim() : null,
        insurance_member_id: insuranceStatus === "insured" ? insuranceMemberId.trim() : null,
        treatment_consent: treatmentConsent,
        privacy_notice_acknowledged: privacyNoticeAcknowledged,
        data_sharing_consent: dataSharingConsent,
        staff_notes: urgency === "Urgent" ? "Marked urgent for triage" : "Waiting for clinic screening",
      });
    setMessage(error ? error.message : "Appointment request submitted.");
    if (!error) {
      setStep(4);
      setShowBookingSuccess(true);
    }
  }
  return (
    <main className="content booking-view">
      {showBookingSuccess && (
        <div className="booking-success-toast" role="status" aria-live="polite">
          SUCCESS
        </div>
      )}
      <button
        className="patient-back"
        type="button"
        onClick={() => setView("home")}
      >
        ← <span>Back</span>
      </button>
      <section className="booking-card">
        <h1>Book Appointment</h1>
        <div className="stepper">
          {[1, 2, 3].map((item) => (
            <span className={step >= item ? "active" : ""} key={item}>
              {item}
            </span>
          ))}
          <i></i>
        </div>
        {step === 1 && (
          <>
            <label>
              ♙ Patient Name
              <input value={profile?.full_name || ""} readOnly />
            </label>
            <label>
              ♧ Select Doctor
              <select
                value={doctor}
                onChange={(event) => setDoctor(event.target.value)}
              >
                <option value="">Choose a doctor</option>
                {doctors.map((item) => (
                  <option value={item.id} key={item.id}>
                    {item.full_name} · {item.specialty}
                  </option>
                ))}
              </select>
            </label>
            <label>
              ♧ Appointment Type
              <select
                value={type}
                onChange={(event) => setType(event.target.value)}
              >
                <option value="">Choose an appointment type</option>
                <option>General consultation</option>
                <option>Follow-up visit</option>
                <option>Medical certificate</option>
              </select>
            </label>
            <button
              className="wide-button"
              disabled={!ready}
              onClick={() => setStep(2)}
            >
              Next
            </button>
          </>
        )}
        {step === 2 && (
          <>
            <label>
              ▣ Select Date
              <input
                type="date"
                min={formatDateInput(new Date())}
                value={date}
                onChange={(event) => {
                  setDate(event.target.value);
                  setTime("");
                  setMessage("");
                }}
              />
            </label>
            <label>◷ Select Time</label>
            {availabilityLoading ? (
              <p className="availability-message">Checking available times...</p>
            ) : availabilityError ? (
              <p className="availability-message">Unable to verify availability. Please try again.</p>
            ) : isClosedDate || !schedule ? (
              <p className="availability-message">The clinic is closed on this date.</p>
            ) : availableSlots.length === 0 ? (
              <p className="availability-message">No appointment slots are available.</p>
            ) : (
              <div className="time-grid">
                {availableSlots.map((slot) => (
                  <button
                    type="button"
                    className={time === slot ? "selected" : ""}
                    key={slot}
                    onClick={() => setTime(slot)}
                  >
                    {new Date(`2000-01-01T${slot}:00`).toLocaleTimeString([], {
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </button>
                ))}
              </div>
            )}
            <div className="button-row">
              <button className="back-button" onClick={() => setStep(1)}>
                Back
              </button>
              <button
                className="wide-button"
                onClick={proceedToIntake}
              >
                Next
              </button>
            </div>
          </>
        )}
        {step === 3 && (
          <>
            <label>
              Appointment urgency
              <select
                value={urgency}
                onChange={(event) => setUrgency(event.target.value)}
              >
                <option value="Routine">Routine</option>
                <option value="Urgent">Urgent</option>
                <option value="Follow-up">Follow-up</option>
              </select>
            </label>
            <label>
              Symptom intake / reason for visit
              <textarea
                required
                className="reason-input"
                placeholder="Describe your symptoms, concerns, recent illnesses, or pain level"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              />
            </label>
            <label>
              Relevant medical history
              <textarea className="reason-input intake-short-input" required placeholder="List relevant conditions, medications, or enter None known" value={medicalHistory} onChange={(event) => setMedicalHistory(event.target.value)} />
            </label>
            <label>
              Allergies or medication reactions
              <textarea className="reason-input intake-short-input" required placeholder="List allergies or enter None known" value={allergies} onChange={(event) => setAllergies(event.target.value)} />
            </label>
            <p className="intake-section-title">Emergency contact</p>
            <div className="field-row">
              <label>
                Contact name
                <input required autoComplete="name" value={emergencyContactName} onChange={(event) => setEmergencyContactName(event.target.value)} />
              </label>
              <label>
                Contact phone
                <input required type="tel" autoComplete="tel" value={emergencyContactPhone} onChange={(event) => setEmergencyContactPhone(event.target.value)} />
              </label>
            </div>
            <label>
              Insurance coverage
              <select required value={insuranceStatus} onChange={(event) => setInsuranceStatus(event.target.value)}>
                <option value="">Select coverage status</option>
                <option value="insured">I have insurance</option>
                <option value="none">No insurance / not applicable</option>
              </select>
            </label>
            {insuranceStatus === "insured" && (
              <div className="field-row">
                <label>
                  Insurance provider
                  <input required value={insuranceProvider} onChange={(event) => setInsuranceProvider(event.target.value)} />
                </label>
                <label>
                  Member or policy number
                  <input required value={insuranceMemberId} onChange={(event) => setInsuranceMemberId(event.target.value)} />
                </label>
              </div>
            )}
            <fieldset className="intake-consent-group">
              <legend>Consent</legend>
              <label className="checkbox-row">
                <input type="checkbox" checked={treatmentConsent} onChange={(event) => setTreatmentConsent(event.target.checked)} />
                <span>I consent to assessment and treatment for this visit.</span>
              </label>
              <label className="checkbox-row">
                <input type="checkbox" checked={privacyNoticeAcknowledged} onChange={(event) => setPrivacyNoticeAcknowledged(event.target.checked)} />
                <span>I acknowledge the clinic privacy notice and understand my information will be used to provide care.</span>
              </label>
              <label className="checkbox-row">
                <input type="checkbox" checked={dataSharingConsent} onChange={(event) => setDataSharingConsent(event.target.checked)} />
                <span>I consent to sharing relevant health information with authorized clinic personnel for care coordination. (Optional)</span>
              </label>
            </fieldset>
            <div className="booking-summary">
              <p className="eyebrow">Appointment Summary</p>
              <b>
                Patient: <span>{profile?.full_name}</span>
              </b>
              <b>
                Doctor: <span>{selectedDoctor?.full_name}</span>
              </b>
              <b>
                Date: <span>{date}</span>
              </b>
              <b>
                Time:{" "}
                <span>
                  {time &&
                    new Date(`2000-01-01T${time}:00`).toLocaleTimeString([], {
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                </span>
              </b>
              <b>
                Visit priority: <span>{urgency}</span>
              </b>
            </div>
            {message && <p className="error-message">{message}</p>}
            <div className="button-row">
              <button className="back-button" onClick={() => setStep(2)}>
                Back
              </button>
              <button
                className="wide-button confirm-booking"
                onClick={submitAppointment}
              >
                Confirm Booking
              </button>
            </div>
          </>
        )}
        {step === 4 && (
          <div className="booking-confirmed">
            <span>✓</span>
            <h2>Appointment Booked!</h2>
            <p>Your appointment has been successfully scheduled.</p>
          </div>
        )}
      </section>
    </main>
  );
}

function AiAssistant({ profile }) {
  const [messages, setMessages] = useState([{ role: "assistant", content: `Hello${profile?.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""}! I’m the UAHC Clinic assistant. How can I help you today?` }]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  async function sendMessage(event) {
    event?.preventDefault();
    const text = input.trim();
    if (!text || sending) return;
    const nextMessages = [...messages, { role: "user", content: text }];
    setMessages(nextMessages);
    setInput("");
    setError("");
    setSending(true);
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !sessionData?.session?.access_token) throw new Error("Please sign in again.");
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { Authorization: `Bearer ${sessionData.session.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextMessages }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to send your message.");
      setMessages((current) => [...current, { role: "assistant", content: result.reply }]);
    } catch (requestError) {
      setError(requestError.message || "Unable to reach the AI assistant.");
    } finally {
      setSending(false);
    }
  }

  return (
    <main className="content assistant-view">
      <div className="page-intro"><p className="eyebrow">Health support</p><h1>Clinic Assistant</h1><p>Ask about clinic services, booking, and general wellness.</p></div>
      <section className="chat-panel" aria-label="Clinic assistant conversation">
        <div className="chat-header"><span className="chat-avatar" aria-hidden="true">✦</span><div><b>UAHC Assistant</b><small><span className="online-dot" /> Online</small></div></div>
        <div className="chat-messages" role="log" aria-live="polite">
          {messages.map((message, index) => <div className={`chat-message ${message.role === "user" ? "user" : "assistant"}`} key={`${message.role}-${index}`}>{message.content}</div>)}
          {sending && <div className="chat-message assistant typing" aria-label="Assistant is typing"><span /><span /><span /></div>}
        </div>
        {error && <p className="chat-error">{error}</p>}
        <form className="chat-composer" onSubmit={sendMessage}>
          <label htmlFor="assistant-message" className="sr-only">Message the clinic assistant</label>
          <textarea id="assistant-message" value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); sendMessage(); } }} placeholder="Type your question..." rows="1" maxLength="4000" disabled={sending} />
          <button type="submit" aria-label="Send message" disabled={sending || !input.trim()}>↑</button>
        </form>
      </section>
      <p className="chat-disclaimer">AI assistance is informational only and does not replace professional medical advice.</p>
    </main>
  );
}

function Profile({ profile }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(profile || {});
  const [savedProfile, setSavedProfile] = useState(profile || {});
  const [records, setRecords] = useState([]);
  const [visitHistory, setVisitHistory] = useState([]);
  const [message, setMessage] = useState("");
  const selectedDepartment = form.department || (form.course ? getDepartmentForCourse(form.course) : "");
  const selectedProgram = getAcademicProgram(selectedDepartment);
  const majorOptions = getMajorOptions(selectedDepartment, form.course);
  const departmentLabel = selectedDepartment
    ? getDepartmentLabel(selectedDepartment)
    : savedProfile?.course
      ? getDepartmentLabel(getDepartmentForCourse(savedProfile.course))
      : "Not provided";
  useEffect(() => {
    setForm(profile || {});
    setSavedProfile(profile || {});
  }, [profile]);
  useEffect(() => {
    if (!profile?.id) return;
    async function loadVisitHistory() {
      const [{ data: appointmentData }, { data: recordData }] = await Promise.all([
        supabase
          .from("appointments")
          .select("id, appointment_type, scheduled_at, status, reason, staff_notes, doctor:doctors(full_name, specialty)")
          .eq("patient_id", profile.id)
          .order("scheduled_at", { ascending: false }),
        supabase
          .from("medical_records")
          .select("id, appointment_id, visit_date, chief_complaint, diagnosis, treatment, prescriptions, follow_up_instructions, visit_result, recommendations, recorded_by, created_at, updated_at")
          .eq("patient_id", profile.id)
          .order("visit_date", { ascending: false }),
      ]);
      const recordsByAppointment = Object.fromEntries(
        (recordData || []).map((record) => [record.appointment_id, record]),
      );
      setRecords(recordData || []);
      setVisitHistory((appointmentData || []).map((appointment) => ({
        appointment,
        record: recordsByAppointment[appointment.id] || null,
      })));
    }
    loadVisitHistory();
  }, [profile?.id]);
  async function saveProfile(event) {
    event.preventDefault();
    const normalizedSchoolId = form.school_id?.trim();
    if (normalizedSchoolId && normalizedSchoolId !== profile.school_id) {
      const { data: existingProfile } = await supabase
        .from("profiles")
        .select("id")
        .ilike("school_id", normalizedSchoolId)
        .neq("id", profile.id)
        .maybeSingle();
      if (existingProfile) {
        setMessage("That Student ID is already registered to another account.");
        return;
      }
    }
    const profilePayload = {
      full_name: form.full_name,
      course: form.course,
      department: selectedDepartment || null,
      major: form.major || null,
      year_level: form.year_level,
      section: form.section,
      school_id: normalizedSchoolId,
      phone: form.phone,
      address: form.address,
      blood_type: form.blood_type,
      allergies: form.allergies,
    };
    let { data, error: saveError } = await supabase
      .from("profiles")
      .update(profilePayload)
      .eq("id", profile.id)
      .select()
      .single();
    const missingAcademicColumns = saveError?.code === "PGRST204" || saveError?.code === "42703";
    if (missingAcademicColumns) {
      const fallbackPayload = { ...profilePayload };
      delete fallbackPayload.department;
      delete fallbackPayload.major;
      const fallbackResult = await supabase
        .from("profiles")
        .update(fallbackPayload)
        .eq("id", profile.id)
        .select()
        .single();
      data = fallbackResult.data;
      saveError = fallbackResult.error;
    }
    setMessage(
      saveError?.code === "23505"
        ? "That Student ID is already registered to another account."
        : saveError
          ? saveError.message
          : missingAcademicColumns
            ? "Your other information was saved, but Major and Department need database migration 022 before they can be saved."
            : "Profile updated.",
    );
    if (!saveError && !missingAcademicColumns) {
      const updatedProfile = {
        ...data,
        department: data?.department || selectedDepartment || null,
        major: data?.major || form.major || null,
      };
      setForm(updatedProfile);
      setSavedProfile(updatedProfile);
      setEditing(false);
    }
    if (!saveError && missingAcademicColumns) {
      setForm({ ...form, department: selectedDepartment, major: form.major || "" });
    }
  }
  const visitsByMonth = groupVisitsByMonth(visitHistory);
  return (
    <main className="content profile-view">
      <div className="profile-title">
        <PageIntro
          title="Patient information"
          subtitle="Your personal and medical details."
        />
        <button className="edit-button" onClick={() => setEditing(!editing)}>
          {editing ? "Cancel" : "Edit"}
        </button>
      </div>
      {editing ? (
        <form className="profile-card edit-form" onSubmit={saveProfile}>
          <h2>Edit profile</h2>
          {[
            ["full_name", "Full name"],
            ["school_id", "Student ID"],
            ["phone", "Phone"],
            ["address", "Address"],
            ["blood_type", "Blood type"],
            ["allergies", "Allergies"],
          ].map(([key, label]) => (
            <label key={key}>
              {label}
              <input
                value={form[key] || ""}
                onChange={(event) => {
                  const nextValue = event.target.value;
                  setForm({
                    ...form,
                    [key]: nextValue,
                    ...(key === "course"
                      ? { department: getDepartmentLabel(getDepartmentForCourse(nextValue)) }
                      : {}),
                  });
                }}
              />
            </label>
          ))}
          <fieldset className="academic-fields">
            <legend>Academic information</legend>
            <label>
              Department
              <select
                value={selectedDepartment}
                onChange={(event) => setForm({ ...form, department: event.target.value, course: "", major: "" })}
              >
                <option value="">Select department</option>
                {ACADEMIC_PROGRAMS.map((program) => (
                  <option value={program.key} key={program.key}>{program.label}</option>
                ))}
              </select>
            </label>
            <label>
              Course
              <select
                value={form.course || ""}
                disabled={!selectedProgram}
                onChange={(event) => setForm({ ...form, course: event.target.value, major: "" })}
              >
                <option value="">Select course</option>
                {(selectedProgram?.courses || []).map((course) => (
                  <option value={course} key={course}>{course}</option>
                ))}
              </select>
            </label>
            <label>
              Year level
              <select
                value={form.year_level || ""}
                onChange={(event) => setForm({ ...form, year_level: event.target.value })}
              >
                <option value="">Select year</option>
                {form.year_level && !YEAR_LEVEL_OPTIONS.some(([value]) => value === form.year_level) && (
                  <option value={form.year_level}>{form.year_level}</option>
                )}
                {YEAR_LEVEL_OPTIONS.map(([value, label]) => <option value={value} key={value}>{label}</option>)}
              </select>
            </label>
            <label>
              Section
              <select
                value={form.section || ""}
                onChange={(event) => setForm({ ...form, section: event.target.value })}
              >
                <option value="">Select section</option>
                {form.section && !SECTION_OPTIONS.includes(form.section) && (
                  <option value={form.section}>{form.section}</option>
                )}
                {SECTION_OPTIONS.map((section) => <option value={section} key={section}>{section}</option>)}
              </select>
            </label>
            <label>
              Major <span className="field-optional">Optional</span>
              <select
                value={form.major || ""}
                disabled={majorOptions.length === 0}
                onChange={(event) => setForm({ ...form, major: event.target.value })}
              >
                <option value="">{majorOptions.length ? "Select major" : "No major available"}</option>
                {majorOptions.map((major) => (
                  <option value={major} key={major}>{major}</option>
                ))}
              </select>
            </label>
          </fieldset>
          {message && (
            <p
              className={
                message.startsWith("Profile updated")
                  ? "success-message"
                  : "error-message"
              }
            >
              {message}
            </p>
          )}
          <button type="submit" className="wide-button">
            Save changes
          </button>
        </form>
      ) : (
        <div className="profile-card">
          <h2>Your profile</h2>
          <div className="profile-info">
            <div>
              <b>Full name</b>
              <p>{profile.full_name}</p>
            </div>
            <div>
              <b>Student ID</b>
              <p>{profile.school_id || "Not provided"}</p>
            </div>
            <div>
              <b>Email</b>
              <p>{profile.email}</p>
            </div>
            <div>
              <b>Phone</b>
              <p>{profile.phone || "Not provided"}</p>
            </div>
            <div>
              <b>Address</b>
              <p>{profile.address || "Not provided"}</p>
            </div>
            <div>
              <b>Blood type</b>
              <p>{profile.blood_type || "Not provided"}</p>
            </div>
            <div>
              <b>Allergies</b>
              <p>{profile.allergies || "Not provided"}</p>
            </div>
            <div>
              <b>Department</b>
              <p>{departmentLabel}</p>
            </div>
            <div>
              <b>Course</b>
              <p>{profile.course || "Not provided"}</p>
            </div>
            <div>
              <b>Major</b>
              <p>{profile.major || "Not provided"}</p>
            </div>
            <div>
              <b>Year level</b>
              <p>{profile.year_level || "Not provided"}</p>
            </div>
            <div>
              <b>Section</b>
              <p>{profile.section || "Not provided"}</p>
            </div>
          </div>
          <div className="profile-actions">
            <button
              className="wide-button"
              onClick={() => setEditing(true)}
            >
              Edit profile
            </button>
          </div>
        </div>
      )}
      <section className="visit-history">
        <h2>Visit history</h2>
        {visitHistory.length === 0 ? (
          <p>No clinic visits recorded.</p>
        ) : (
          <div className="visit-history-list">
            {Object.entries(visitsByMonth).map(([month, { label, visits }]) => (
              <div className="visit-month-group" key={month}>
                <h3>{label}</h3>
                <div className="visit-records">
                  {visits.map(({ appointment, record }) => (
                    <article className="visit-record" key={appointment.id}>
                      <div className="visit-info">
                        <p className="eyebrow">{new Date(appointment.scheduled_at).toLocaleDateString()}</p>
                        <p>
                          <b>{appointment.doctor?.full_name || "Assigned doctor"}</b> ·{" "}
                          {appointment.status === "completed" ? "Visit completed" : "No show / Cancelled"}
                        </p>
                        <p>{appointment.appointment_type}</p>
                      </div>
                      {record && (
                        <div className="visit-record-details">
                          <p><b>Chief complaint:</b> {record.chief_complaint || "Not provided"}</p>
                          <p><b>Diagnosis:</b> {record.diagnosis || "Not provided"}</p>
                          <p><b>Treatment:</b> {record.treatment || "Not provided"}</p>
                          <p><b>Prescriptions:</b> {record.prescriptions || "Not provided"}</p>
                          <p><b>Follow-up instructions:</b> {record.follow_up_instructions || "Not provided"}</p>
                          <p><b>Recorded by:</b> {record.recorded_by || "Not provided"}</p>
                        </div>
                      )}
                    </article>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function App() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState("");
  const [passwordRecovery, setPasswordRecovery] = useState(() =>
    new URLSearchParams(window.location.search).get("reset-password") === "1",
  );
  const [profileLoading, setProfileLoading] = useState(false);
  const [view, setView] = useState("home");
  const [restoredPatientViewFor, setRestoredPatientViewFor] = useState(null);
  const [adminViewMode, setAdminViewMode] = useState(() => {
    const saved = localStorage.getItem("admin-view-mode");
    return saved === "mobile" || saved === "desktop" ? saved : "desktop";
  });
  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return undefined;
    }
    let active = true;
    const timeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Supabase connection timed out.")), 10000),
    );
    Promise.race([supabase.auth.getSession(), timeout])
      .then(({ data }) => {
        if (active) {
          setUser(data.session?.user || null);
          setLoading(false);
        }
      })
      .catch((error) => {
        if (active) {
          setAuthError(error.message);
          setLoading(false);
        }
      });
    function updateUserIfChanged(nextUser) {
      setUser((currentUser) =>
        currentUser?.id === nextUser?.id ? currentUser : nextUser,
      );
    }
    const { data: listener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === "PASSWORD_RECOVERY") setPasswordRecovery(true);
        updateUserIfChanged(session?.user || null);
      },
    );
    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!user || !supabase) {
      setProfile(null);
      setProfileLoading(false);
      return;
    }
    setProfileLoading(true);
    const profileRequest = supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();
    const profileTimeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Profile loading timed out.")), 10000),
    );
    Promise.race([profileRequest, profileTimeout])
      .then(({ data, error }) => {
        if (error) throw error;
        setProfile(
          data
            ? {
                ...data,
                school_id: data.school_id || user.user_metadata?.school_id || "",
              }
            : {
                id: user.id,
                full_name:
                  user.user_metadata?.full_name || user.email?.split("@")[0],
                email: user.email,
                school_id: user.user_metadata?.school_id || "",
                role: "patient",
              },
        );
        setProfileLoading(false);
      })
      .catch((error) => {
        setAuthError(error.message);
        setProfileLoading(false);
      });
  }, [user]);

  useEffect(() => {
    if (!user || profile?.role !== "patient") return;
    const saved = localStorage.getItem(`patient-page:${user.id}`);
    if (PATIENT_PAGES.includes(saved)) setView(saved);
    setRestoredPatientViewFor(user.id);
  }, [user?.id, profile?.role]);

  useEffect(() => {
    if (!user || profile?.role !== "patient" || restoredPatientViewFor !== user.id) return;
    localStorage.setItem(`patient-page:${user.id}`, view);
  }, [user?.id, profile?.role, restoredPatientViewFor, view]);

  async function signOut() {
    await supabase?.auth.signOut();
    setUser(null);
  }
  function changeAdminViewMode(mode) {
    setAdminViewMode(mode);
    localStorage.setItem("admin-view-mode", mode);
  }
  if (loading)
    return <div className="loading-screen">Loading clinic portal...</div>;
  if (authError)
    return (
      <div className="setup-screen">
        <h1>Unable to connect to Supabase</h1>
        <p>{authError}</p>
        <p>Check your Supabase URL, network connection, and phone Wi-Fi.</p>
        <button className="wide-button" onClick={() => window.location.reload()}>
          Try again
        </button>
      </div>
    );
  if (!isSupabaseConfigured)
    return (
      <div className="setup-screen">
        <h1>Supabase setup required</h1>
        <p>
          Add your project URL and publishable key to the local <b>.env</b>{" "}
          file, then restart Vite.
        </p>
      </div>
    );
  if (passwordRecovery)
    return (
      <SignIn
        key="password-recovery"
        onSignIn={setUser}
        passwordRecovery
        onPasswordRecoveryComplete={() => {
          setPasswordRecovery(false);
          window.history.replaceState({}, document.title, window.location.pathname);
        }}
      />
    );
  if (user && profileLoading)
    return (
      <div className="loading-screen">Loading your clinic workspace...</div>
    );
  if (profile?.is_active === false)
    return (
      <div className="setup-screen">
        <h1>Account inactive</h1>
        <p>
          Your clinic account has been deactivated. Contact the clinic
          administrator for access.
        </p>
        <button className="wide-button" onClick={signOut}>
          Sign out
        </button>
      </div>
    );
  if (profile?.role === "admin")
    return (
      <div className={`app-shell admin-portal portal-${adminViewMode}`}>
        <Header onLogout={signOut} user={user} portal="admin" viewMode={adminViewMode} onViewModeChange={changeAdminViewMode} />
        <AdminDashboard user={user} profile={profile} onLogout={signOut} viewMode={adminViewMode} onViewModeChange={changeAdminViewMode} />
      </div>
    );
  if (profile?.role === "staff")
    return <StaffPortal user={user} profile={profile} onLogout={signOut} />;
  const screens = {
    home: <Home setView={setView} profile={profile} user={user} />,
    appointments: <Appointments setView={setView} user={user} />,
    book: <Booking user={user} profile={profile} />,
    assistant: <AiAssistant profile={profile} />,
    profile: <Profile profile={profile} />,
  };

  if (!user) return <SignIn key="sign-in" onSignIn={setUser} />;
  return (
    <div className="app-shell patient-portal">
      <Header onLogout={signOut} user={user} portal="patient" showControls={false} />
      <PatientPageTools user={user} onLogout={signOut} />
      {screens[view]}
      <nav className="bottom-nav patient-nav" aria-label="Main navigation">
        {navItems.map((item) => (
          <button
            className={view === item.id ? "active" : ""}
            key={item.id}
            onClick={() => setView(item.id)}
          >
            <span className={item.id === "book" ? "book-icon" : ""}>
              {item.icon}
            </span>
            {item.label}
          </button>
        ))}
      </nav>
    </div>
  );
}

export default App;
