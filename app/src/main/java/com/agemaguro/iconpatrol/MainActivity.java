package com.agemaguro.iconpatrol;

import android.app.Activity;
import android.content.ClipData;
import android.content.ContentResolver;
import android.content.Intent;
import android.database.Cursor;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.provider.DocumentsContract;
import android.util.Log;
import android.view.View;
import android.view.WindowManager;
import android.webkit.ConsoleMessage;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceResponse;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import org.json.JSONArray;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

/**
 * Full-screen landscape WebView that runs the offline Icon Patrol game from assets/index.html.
 * No internet permission, no ads. Your files are only read when you pick them, and never leave the phone.
 *
 * File picking:
 *  - "Pick files from phone..." -> Android's file picker (multiple files).
 *  - "Scan a real folder..."    -> Android's folder picker; the app walks the folder (limited size) and hands the
 *    files to the game together with their folder paths (window.__appPaths), so each subfolder becomes a sector.
 * Back button -> window.onBack() in the game (pause / back / title); on the title screen it closes the app.
 * JavaScript console messages go to logcat (tag "IconPatrol").
 */
public class MainActivity extends Activity {
    private static final String TAG = "IconPatrol";
    private static final String HOME = "file:///android_asset/";
    private static final int REQ_FILES = 1, REQ_FOLDER = 2;
    // folder scan limits (keeps big folders like the camera roll quick)
    private static final int MAX_DEPTH = 5, MAX_PER_DIR = 24, MAX_DIRS = 40, MAX_FILES = 900;

    private WebView web;
    private ValueCallback<Uri[]> pendingChooser;
    private Updater updater;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        int bg = Color.rgb(0x03, 0x04, 0x0c);

        updater = new Updater(this);
        web = new WebView(this);
        web.setBackgroundColor(bg);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);                    // high scores and settings
        s.setTextZoom(100);                              // ignore system font scaling so the HUD fits
        s.setMediaPlaybackRequiresUserGesture(false);    // game sound effects
        s.setAllowFileAccess(false);                     // only the app's own page (android_asset still works)
        s.setAllowContentAccess(true);                   // read the files you pick
        s.setUserAgentString(s.getUserAgentString() + " IconPatrolApp/" + versionName());
        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) {
                String url = req.getUrl().toString();
                if (url.startsWith(HOME)) return false;
                Log.w(TAG, "Blocked navigation to " + url);
                return true;
            }

            // The page may not load anything from the internet (only the updater, in Java, goes online).
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest req) {
                String url = req.getUrl().toString();
                if (url.startsWith("http:") || url.startsWith("https:")) return new WebResourceResponse("text/plain", "utf-8", null);
                return null;
            }

            @Override
            public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail detail) {
                Log.e(TAG, "WebView renderer gone (crashed=" + detail.didCrash() + "), restarting");
                if (web != null) { web.destroy(); web = null; }
                recreate();
                return true;
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onConsoleMessage(ConsoleMessage m) {
                String line = m.message() + " (" + m.sourceId() + ":" + m.lineNumber() + ")";
                if (m.messageLevel() == ConsoleMessage.MessageLevel.ERROR) Log.e(TAG, line);
                else if (m.messageLevel() == ConsoleMessage.MessageLevel.WARNING) Log.w(TAG, line);
                else Log.d(TAG, line);
                return true;
            }

            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (pendingChooser != null) pendingChooser.onReceiveValue(null);
                pendingChooser = callback;
                boolean folder = params.getAcceptTypes() != null && Arrays.asList(params.getAcceptTypes()).contains("inode/directory");
                try {
                    if (folder) {
                        startActivityForResult(new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE), REQ_FOLDER);
                    } else {
                        Intent i = new Intent(Intent.ACTION_GET_CONTENT);
                        i.addCategory(Intent.CATEGORY_OPENABLE);
                        i.setType("*/*");
                        i.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
                        startActivityForResult(Intent.createChooser(i, "Pick files for Icon Patrol"), REQ_FILES);
                    }
                    return true;
                } catch (Exception e) {
                    Log.e(TAG, "No file picker available", e);
                    pendingChooser = null;
                    return false;
                }
            }
        });
        // Bridge for the title screen's "Check for updates" button
        web.addJavascriptInterface(new Object() {
            @JavascriptInterface public void checkForUpdate(boolean userAsked) { updater.check(userAsked); }
            @JavascriptInterface public void installUpdate() { updater.install(); }
            @JavascriptInterface public String version() { return updater.currentName(); }
        }, "IconApp");
        setContentView(web);
        goImmersive();
        handleInstallIntent(getIntent());

        if (state != null && web.restoreState(state) != null) return;
        web.loadUrl(HOME + "index.html");
    }

    // ---------- file and folder picking ----------
    @Override
    protected void onActivityResult(int req, int result, Intent data) {
        super.onActivityResult(req, result, data);
        final ValueCallback<Uri[]> cb = pendingChooser;
        pendingChooser = null;
        if (cb == null) return;
        if (result != RESULT_OK || data == null) { cb.onReceiveValue(null); return; }

        if (req == REQ_FILES) {
            List<Uri> uris = new ArrayList<>();
            ClipData clip = data.getClipData();
            if (clip != null) for (int i = 0; i < clip.getItemCount(); i++) uris.add(clip.getItemAt(i).getUri());
            else if (data.getData() != null) uris.add(data.getData());
            cb.onReceiveValue(uris.toArray(new Uri[0]));
            return;
        }

        if (req == REQ_FOLDER) {
            final Uri tree = data.getData();
            if (tree == null) { cb.onReceiveValue(null); return; }
            Toast.makeText(this, "Scanning folder…", Toast.LENGTH_SHORT).show();
            new Thread(() -> {
                final List<Uri> uris = new ArrayList<>();
                final JSONArray paths = new JSONArray();
                try {
                    String rootId = DocumentsContract.getTreeDocumentId(tree);
                    String rootName = displayName(tree, rootId);
                    walk(tree, rootId, rootName, 0, uris, paths, new int[]{0});
                } catch (Exception e) {
                    Log.e(TAG, "Folder scan failed", e);
                }
                runOnUiThread(() -> {
                    if (web == null) { cb.onReceiveValue(null); return; }
                    if (uris.isEmpty()) {
                        Toast.makeText(this, "No files found in that folder", Toast.LENGTH_LONG).show();
                        cb.onReceiveValue(null);
                        return;
                    }
                    // hand the folder paths over first, then the files (the game matches them by order)
                    web.evaluateJavascript("window.__appPaths=" + paths + ";true", v -> cb.onReceiveValue(uris.toArray(new Uri[0])));
                });
            }).start();
        }
    }

    /** Recursively lists a picked folder: up to MAX_PER_DIR files per folder, MAX_DIRS folders, MAX_FILES files. */
    private void walk(Uri tree, String docId, String path, int depth, List<Uri> uris, JSONArray paths, int[] dirsWithFiles) {
        if (depth > MAX_DEPTH || uris.size() >= MAX_FILES || dirsWithFiles[0] >= MAX_DIRS) return;
        Uri children = DocumentsContract.buildChildDocumentsUriUsingTree(tree, docId);
        List<String[]> subdirs = new ArrayList<>();
        int filesHere = 0;
        ContentResolver cr = getContentResolver();
        try (Cursor c = cr.query(children, new String[]{
                DocumentsContract.Document.COLUMN_DOCUMENT_ID,
                DocumentsContract.Document.COLUMN_DISPLAY_NAME,
                DocumentsContract.Document.COLUMN_MIME_TYPE}, null, null, null)) {
            if (c == null) return;
            while (c.moveToNext()) {
                String id = c.getString(0), name = c.getString(1), mime = c.getString(2);
                if (name == null || name.startsWith(".")) continue;
                if (DocumentsContract.Document.MIME_TYPE_DIR.equals(mime)) {
                    subdirs.add(new String[]{id, name});
                } else if (filesHere < MAX_PER_DIR && uris.size() < MAX_FILES) {
                    uris.add(DocumentsContract.buildDocumentUriUsingTree(tree, id));
                    paths.put(path + "/" + name);
                    filesHere++;
                }
            }
        } catch (Exception e) {
            Log.w(TAG, "Couldn't list " + path, e);
        }
        if (filesHere > 0) dirsWithFiles[0]++;
        for (String[] d : subdirs) walk(tree, d[0], path + "/" + d[1], depth + 1, uris, paths, dirsWithFiles);
    }

    private String displayName(Uri tree, String docId) {
        try (Cursor c = getContentResolver().query(DocumentsContract.buildDocumentUriUsingTree(tree, docId),
                new String[]{DocumentsContract.Document.COLUMN_DISPLAY_NAME}, null, null, null)) {
            if (c != null && c.moveToFirst() && c.getString(0) != null) return c.getString(0);
        } catch (Exception ignored) { }
        return "Phone";
    }

    // ---------- updates ----------
    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        handleInstallIntent(intent);
    }

    private void handleInstallIntent(Intent i) {
        if (i != null && Updater.ACTION_INSTALL_STATUS.equals(i.getAction()) && updater != null) updater.onInstallStatus(i);
    }

    /** Runs a line of JavaScript in the game page (from any thread). */
    void sendToPage(final String js) {
        runOnUiThread(() -> { if (web != null) web.evaluateJavascript(js, null); });
    }

    // ---------- full screen ----------
    @SuppressWarnings("deprecation")
    private void goImmersive() {
        getWindow().getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY | View.SYSTEM_UI_FLAG_FULLSCREEN | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_LAYOUT_STABLE);
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) goImmersive();
    }

    private String versionName() {
        try { return getPackageManager().getPackageInfo(getPackageName(), 0).versionName; }
        catch (Exception e) { return "?"; }
    }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        if (web != null) web.saveState(out);
    }

    /** Back button: the game decides (pause menu, settings back, map -> title). On the title screen it closes the app. */
    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        if (web == null) { super.onBackPressed(); return; }
        web.evaluateJavascript("window.onBack ? onBack() : false", handled -> {
            if (!"true".equals(handled)) MainActivity.super.onBackPressed();
        });
    }

    /** Switching apps pauses the game (shows the pause menu) and stops rendering and sound. */
    @Override
    protected void onPause() {
        if (web != null) {
            web.evaluateJavascript("window.dispatchEvent(new Event('blur'))", null);
            web.onPause();
        }
        super.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (web != null) web.onResume();
        goImmersive();
    }
}
