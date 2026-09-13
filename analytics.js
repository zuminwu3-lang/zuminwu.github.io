
(() => {
  const SUPABASE_URL = "https://kgmhpsoiqnjszkrknqki.supabase.co";
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtnbWhwc29pcW5qc3prcmtucWtpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg1OTI0MjQsImV4cCI6MjEwNDE2ODQyNH0.fWz688zm6UwQBXjVtx_qSrrTkRJZ_mgh-tuBaRJY73s";

  if (!window.supabase) {
    console.warn("Supabase SDK 未加载，analytics.js 已跳过统计。");
    return;
  }

  const sbClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  function isOwnerMode() {
    return localStorage.getItem("zumin_owner_mode") === "1";
  }

  function getDeviceId() {
    let id = localStorage.getItem("zumin_device_id");
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem("zumin_device_id", id);
    }
    return id;
  }

  async function trackPageView() {
    if (isOwnerMode()) {
      console.info("站长模式已开启，本次访问不计入统计。");
      return;
    }

    const deviceId = getDeviceId();
    const page = location.pathname.split("/").pop() || "index.html";
    const now = new Date().toISOString();

    try {
      const { error: visitError } = await sbClient
        .from("site_visits")
        .insert([{
          device_id: deviceId,
          page,
          referrer: document.referrer || null,
          visited_at: now
        }]);

      if (visitError) throw visitError;

      const { data: device, error: readError } = await sbClient
        .from("site_devices")
        .select("device_id, visit_count")
        .eq("device_id", deviceId)
        .maybeSingle();

      if (readError) throw readError;

      if (device) {
        const { error: updateError } = await sbClient
          .from("site_devices")
          .update({
            last_seen: now,
            visit_count: Number(device.visit_count || 0) + 1
          })
          .eq("device_id", deviceId);

        if (updateError) throw updateError;
      } else {
        const { error: insertDeviceError } = await sbClient
          .from("site_devices")
          .insert([{
            device_id: deviceId,
            first_seen: now,
            last_seen: now,
            visit_count: 1
          }]);

        if (insertDeviceError) throw insertDeviceError;
      }
    } catch (err) {
      console.warn("访问统计记录失败：", err.message || err);
    }
  }

  async function loadSiteStats() {
    try {
      const { count: views, error: viewsError } = await sbClient
        .from("site_visits")
        .select("*", { count: "exact", head: true });

      if (viewsError) throw viewsError;

      const { count: devices, error: devicesError } = await sbClient
        .from("site_devices")
        .select("*", { count: "exact", head: true });

      if (devicesError) throw devicesError;

      document.querySelectorAll("[data-site-views]").forEach(el => {
        el.textContent = views ?? 0;
      });

      document.querySelectorAll("[data-site-devices]").forEach(el => {
        el.textContent = devices ?? 0;
      });
    } catch (err) {
      console.warn("访问统计读取失败：", err.message || err);
    }
  }

  trackPageView().finally(loadSiteStats);

  window.ZuminAnalytics = {
    refresh: loadSiteStats,
    getDeviceId,
    isOwnerMode
  };
})();
