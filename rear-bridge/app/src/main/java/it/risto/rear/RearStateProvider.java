package it.risto.rear;

import android.content.ContentProvider;
import android.content.ContentValues;
import android.database.Cursor;
import android.database.MatrixCursor;
import android.net.Uri;

import org.json.JSONObject;

/** content://it.risto.rear.state/scene → una riga con le colonne di {@link RearState#COLUMNS}. */
public class RearStateProvider extends ContentProvider {
    @Override
    public boolean onCreate() {
        return true;
    }

    @Override
    public Cursor query(Uri uri, String[] projection, String selection, String[] selectionArgs, String sortOrder) {
        JSONObject s = RearState.read(getContext());
        MatrixCursor c = new MatrixCursor(RearState.COLUMNS, 1);
        c.addRow(new Object[]{
            s.optString("kind"), s.optString("top"), s.optString("main"), s.optString("bottom"),
            s.optString("accent"), s.optLong("updated_at"), s.optLong("seq"),
        });
        c.setNotificationUri(getContext().getContentResolver(), RearState.URI);
        return c;
    }

    @Override public String getType(Uri uri) { return "vnd.android.cursor.item/vnd.it.risto.rear.scene"; }
    @Override public Uri insert(Uri uri, ContentValues values) { return null; }
    @Override public int delete(Uri uri, String selection, String[] selectionArgs) { return 0; }
    @Override public int update(Uri uri, ContentValues values, String selection, String[] selectionArgs) { return 0; }
}
