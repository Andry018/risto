package it.risto.rear;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;
import android.util.Log;

import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetAddress;
import java.net.ServerSocket;
import java.net.Socket;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;

/**
 * Mini server HTTP su 127.0.0.1:8790 (solo loopback, non raggiungibile dalla rete).
 *  POST /state  {kind, top, main, bottom, accent} -> salva e notifica la card
 *  GET  /state  -> ultima scena (usato dalla PWA per "app ponte collegata")
 */
public class BridgeService extends Service {
    static final int PORT = 8790;
    private static final String TAG = "GirasoleRear";
    private static final String CHANNEL = "bridge";
    private static final int MAX_BODY = 8 * 1024;

    private volatile ServerSocket server;
    private Thread thread;

    static final String ACTION_STOP = "it.risto.rear.STOP";

    static void start(Context ctx) {
        RearState.setEnabled(ctx, true);
        ctx.startForegroundService(new Intent(ctx, BridgeService.class));
    }

    static void stop(Context ctx) {
        RearState.setEnabled(ctx, false);
        ctx.stopService(new Intent(ctx, BridgeService.class));
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && ACTION_STOP.equals(intent.getAction())) {
            RearState.setEnabled(this, false);
            stopForeground(STOP_FOREGROUND_REMOVE);
            stopSelf();
            return START_NOT_STICKY;
        }
        Notification n = buildNotification();
        if (Build.VERSION.SDK_INT >= 34) {
            startForeground(1, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE);
        } else {
            startForeground(1, n);
        }
        if (thread == null || !thread.isAlive()) {
            thread = new Thread(this::serve, "rear-http");
            thread.start();
        }
        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        try {
            if (server != null) server.close();
        } catch (IOException ignored) {
        }
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    private Notification buildNotification() {
        NotificationManager nm = getSystemService(NotificationManager.class);
        nm.createNotificationChannel(new NotificationChannel(CHANNEL, "Ponte schermo posteriore", NotificationManager.IMPORTANCE_MIN));
        PendingIntent open = PendingIntent.getActivity(this, 0, new Intent(this, MainActivity.class), PendingIntent.FLAG_IMMUTABLE);
        PendingIntent stop = PendingIntent.getService(this, 1,
            new Intent(this, BridgeService.class).setAction(ACTION_STOP), PendingIntent.FLAG_IMMUTABLE);
        return new Notification.Builder(this, CHANNEL)
            .setSmallIcon(android.R.drawable.ic_menu_slideshow)
            .setContentTitle("Girasole Rear attivo")
            .setContentText("In ascolto su 127.0.0.1:" + PORT)
            .setContentIntent(open)
            .addAction(new Notification.Action.Builder(null, "Spegni", stop).build())
            .setOngoing(true)
            .build();
    }

    private void serve() {
        try (ServerSocket ss = new ServerSocket(PORT, 16, InetAddress.getByName("127.0.0.1"))) {
            server = ss;
            while (!ss.isClosed()) {
                try (Socket s = ss.accept()) {
                    s.setSoTimeout(3000);
                    handle(s);
                } catch (IOException e) {
                    if (!ss.isClosed()) Log.w(TAG, "richiesta fallita", e);
                }
            }
        } catch (IOException e) {
            Log.e(TAG, "server non avviato (porta occupata?)", e);
        }
    }

    private void handle(Socket s) throws IOException {
        InputStream in = s.getInputStream();
        String head = readHead(in);
        if (head == null) return;
        String[] lines = head.split("\r\n");
        String[] req = lines[0].split(" ");
        if (req.length < 2) return;
        String method = req[0];
        String path = req[1];
        Map<String, String> headers = new HashMap<>();
        for (int i = 1; i < lines.length; i++) {
            int c = lines[i].indexOf(':');
            if (c > 0) headers.put(lines[i].substring(0, c).trim().toLowerCase(Locale.ROOT), lines[i].substring(c + 1).trim());
        }
        String origin = headers.get("origin");
        OutputStream out = s.getOutputStream();

        if (origin != null && !allowedOrigin(origin)) {
            respond(out, 403, null, "{\"error\":\"origin\"}");
            return;
        }
        if (!path.startsWith("/state")) {
            respond(out, 404, origin, "{\"error\":\"not found\"}");
            return;
        }
        switch (method) {
            case "OPTIONS":
                respond(out, 204, origin, null);
                break;
            case "GET":
                respond(out, 200, origin, RearState.read(this).toString());
                break;
            case "POST": {
                int len = 0;
                try {
                    len = Integer.parseInt(headers.getOrDefault("content-length", "0"));
                } catch (NumberFormatException ignored) {
                }
                if (len <= 0 || len > MAX_BODY) {
                    respond(out, 413, origin, "{\"error\":\"size\"}");
                    break;
                }
                byte[] body = readBody(in, len);
                try {
                    JSONObject saved = RearState.write(this, new JSONObject(new String(body, StandardCharsets.UTF_8)));
                    respond(out, 200, origin, saved.toString());
                } catch (Exception e) {
                    respond(out, 400, origin, "{\"error\":\"json\"}");
                }
                break;
            }
            default:
                respond(out, 405, origin, null);
        }
    }

    /** La PWA del gestionale (e il dev server in LAN). Gli altri siti non possono scrivere sul retro. */
    static boolean allowedOrigin(String origin) {
        return origin.equals("https://gestionale.90-minuti.it")
            || origin.matches("https?://(localhost|127\\.0\\.0\\.1|192\\.168\\.\\d+\\.\\d+)(:\\d+)?");
    }

    private static String readHead(InputStream in) throws IOException {
        ByteArrayOutputStream buf = new ByteArrayOutputStream();
        int b;
        int state = 0; // conta \r\n\r\n
        while ((b = in.read()) != -1) {
            buf.write(b);
            if (buf.size() > 16 * 1024) return null;
            if (b == '\r' && (state == 0 || state == 2)) state++;
            else if (b == '\n' && (state == 1 || state == 3)) state++;
            else state = 0;
            if (state == 4) return new String(buf.toByteArray(), StandardCharsets.ISO_8859_1);
        }
        return null;
    }

    private static byte[] readBody(InputStream in, int len) throws IOException {
        byte[] body = new byte[len];
        int off = 0;
        while (off < len) {
            int n = in.read(body, off, len - off);
            if (n < 0) throw new IOException("body troncato");
            off += n;
        }
        return body;
    }

    private static void respond(OutputStream out, int code, String origin, String json) throws IOException {
        byte[] body = json == null ? new byte[0] : json.getBytes(StandardCharsets.UTF_8);
        StringBuilder h = new StringBuilder("HTTP/1.1 ").append(code).append(" X\r\n")
            .append("Content-Length: ").append(body.length).append("\r\n")
            .append("Connection: close\r\n")
            .append("Cache-Control: no-store\r\n");
        if (json != null) h.append("Content-Type: application/json; charset=utf-8\r\n");
        if (origin != null) {
            h.append("Access-Control-Allow-Origin: ").append(origin).append("\r\n")
                .append("Vary: Origin\r\n")
                .append("Access-Control-Allow-Methods: GET, POST, OPTIONS\r\n")
                .append("Access-Control-Allow-Headers: Content-Type\r\n")
                .append("Access-Control-Allow-Private-Network: true\r\n")
                .append("Access-Control-Max-Age: 600\r\n");
        }
        h.append("\r\n");
        out.write(h.toString().getBytes(StandardCharsets.ISO_8859_1));
        out.write(body);
        out.flush();
    }
}
