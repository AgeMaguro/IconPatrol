package com.agemaguro.iconpatrol;

import android.content.ContentProvider;
import android.content.ContentValues;
import android.database.Cursor;
import android.database.MatrixCursor;
import android.net.Uri;
import android.os.ParcelFileDescriptor;
import android.provider.OpenableColumns;

import java.io.File;
import java.io.FileNotFoundException;

/**
 * Serves the downloaded update (cache/update.apk) to Android's package installer, read-only, only to apps we grant
 * the URI to. Used when Android refuses a self-update through PackageInstaller (e.g. "Self update is blocked by
 * unknown source package" on apps that were sideloaded): the system installer then installs it like a browser download.
 */
public class ApkProvider extends ContentProvider {
    static final String AUTHORITY = "com.agemaguro.iconpatrol.apk";
    static final Uri URI = Uri.parse("content://" + AUTHORITY + "/update.apk");

    private File apk() { return new File(getContext().getCacheDir(), "update.apk"); }

    @Override public boolean onCreate() { return true; }

    @Override public String getType(Uri uri) { return "application/vnd.android.package-archive"; }

    @Override
    public ParcelFileDescriptor openFile(Uri uri, String mode) throws FileNotFoundException {
        if (!"r".equals(mode)) throw new FileNotFoundException("read-only");
        return ParcelFileDescriptor.open(apk(), ParcelFileDescriptor.MODE_READ_ONLY);
    }

    @Override
    public Cursor query(Uri uri, String[] projection, String selection, String[] selectionArgs, String sortOrder) {
        MatrixCursor c = new MatrixCursor(new String[]{OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE});
        c.addRow(new Object[]{"IconPatrol.apk", apk().length()});
        return c;
    }

    @Override public Uri insert(Uri uri, ContentValues values) { return null; }
    @Override public int delete(Uri uri, String selection, String[] selectionArgs) { return 0; }
    @Override public int update(Uri uri, ContentValues values, String selection, String[] selectionArgs) { return 0; }
}
