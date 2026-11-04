package com.agemaguro.iconpatrol;

import android.app.Activity;
import android.app.PendingIntent;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageInstaller;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import android.util.Log;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * In-app updater. Reads the newest release of the public repo AgeMaguro/IconPatrol, compares its version with this
 * app's, downloads IconPatrol.apk and hands it to Android's PackageInstaller.
 *
 * - The release name is "Icon Patrol 1.0.N"; N is the versionCode (set by the build workflow).
 * - Android always needs "Install unknown apps" allowed once for Icon Patrol. On Android 12+ the app asks to update
 *   itself without a confirm screen (USER_ACTION_NOT_REQUIRED); Android only allows that after Icon Patrol has
 *   installed itself at least once, so the first in-app update still shows "Update this app?".
 * - Status goes to the game page as window.__updateStatus({state, ...}).
 */
public class Updater {
    static final String REPO = "AgeMaguro/IconPatrol";
    static final String ACTION_INSTALL_STATUS = "com.agemaguro.iconpatrol.INSTALL_STATUS";
    private static final String TAG = "IconPatrol";
    private final MainActivity act;
    private volatile String apkUrl = null, latestName = null;
    private volatile long latestCode = -1;
    private volatile boolean busy = false;

    Updater(MainActivity act) { this.act = act; }

    long currentCode() {
        try {
            PackageInfo pi = act.getPackageManager().getPackageInfo(act.getPackageName(), 0);
            return Build.VERSION.SDK_INT >= 28 ? pi.getLongVersionCode() : pi.versionCode;
        } catch (Exception e) { return 0; }
    }

    String currentName() {
        try { return act.getPackageManager().getPackageInfo(act.getPackageName(), 0).versionName; }
        catch (Exception e) { return "?"; }
    }

    /** Looks up the newest release. Reports "available", "current" or "error" (errors are quiet unless asked). */
    void check(final boolean userAsked) {
        if (busy) return;
        busy = true;
        if (userAsked) status("{\"state\":\"checking\"}");
        new Thread(() -> {
            try {
                String json = httpGetString("https://api.github.com/repos/" + REPO + "/releases/latest");
                JSONObject rel = new JSONObject(json);
                String name = rel.optString("name", "");
                Matcher m = Pattern.compile("(\\d+)\\.(\\d+)\\.(\\d+)").matcher(name);
                if (!m.find()) throw new Exception("couldn't read the release version (" + name + ")");
                latestCode = Long.parseLong(m.group(3));
                latestName = m.group(0);
                apkUrl = null;
                JSONArray assets = rel.optJSONArray("assets");
                if (assets != null) for (int i = 0; i < assets.length(); i++) {
                    JSONObject a = assets.getJSONObject(i);
                    if (a.optString("name").endsWith(".apk")) { apkUrl = a.optString("browser_download_url"); break; }
                }
                if (apkUrl == null) throw new Exception("the newest release has no APK attached");
                boolean newer = latestCode > currentCode();
                status("{\"state\":\"" + (newer ? "available" : "current") + "\",\"latest\":" + JSONObject.quote(latestName)
                        + ",\"current\":" + JSONObject.quote(currentName()) + "}");
            } catch (Exception e) {
                Log.w(TAG, "Update check failed", e);
                if (userAsked) error("couldn't check (" + e.getMessage() + ")");
                else status("{\"state\":\"idle\",\"current\":" + JSONObject.quote(currentName()) + "}");
            } finally { busy = false; }
        }).start();
    }

    /** Downloads the newest APK and starts the install. */
    void install() {
        if (busy) return;
        if (apkUrl == null) { check(true); return; }
        if (Build.VERSION.SDK_INT >= 26 && !act.getPackageManager().canRequestPackageInstalls()) {
            // One-time switch: Settings > Install unknown apps > Icon Patrol > Allow
            status("{\"state\":\"permission\"}");
            act.runOnUiThread(() -> {
                try {
                    act.startActivity(new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                            Uri.parse("package:" + act.getPackageName())));
                } catch (Exception e) { Log.w(TAG, "Couldn't open the install permission screen", e); }
            });
            return;
        }
        busy = true;
        new Thread(() -> {
            File apk = new File(act.getCacheDir(), "update.apk");
            try {
                download(apkUrl, apk);
                status("{\"state\":\"installing\"}");
                PackageInstaller pi = act.getPackageManager().getPackageInstaller();
                PackageInstaller.SessionParams params = new PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL);
                params.setAppPackageName(act.getPackageName());
                if (Build.VERSION.SDK_INT >= 31) params.setRequireUserAction(PackageInstaller.SessionParams.USER_ACTION_NOT_REQUIRED);
                int id = pi.createSession(params);
                PackageInstaller.Session session = pi.openSession(id);
                try (InputStream in = new FileInputStream(apk); OutputStream out = session.openWrite("base.apk", 0, apk.length())) {
                    byte[] buf = new byte[64 * 1024];
                    int n;
                    while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
                    session.fsync(out);
                }
                Intent done = new Intent(act, MainActivity.class).setAction(ACTION_INSTALL_STATUS)
                        .addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);
                int flags = PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 31 ? PendingIntent.FLAG_MUTABLE : 0);
                PendingIntent pending = PendingIntent.getActivity(act, 1, done, flags);
                session.commit(pending.getIntentSender());
                session.close();
            } catch (Exception e) {
                Log.e(TAG, "Update failed", e);
                error(e.getMessage() == null ? e.toString() : e.getMessage());
            } finally { busy = false; }
        }).start();
    }

    /** Called by MainActivity when Android reports the install result. */
    @SuppressWarnings("deprecation")
    void onInstallStatus(Intent i) {
        int st = i.getIntExtra(PackageInstaller.EXTRA_STATUS, -999);
        if (st == PackageInstaller.STATUS_PENDING_USER_ACTION) {
            Intent confirm = i.getParcelableExtra(Intent.EXTRA_INTENT);
            if (confirm != null) {
                // Start it from our activity, in our task. Adding FLAG_ACTIVITY_NEW_TASK here made some phones
                // cancel the install immediately (STATUS_FAILURE_ABORTED) before the confirm screen could show.
                final Intent c = confirm;
                act.runOnUiThread(() -> {
                    try { act.startActivity(c); } catch (Exception e) { Log.e(TAG, "Couldn't open the installer", e); error("couldn't open the installer"); }
                });
            } else error("Android didn't send the confirm screen");
        } else if (st == PackageInstaller.STATUS_SUCCESS) {
            status("{\"state\":\"done\"}");   // Android restarts the app with the new version
        } else if (st != -999) {
            String msg = i.getStringExtra(PackageInstaller.EXTRA_STATUS_MESSAGE);
            Log.w(TAG, "Install status " + st + ": " + msg);
            String why = st == PackageInstaller.STATUS_FAILURE_ABORTED ? "install cancelled"
                    : st == PackageInstaller.STATUS_FAILURE_BLOCKED ? "install blocked (Play Protect or a device policy)"
                    : st == PackageInstaller.STATUS_FAILURE_CONFLICT ? "install conflict (different signing key: uninstall once, then install from the browser)"
                    : st == PackageInstaller.STATUS_FAILURE_STORAGE ? "not enough storage"
                    : st == PackageInstaller.STATUS_FAILURE_INVALID ? "the downloaded APK was invalid"
                    : st == PackageInstaller.STATUS_FAILURE_INCOMPATIBLE ? "incompatible with this phone"
                    : "install failed";
            error(why + " [code " + st + (msg != null ? ": " + msg : "") + "]");
        }
    }

    // ---------- helpers ----------
    private HttpURLConnection open(String url) throws Exception {
        HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
        c.setConnectTimeout(15000);
        c.setReadTimeout(30000);
        c.setInstanceFollowRedirects(true);
        c.setRequestProperty("User-Agent", "IconPatrol-updater");
        c.setRequestProperty("Accept", url.contains("api.github.com") ? "application/vnd.github+json" : "application/octet-stream");
        int code = c.getResponseCode();
        if (code == 404) throw new Exception("no release found yet");
        if (code >= 400) throw new Exception("server answered " + code);
        return c;
    }

    private String httpGetString(String url) throws Exception {
        HttpURLConnection c = open(url);
        try (InputStream in = c.getInputStream(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            byte[] buf = new byte[16 * 1024];
            int n;
            while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
            return out.toString("UTF-8");
        } finally { c.disconnect(); }
    }

    private void download(String url, File dest) throws Exception {
        HttpURLConnection c = open(url);
        long total = c.getContentLengthLong(), got = 0;
        int lastPct = -1;
        try (InputStream in = c.getInputStream(); OutputStream out = new FileOutputStream(dest)) {
            byte[] buf = new byte[64 * 1024];
            int n;
            while ((n = in.read(buf)) > 0) {
                out.write(buf, 0, n);
                got += n;
                int pct = total > 0 ? (int) (got * 100 / total) : -1;
                if (pct != lastPct && (pct < 0 || pct % 5 == 0)) { lastPct = pct; status("{\"state\":\"downloading\",\"pct\":" + pct + "}"); }
            }
        } finally { c.disconnect(); }
        if (got < 10000) throw new Exception("download was too small (" + got + " bytes)");
    }

    private void error(String msg) { status("{\"state\":\"error\",\"msg\":" + JSONObject.quote(msg) + ",\"current\":" + JSONObject.quote(currentName()) + "}"); }

    /** Fallback: open the newest APK link in the browser; Android installs it from the download. */
    void openInBrowser() {
        act.runOnUiThread(() -> {
            try {
                act.startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse("https://github.com/" + REPO + "/releases/latest/download/IconPatrol.apk"))
                        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
            } catch (Exception e) { Log.w(TAG, "Couldn't open the browser", e); }
        });
    }

    void status(final String json) { act.sendToPage("window.__updateStatus && window.__updateStatus(" + json + ")"); }
}
