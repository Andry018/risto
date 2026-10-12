package it.risto.rear;

import android.content.Context;
import android.content.SharedPreferences;
import android.net.Uri;

import org.json.JSONException;
import org.json.JSONObject;

/** Ultima scena ricevuta dalla PWA. Persistita così la card ha qualcosa da mostrare dopo un riavvio. */
final class RearState {
    static final Uri URI = Uri.parse("content://it.risto.rear.state/scene");
    static final String[] COLUMNS = {"kind", "top", "main", "bottom", "accent", "updated_at", "seq"};

    private static final String PREFS = "rear_state";
    private static final int MAX_TEXT = 120;

    private RearState() {}

    static JSONObject read(Context ctx) {
        String raw = prefs(ctx).getString("scene", null);
        if (raw != null) {
            try { return new JSONObject(raw); } catch (JSONException ignored) {}
        }
        JSONObject idle = new JSONObject();
        try {
            idle.put("kind", "idle").put("top", "In servizio").put("main", "Il Girasole")
                .put("bottom", "").put("accent", "#CFA055").put("updated_at", 0L).put("seq", 0L);
        } catch (JSONException ignored) {}
        return idle;
    }

    /** Valida e salva; restituisce la scena normalizzata. */
    static synchronized JSONObject write(Context ctx, JSONObject in) throws JSONException {
        JSONObject prev = read(ctx);
        JSONObject out = new JSONObject();
        out.put("kind", clip(in.optString("kind", "table")));
        out.put("top", clip(in.optString("top", "")));
        out.put("main", clip(in.optString("main", "")));
        out.put("bottom", clip(in.optString("bottom", "")));
        String accent = in.optString("accent", "#CFA055");
        out.put("accent", accent.matches("#[0-9a-fA-F]{6}") ? accent : "#CFA055");
        out.put("updated_at", System.currentTimeMillis());
        out.put("seq", prev.optLong("seq", 0) + 1);
        prefs(ctx).edit().putString("scene", out.toString()).apply();
        ctx.getContentResolver().notifyChange(URI, null);
        return out;
    }

    /** Spento dall'utente: niente riavvio al boot e la card mostra "Ponte spento". */
    static boolean isEnabled(Context ctx) {
        return prefs(ctx).getBoolean("enabled", true);
    }

    static void setEnabled(Context ctx, boolean enabled) {
        boolean was = isEnabled(ctx);
        prefs(ctx).edit().putBoolean("enabled", enabled).apply();
        if (was == enabled) return;
        try {
            // Alla riaccensione la PWA rimanda la scena entro pochi secondi (heartbeat)
            write(ctx, new JSONObject().put("kind", enabled ? "idle" : "off").put("top", enabled ? "In servizio" : "")
                .put("main", "Il Girasole").put("bottom", enabled ? "" : "Ponte spento")
                .put("accent", enabled ? "#CFA055" : "#6B7280"));
        } catch (JSONException ignored) {
        }
    }

    private static String clip(String s) {
        return s.length() > MAX_TEXT ? s.substring(0, MAX_TEXT) : s;
    }

    private static SharedPreferences prefs(Context ctx) {
        return ctx.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }
}
